/**
 * Live test: token mode vs cookie mode feature parity.
 *
 * Runs each capability in BOTH auth modes (where the capability applies) against the
 * sandbox workspace and prints a measured parity table. Nothing is hardcoded as PASS:
 * a row is PASS only if the call ran and returned real data in that mode.
 *
 * Row statuses:
 *   PASS         ran and returned the expected data
 *   FAIL         ran and failed (fails the suite)
 *   KNOWN_GAP    failed, but tracked by a remediation finding ID (reported, does not fail the suite)
 *   RESTRICTED   expected to be unavailable in this mode, and verified to be unavailable
 *   N/A          capability does not exist in this mode
 *
 * Requires: valid Gate + Dashboards tokens, a valid session cookie, FUSEBASE_WORKSPACE_ID.
 * Everything created is deleted at the end.
 */

import { FusebaseClient } from "../src/client.js";
import { FusebaseGateBridge } from "../src/gate-bridge.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import { resolveTokens } from "../src/config.js";
import { requireSandboxWorkspace, runSuite } from "./lib/live-harness.js";

type Status = "PASS" | "FAIL" | "KNOWN_GAP" | "RESTRICTED" | "N/A";

interface Row {
  domain: string;
  feature: string;
  token: Status;
  cookie: Status;
  notes: string[];
}

const rows: Row[] = [];

/** Findings from docs/PLAN-review-remediation.md that are expected to fail until fixed. */
const KNOWN_GAPS: Record<string, string> = {};

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Run one capability in one mode. `check` must throw (or return false) on failure.
 * mode "expect-restricted" inverts the check: success is a FAIL, failure is RESTRICTED.
 */
async function measure(
  row: Row,
  mode: "token" | "cookie",
  check: () => Promise<boolean | void>,
  expect: "works" | "restricted" = "works",
): Promise<boolean> {
  let ok = false;
  let detail = "";
  try {
    ok = (await check()) !== false;
    if (!ok) detail = "returned no data";
  } catch (err) {
    detail = errMsg(err).slice(0, 160);
  }

  let status: Status;
  if (expect === "restricted") {
    status = ok ? "FAIL" : "RESTRICTED";
    if (ok) detail = "expected to be unavailable in this mode but it worked (update the parity docs)";
  } else if (ok) {
    status = "PASS";
  } else {
    const gap = KNOWN_GAPS[`${mode}:${row.domain}:${row.feature}`];
    status = gap ? "KNOWN_GAP" : "FAIL";
    if (gap) detail = `${gap}: ${detail}`;
  }
  row[mode] = status;
  if (detail) row.notes.push(`[${mode}] ${detail}`);
  console.log(`  [${mode}] ${row.feature}: ${status}${detail ? ` (${detail})` : ""}`);
  return ok;
}

function newRow(domain: string, feature: string): Row {
  const row: Row = { domain, feature, token: "N/A", cookie: "N/A", notes: [] };
  rows.push(row);
  return row;
}

async function main() {
  const workspaceId = requireSandboxWorkspace();
  const { gateToken, dashboardsToken } = resolveTokens();
  const cookie = process.env.FUSEBASE_COOKIE || loadEncryptedCookie()?.cookie || "";

  console.log(`[Config] Gate token: ${gateToken ? "present" : "missing"}`);
  console.log(`[Config] Dashboards token: ${dashboardsToken ? "present" : "missing"}`);
  console.log(`[Config] Cookie: ${cookie ? "present" : "missing"}\n`);
  if (!gateToken || !dashboardsToken || !cookie) {
    throw new Error("Parity testing needs both auth modes: Gate token, Dashboards token and a session cookie.");
  }

  const gateBridge = new FusebaseGateBridge({ gateToken, dashboardsToken });
  const identity = await gateBridge.init();
  const host = identity.orgDomain || process.env.FUSEBASE_HOST;
  const orgId = identity.orgId || process.env.FUSEBASE_ORG_ID;
  if (!host || !orgId) throw new Error("Could not resolve org host / id from whoami or FUSEBASE_HOST / FUSEBASE_ORG_ID.");
  console.log(`[Identity] org=${orgId} host=${host} sandbox workspace=${workspaceId}\n`);

  const tokenClient = new FusebaseClient({ host, orgId, cookie: "", gateToken, dashboardsToken, gateBridge, autoRefresh: false });
  const cookieClient = new FusebaseClient({ host, orgId, cookie, autoRefresh: false });

  const created: Array<{ id: string; kind: string }> = [];

  try {
    // ─── Identity ──────────────────────────────────────────────────
    console.log("--- Identity ---");
    const whoami = newRow("Identity", "Tenant identity");
    await measure(whoami, "token", async () => {
      const w = await gateBridge.whoami("gate");
      return Boolean(w.auth?.org?.id || w.org?.id);
    });
    await measure(whoami, "cookie", async () => Boolean(await cookieClient.getOrgUsage()));

    // ─── Workspaces ────────────────────────────────────────────────
    console.log("--- Workspaces ---");
    const wsRow = newRow("Workspaces", "List workspaces (includes sandbox)");
    for (const [mode, client] of [["token", tokenClient], ["cookie", cookieClient]] as const) {
      await measure(wsRow, mode, async () => {
        const list = await client.listWorkspaces();
        return list.some((w: any) => (w.workspaceId ?? w.id) === workspaceId);
      });
    }

    // ─── Pages ─────────────────────────────────────────────────────
    console.log("--- Pages ---");
    const pageIds: Partial<Record<"token" | "cookie", string>> = {};
    const createRow = newRow("Pages", "Create page");
    for (const [mode, client] of [["token", tokenClient], ["cookie", cookieClient]] as const) {
      await measure(createRow, mode, async () => {
        const note = await client.createPage(workspaceId, `[parity-test ${mode}] ${Date.now()}`);
        if (!note?.globalId) return false;
        pageIds[mode] = note.globalId;
        created.push({ id: note.globalId, kind: `page (${mode})` });
      });
    }

    const getRow = newRow("Pages", "Get page metadata");
    for (const [mode, client] of [["token", tokenClient], ["cookie", cookieClient]] as const) {
      await measure(getRow, mode, async () => {
        const id = pageIds[mode];
        if (!id) throw new Error("no page created in this mode");
        const page = await client.getPage(workspaceId, id);
        return page?.globalId === id || (page as any)?.id === id;
      });
    }

    const appendRow = newRow("Pages", "Append + read back content");
    for (const [mode, client] of [["token", tokenClient], ["cookie", cookieClient]] as const) {
      await measure(appendRow, mode, async () => {
        const id = pageIds[mode];
        if (!id) throw new Error("no page created in this mode");
        const marker = `parity-append-${mode}-${Date.now()}`;
        const res = await client.appendPageContent(workspaceId, id, { markdown: `Paragraph ${marker}` });
        if (!res.success) throw new Error(res.error || "append reported failure");
        const content = await client.getPageContent(workspaceId, id);
        return content.includes(marker);
      });
    }

    const replaceRow = newRow("Pages", "Replace page content");
    await measure(replaceRow, "cookie", async () => {
      const id = pageIds.cookie;
      if (!id) throw new Error("no page created in this mode");
      const { writeContentViaWebSocket } = await import("../src/yjs-ws-writer.js");
      const marker = `parity-replace-${Date.now()}`;
      const res = await writeContentViaWebSocket(host, workspaceId, id, cookie, [{ type: "paragraph", children: [{ text: marker }] }], { replace: true });
      if (!res.success) throw new Error(res.error || "write failed");
      // The writer reports success without server confirmation (CON-4); give the read a few tries.
      for (let attempt = 0; attempt < 4; attempt++) {
        if ((await cookieClient.getPageContent(workspaceId, id)).includes(marker)) return true;
        await new Promise((r) => setTimeout(r, 1500));
      }
      return false;
    });
    // Replacing content goes through the Y.js editor socket, which needs a session cookie;
    // update_page_content reports this clearly in token mode (decision D5). Verify the
    // server really refuses a cookieless editor write.
    await measure(replaceRow, "token", async () => {
      const id = pageIds.token ?? pageIds.cookie;
      if (!id) throw new Error("no page created");
      const { writeContentViaWebSocket } = await import("../src/yjs-ws-writer.js");
      const res = await writeContentViaWebSocket(host, workspaceId, id, "", [{ type: "paragraph", children: [{ text: "x" }] }], { replace: true });
      return res.success;
    }, "restricted");

    // ─── Folders ───────────────────────────────────────────────────
    console.log("--- Folders ---");
    const folderRow = newRow("Folders", "Create + list folder");
    for (const [mode, client] of [["token", tokenClient], ["cookie", cookieClient]] as const) {
      await measure(folderRow, mode, async () => {
        const title = `[parity-test folder ${mode}] ${Date.now()}`;
        const folder = await client.createFolder(workspaceId, title);
        if (!folder?.globalId) return false;
        created.push({ id: folder.globalId, kind: `folder (${mode})` });
        // The folder list is eventually consistent; allow a few seconds for the new folder.
        for (let attempt = 0; attempt < 5; attempt++) {
          const folders = await client.listFolders(workspaceId);
          // The web menu prefixes ids ("notesFolder#<id>"); the list_folders tool strips it (COR-6).
          const ids = folders.map((f: any) => String(f.id ?? f.globalId ?? f.global_id).replace(/^notesFolder#/, ""));
          if (ids.includes(folder.globalId)) return true;
          await new Promise((r) => setTimeout(r, 1200));
        }
        return false;
      });
    }

    // ─── Databases ─────────────────────────────────────────────────
    console.log("--- Databases ---");
    const dbRow = newRow("Databases", "List databases");
    await measure(dbRow, "token", async () => {
      const res = await gateBridge.toolCall("getAllDatabases", {}, "dashboards");
      return Array.isArray(res.data?.data ?? res.data);
    });
    await measure(dbRow, "cookie", async () => Array.isArray(await cookieClient.listDatabases()));

    // ─── Gate-only capabilities ────────────────────────────────────
    console.log("--- Gate-only ---");
    const storesRow = newRow("Isolated stores", "List isolated SQL stores");
    await measure(storesRow, "token", async () => Array.isArray(await tokenClient.listIsolatedStores()));

    const tokensRow = newRow("Token management", "List tokens + permission catalog");
    await measure(tokensRow, "token", async () => {
      const tokens = await gateBridge.toolCall("listTokens", {}, "gate");
      const catalog = await gateBridge.toolCall("listPermissionCatalog", {}, "gate");
      return Boolean(tokens?.data ?? tokens) && Boolean(catalog?.data ?? catalog);
    });

    // ─── Cookie-only boundaries (verified, not assumed) ────────────
    console.log("--- Cookie-only boundaries ---");
    const wsSyncRow = newRow("CRDT", "Y.js WebSocket read");
    const { readContentViaWebSocket } = await import("../src/yjs-ws-writer.js");
    const probePage = pageIds.cookie;
    await measure(wsSyncRow, "cookie", async () => {
      if (!probePage) throw new Error("no page to read");
      return (await readContentViaWebSocket(host, workspaceId, probePage, cookie)).success;
    });
    await measure(wsSyncRow, "token", async () => {
      if (!probePage) throw new Error("no page to read");
      return (await readContentViaWebSocket(host, workspaceId, probePage, "")).success;
    }, "restricted");

    const apRow = newRow("Automations", "Automation engine auth");
    await measure(apRow, "cookie", async () => {
      const auth = await cookieClient.ensureAutomationAuth();
      return Boolean(auth.token && auth.projectId);
    });
    await measure(apRow, "token", async () => {
      const auth = await tokenClient.ensureAutomationAuth();
      return Boolean(auth.token && auth.projectId);
    }, "restricted");
  } finally {
    console.log("\n--- Cleanup ---");
    for (const item of created.reverse()) {
      try {
        await cookieClient.deletePage(workspaceId, item.id);
        console.log(`  deleted ${item.kind} ${item.id}`);
      } catch (err) {
        console.error(`  ⚠️ failed to delete ${item.kind} ${item.id}: ${errMsg(err)}`);
      }
    }
  }

  // ─── Report ──────────────────────────────────────────────────────
  console.log("\n| Domain | Feature | Token | Cookie |");
  console.log("|---|---|---|---|");
  for (const r of rows) console.log(`| ${r.domain} | ${r.feature} | ${r.token} | ${r.cookie} |`);
  const notes = rows.flatMap((r) => r.notes.map((n) => `- ${r.domain} / ${r.feature}: ${n}`));
  if (notes.length) console.log(`\nNotes:\n${notes.join("\n")}`);

  const failures = rows.filter((r) => r.token === "FAIL" || r.cookie === "FAIL");
  if (failures.length) {
    throw new Error(`${failures.length} parity row(s) failed: ${failures.map((r) => `${r.domain} / ${r.feature}`).join("; ")}`);
  }
}

runSuite("Token vs cookie parity", main);
