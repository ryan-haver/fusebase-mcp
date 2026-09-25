/**
 * Leftover sweep: proves the live suites cleaned up after themselves.
 *
 *   npx tsx tests/live/sweep-sandbox.ts [--since=<ISO or ms>] [--clean]
 *
 * Reads FuseBase directly (the client, not the MCP tools the suites exercise) and reports:
 *  - LEFTOVERS: anything in the sandbox workspace created at or after --since (default:
 *    LIVE_RUN_STARTED_AT, set by scripts/test-all.ts). Any leftover fails the sweep.
 *  - ORPHANS: test-named content from earlier runs (e.g. a run that was killed). Reported only.
 * With --clean, deletes leftovers and orphans, but only items with a test-style name, so it
 * can never remove someone's real content.
 */
import { loadEnvironment } from "../../src/config.js";
import { buildClient } from "../../src/client-factory.js";

await loadEnvironment();

const TEST_NAME = /\b(QA|E2E|Test|Probe|Parity|parity-test|Validation|Smoke)\b/i;

interface Item {
  kind: "page" | "folder" | "database" | "automation folder" | "automation flow" | "token" | "task";
  id: string;
  name: string;
  created?: number; // ms
  remove: () => Promise<unknown>;
}

/** Parse a creation time given in seconds, milliseconds or ISO form. */
function toMs(v: unknown): number | undefined {
  if (typeof v === "number" && v > 0) return v < 1e12 ? v * 1000 : v;
  if (typeof v === "string" && v) {
    const n = Number(v);
    if (!Number.isNaN(n)) return toMs(n);
    const t = Date.parse(v);
    return Number.isNaN(t) ? undefined : t;
  }
  return undefined;
}

function created(o: Record<string, any>): number | undefined {
  return toMs(o.createdAt ?? o.created ?? o.created_at ?? o.dateAdded ?? o.metadata?.created_at ?? o.metadata?.createdAt);
}

function arrayIn(v: any): any[] {
  if (Array.isArray(v)) return v;
  for (const key of ["data", "items", "notes", "tasks", "flows", "results"]) {
    if (Array.isArray(v?.[key])) return v[key];
    if (Array.isArray(v?.[key]?.data)) return v[key].data;
  }
  return [];
}

async function main() {
  const workspaceId = process.env.FUSEBASE_WORKSPACE_ID;
  if (!workspaceId) throw new Error("Set FUSEBASE_WORKSPACE_ID to the sandbox workspace.");
  const sinceArg = process.argv.find((a) => a.startsWith("--since="))?.split("=")[1] ?? process.env.LIVE_RUN_STARTED_AT;
  const since = sinceArg ? toMs(sinceArg) : undefined;
  const clean = process.argv.includes("--clean");
  const client = buildClient();
  const items: Item[] = [];
  const problems: string[] = [];
  const collect = async (what: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      problems.push(`${what}: ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`);
    }
  };

  await collect("pages", async () => {
    const seen = new Set<string>();
    for (const rootId of ["default", "root"]) {
      const res = await client.listPages(workspaceId, { rootId, limit: 500 });
      for (const p of res.items ?? []) {
        if (seen.has(p.globalId)) continue;
        seen.add(p.globalId);
        items.push({ kind: "page", id: p.globalId, name: p.title ?? "", created: created(p as any), remove: () => client.deletePage(workspaceId, p.globalId) });
      }
    }
  });
  await collect("folders", async () => {
    const walk = (folders: Array<Record<string, any>>, depth = 0) => {
      for (const f of folders) {
        const id = String(f.id ?? "").replace("notesFolder#", "");
        // "default" is the workspace's built-in Unsorted folder.
        if (id && id !== "default" && id !== "root") {
          items.push({ kind: "folder", id, name: f.name ?? "", created: created(f), remove: () => client.deletePage(workspaceId, id) });
        }
        if (Array.isArray(f.children) && depth < 50) walk(f.children, depth + 1);
      }
    };
    walk(await client.listFolders(workspaceId));
  });
  await collect("databases", async () => {
    for (const d of arrayIn(await client.listAllDatabases())) {
      items.push({ kind: "database", id: d.global_id, name: d.title ?? "", created: created(d), remove: () => client.deleteDatabase(d.global_id) });
    }
  });
  await collect("automation folders", async () => {
    for (const f of arrayIn(await client.listAutomationFolders())) {
      items.push({ kind: "automation folder", id: f.id, name: f.displayName ?? "", created: created(f), remove: () => client.deleteAutomationFolder(f.id) });
    }
  });
  await collect("automation flows", async () => {
    for (const f of arrayIn(await client.listAutomationFlows())) {
      const name = f.version?.displayName ?? f.displayName ?? "";
      items.push({ kind: "automation flow", id: f.id, name, created: created(f), remove: () => client.deleteAutomationFlow(f.id) });
    }
  });
  await collect("tokens", async () => {
    for (const t of arrayIn(await client.listTokens({ limit: 100 }))) {
      if (t.revokedAt || t.revoked_at || t.status === "revoked") continue;
      items.push({ kind: "token", id: t.id ?? t.tokenId, name: t.name ?? "", created: created(t), remove: () => client.revokeToken(t.id ?? t.tokenId) });
    }
  });
  await collect("tasks", async () => {
    for (const t of arrayIn(await client.searchTasks(workspaceId, { limit: 200 }))) {
      const id = t.globalId ?? t.id;
      items.push({ kind: "task", id, name: t.title ?? t.name ?? "", created: created(t), remove: () => client.deleteTask(workspaceId, id) });
    }
  });

  // Pages, folders and tasks are sandbox-scoped; databases, automations and tokens are org-wide, so for
  // those only test-named items count.
  const scoped = (i: Item) => i.kind === "page" || i.kind === "folder" || i.kind === "task";
  const leftovers = items.filter((i) => since !== undefined && i.created !== undefined && i.created >= since && (scoped(i) || TEST_NAME.test(i.name)));
  const orphans = items.filter((i) => !leftovers.includes(i) && TEST_NAME.test(i.name));

  console.log(`🧹 Leftover sweep of sandbox ${workspaceId}${since ? ` (since ${new Date(since).toISOString()})` : " (no run start time: orphans only)"}`);
  const kinds: Item["kind"][] = ["page", "folder", "task", "database", "automation folder", "automation flow", "token"];
  console.log(`   checked ${items.length} items: ${kinds.map((k) => `${k}s ${items.filter((i) => i.kind === k).length}`).join(", ")}`);
  for (const p of problems) console.log(`   ⚠️  could not list ${p}`);
  for (const i of leftovers) console.log(`   🔴 LEFTOVER ${i.kind} "${i.name}" (${i.id})`);
  for (const i of orphans) console.log(`   🟡 orphan from an earlier run: ${i.kind} "${i.name}" (${i.id})`);

  if (clean) {
    for (const i of [...leftovers, ...orphans].filter((x) => TEST_NAME.test(x.name))) {
      try {
        await i.remove();
        console.log(`   🗑️  deleted ${i.kind} "${i.name}"`);
      } catch (err) {
        console.log(`   ⚠️  could not delete ${i.kind} "${i.name}": ${err instanceof Error ? err.message.slice(0, 150) : err}`);
      }
    }
  }

  if (problems.length > 0) throw new Error(`the sweep could not list everything (${problems.length} source(s) failed)`);
  if (leftovers.length > 0 && !clean) throw new Error(`${leftovers.length} item(s) created by this run were not cleaned up`);
  console.log(leftovers.length || orphans.length ? "✅ Sweep done" : "✅ No leftovers");
}

main().catch((err) => {
  console.error(`❌ Leftover sweep failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
