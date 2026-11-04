import { collectTaskPages } from "../../src/task-pagination.js";
/**
 * Leftover sweep: proves the live suites cleaned up after themselves.
 *
 *   npx tsx tests/live/sweep-sandbox.ts [--since=<ISO or ms>] [--clean]
 *
 * Reads FuseBase directly (the client, not the MCP tools the suites exercise) and reports:
 *  - LEFTOVERS: anything in the sandbox workspace created at or after --since (default:
 *    LIVE_RUN_STARTED_AT, set by scripts/test-all.ts). Any leftover fails the sweep.
 *  - ORPHANS: test-named content from earlier runs (e.g. a run that was killed). Reported only.
 * With --clean, deletes only exact IDs recorded in this run's fixture journal.
 * Names identify investigation candidates, never deletion authority.
 */
import { ownedFixtures, readJournal, journalPath } from "./lib/fixture-journal.js";
import { cleanOwned, ownedItems, paginate, paginateCursor } from "./lib/cleanup-policy.js";
import { loadEnvironment } from "../../src/config.js";
import { buildClient } from "../../src/client-factory.js";

await loadEnvironment();

const TEST_NAME = /\b(QA|E2E|Test|Probe|Parity|parity-test|Validation|Smoke)\b/i;

interface Item {
  kind: "page" | "folder" | "database" | "automation folder" | "automation flow" | "token" | "task" | "SQL row";
  id: string;
  name: string;
  workspaceId: string;
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
  for (const key of ["data", "items", "notes", "tasks", "flows", "results", "tokens"]) {
    if (Array.isArray(v?.[key])) return v[key];
    if (Array.isArray(v?.[key]?.data)) return v[key].data;
    if (v?.[key] && typeof v[key] === "object") { const nested = arrayIn(v[key]); if (nested.length) return nested; }
  }
  throw new Error("Listing has no recognized collection; refusing unverifiable cleanup");
}

async function main() {
  const workspaceId = process.env.FUSEBASE_WORKSPACE_ID;
  if (!workspaceId) throw new Error("Set FUSEBASE_WORKSPACE_ID to the sandbox workspace.");
  const sinceArg = process.argv.find((a) => a.startsWith("--since="))?.split("=")[1] ?? process.env.LIVE_RUN_STARTED_AT;
  const since = sinceArg ? toMs(sinceArg) : undefined;
  const clean = process.argv.includes("--clean");
  const client = buildClient();
  const owned = ownedFixtures(readJournal(), workspaceId, process.env.FUSEBASE_ORG_ID || "");
  const enumerate = async (): Promise<Item[]> => {
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
      const pages = await paginate(async (offset, limit) => client.listPages(workspaceId, { rootId, offset, limit }), p => p.globalId);
      for (const p of pages) {
        if (seen.has(p.globalId)) continue;
        seen.add(p.globalId);
        items.push({ workspaceId, kind: "page", id: p.globalId, name: p.title ?? "", created: created(p as any), remove: () => client.deletePage(workspaceId, p.globalId) });
      }
    }
  });
  await collect("folders", async () => {
    const walk = (folders: Array<Record<string, any>>, depth = 0) => {
      for (const f of folders) {
        const id = String(f.id ?? "").replace("notesFolder#", "");
        // "default" is the workspace's built-in Unsorted folder.
        if (id && id !== "default" && id !== "root") {
          items.push({ workspaceId, kind: "folder", id, name: f.name ?? "", created: created(f), remove: () => client.deletePage(workspaceId, id) });
        }
        if (Array.isArray(f.children) && depth < 50) walk(f.children, depth + 1);
      }
    };
    walk(await client.listFolders(workspaceId));
  });
  await collect("databases", async () => {
    for (const d of arrayIn(await client.listAllDatabases())) {
      items.push({ workspaceId, kind: "database", id: d.global_id, name: d.title ?? "", created: created(d), remove: () => client.deleteDatabase(d.global_id) });
    }
  });
  await collect("automation folders", async () => {
    for (const f of await paginateCursor(cursor => client.listAutomationFolders(cursor), arrayIn, f => String(f.id ?? ""))) {
      items.push({ workspaceId, kind: "automation folder", id: f.id, name: f.displayName ?? "", created: created(f), remove: () => client.deleteAutomationFolder(f.id) });
    }
  });
  await collect("automation flows", async () => {
    for (const f of await paginateCursor(cursor => client.listAutomationFlows(undefined, cursor), arrayIn, f => String(f.id ?? ""))) {
      const name = f.version?.displayName ?? f.displayName ?? "";
      items.push({ workspaceId, kind: "automation flow", id: f.id, name, created: created(f), remove: () => client.deleteAutomationFlow(f.id) });
    }
  });
  await collect("tokens", async () => {
    for (const t of await paginate(async (offset, limit) => ({ items: arrayIn(await client.listTokens({ limit, page: Math.floor(offset / limit) + 1 })) }), t => String(t.global_id ?? t.id ?? t.tokenId))) {
      if (t.revokedAt || t.revoked_at || t.status === "revoked") continue;
      const id = t.global_id ?? t.id ?? t.tokenId;
      if (typeof id !== "string" || !id) throw new Error("Token listing is missing its identifier; refusing unverifiable cleanup.");
      items.push({ workspaceId, kind: "token", id, name: t.name ?? "", created: created(t), remove: () => client.revokeToken(id) });
    }
  });
  await collect("tasks", async () => {
    const {tasks} = await collectTaskPages((offset, limit) => client.searchTasks(workspaceId, {limit,offset}), (task: import("../../src/types.js").FusebaseTask) => String(task.globalId ?? task.id ?? ""));
    for (const t of tasks) {
      const id = String(t.globalId ?? t.id);
      items.push({ workspaceId, kind: "task", id, name: String(t.title ?? t.name ?? ""), created: created(t), remove: () => client.deleteTask(workspaceId, id) });
    }
  });

  await collect("SQL rows", async () => {
    for (const fixture of owned.filter(item => item.kind === "SQL row")) {
      const sql = fixture.sql;
      if (!sql || sql.stage !== "dev" || sql.table !== "qa_validation_events" || !/^run-\d+$/.test(sql.runId) || !sql.rowId.startsWith(sql.runId + "-")) throw new Error("Invalid SQL ownership record; refusing cleanup");
      const result = await client.selectIsolatedStoreSqlRows(sql.storeId,sql.table,{stage:sql.stage,where:{id:sql.rowId},limit:2});
      if (!Array.isArray(result.rows)) throw new Error("SQL row lookup returned no collection");
      if (!result.rows.length) continue;
      if (result.rows.length !== 1 || result.rows[0].id !== sql.rowId || result.rows[0].run_id !== sql.runId) throw new Error("SQL fixture identity changed; refusing deletion");
      items.push({workspaceId,kind:"SQL row",id:fixture.id,name:sql.rowId,remove:()=>client.executeIsolatedStoreSql(sql.storeId,'DELETE FROM "qa_validation_events" WHERE id = $1 AND run_id = $2',[sql.rowId,sql.runId],"dev",true)});
    }
  });

  if (problems.length) throw new Error(`Sweep could not list all sources: ${problems.join("; ")}`);
  return items;
  };
  const items = await enumerate();
  // Pages, folders and tasks are sandbox-scoped; databases, automations and tokens are org-wide, so for
  // those only test-named items count.
  const scoped = (i: Item) => i.kind === "page" || i.kind === "folder" || i.kind === "task";
  const leftovers = items.filter((i) => since !== undefined && i.created !== undefined && i.created >= since && (scoped(i) || TEST_NAME.test(i.name)));
  const orphans = items.filter((i) => !leftovers.includes(i) && TEST_NAME.test(i.name));

  console.log(`🧹 Leftover sweep of sandbox ${workspaceId}${since ? ` (since ${new Date(since).toISOString()})` : " (no run start time: orphans only)"}`);
  const kinds: Item["kind"][] = ["page", "folder", "task", "database", "automation folder", "automation flow", "token", "SQL row"];
  console.log(`   checked ${items.length} items: ${kinds.map((k) => `${k}s ${items.filter((i) => i.kind === k).length}`).join(", ")}`);

  for (const i of leftovers) console.log(`   🔴 LEFTOVER ${i.kind} "${i.name}" (${i.id})`);
  for (const i of orphans) console.log(`   🟡 orphan from an earlier run: ${i.kind} "${i.name}" (${i.id})`);

  const confirmed = ownedItems(items, owned);
  if (clean) {
    if (!readJournal().length) throw new Error("Cleanup requires an exact-ID fixture journal; names never authorize deletion");
    await cleanOwned(confirmed, enumerate);
  } else if (confirmed.length) throw new Error(`${confirmed.length} owned fixture(s) remain`);
  const unowned = leftovers.filter(item => !confirmed.includes(item));
  if (unowned.length) throw new Error(`${unowned.length} unowned candidate(s) require investigation; none deleted`);
  console.log(`Sweep verified owned fixtures; ${orphans.length} historical candidates reported only. Journal: ${journalPath()}`);

}

main().catch((err) => {
  console.error(`❌ Leftover sweep failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
