import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { publicErrorMessage } from "../../../src/error-redaction.js";

export interface OwnedFixture { kind: string; id: string; workspaceId?: string; sql?: {storeId:string; stage:"dev"; table:"qa_validation_events"; rowId:string; runId:string} }
export interface FixtureEvent {
  runId: string; workspaceId: string; orgId: string; attempt: string; tool: string;
  event: "started" | "completed" | "uncertain" | "reconciled";
  at: string; marker?: string; fixtures?: OwnedFixture[]; ids?: Record<string, string>; error?: string;
}
const localRun = randomUUID();
export function journalPath(): string {
  return resolve(process.env.LIVE_FIXTURE_JOURNAL || `scratch/live-runs/${process.env.LIVE_RUN_ID || localRun}/fixtures.jsonl`);
}
export function readJournal(file = journalPath()): FixtureEvent[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as FixtureEvent);
}
export function recordFixtureEvent(event: FixtureEvent, file = journalPath()): void {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(event) + "\n", { mode: 0o600 });
}
const creators: Record<string, string> = {
  move_page: "page", fusebase_swarm_init: "database", create_page: "page", create_interactive_app_page: "page", create_folder: "folder",
  create_database: "database", duplicate_database: "database", create_task: "task",
  create_automation_folder: "automation folder", create_automation_flow: "automation flow", fusebase_token_create: "token",
};
function owned(tool: string, value: unknown, workspaceId: string): OwnedFixture[] {
  const kind = creators[tool];
  if (!kind) return [];
  let data = value as Record<string, unknown> | undefined;
  for (let i = 0; i < 3 && data?.data && typeof data.data === "object"; i++) data = data.data as Record<string, unknown>;
  const id = data?.pageId ?? data?.globalId ?? data?.global_id ?? data?.id ?? data?.tokenId ?? data?.folderId ?? data?.databaseId;
  if (typeof id !== "string" || !id) throw new Error(`Created ${kind} has no recoverable identifier; inspect the fixture journal`);
  return [{ kind, id, workspaceId: typeof data?.destinationWorkspaceId === "string" ? data.destinationWorkspaceId : workspaceId }];
}

function plannedSqlFixtures(tool: string, args: Record<string, unknown>, workspaceId: string): OwnedFixture[] {
  if (!["insert_isolated_sql_row", "batch_insert_isolated_sql_rows"].includes(tool)) return [];
  if (args.stage !== "dev" || args.table !== "qa_validation_events" || typeof args.storeId !== "string") throw new Error("Live SQL fixtures require the designated QA table in dev");
  const rows = tool === "insert_isolated_sql_row" ? [args.row] : args.rows;
  if (!Array.isArray(rows)) throw new Error("SQL fixture rows missing");
  return rows.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new Error("SQL fixture row missing identity");
    const row = value as {id?:unknown; run_id?:unknown};
    if (typeof row.id !== "string" || typeof row.run_id !== "string" || !/^run-\d+$/.test(row.run_id) || !row.id.startsWith(row.run_id + "-")) throw new Error("SQL fixture requires exact run-scoped row IDs");
    const sql = {storeId:args.storeId as string,stage:"dev" as const,table:"qa_validation_events" as const,rowId:row.id,runId:row.run_id};
    return {kind:"SQL row",id:`${sql.storeId}/${sql.stage}/${sql.table}/${sql.rowId}`,workspaceId,sql};
  });
}

/** Journal before sending. An uncertain mutation is never repeated on another auth route. */
export async function journalMutation<T>(tool: string, args: Record<string, unknown>, send: () => Promise<T>): Promise<T> {
  const context = { runId: process.env.LIVE_RUN_ID || localRun, workspaceId: String(args.workspaceId || process.env.FUSEBASE_WORKSPACE_ID || ""), orgId: process.env.FUSEBASE_ORG_ID || "", attempt: randomUUID(), tool, at: new Date().toISOString() };
  const ids = Object.fromEntries(Object.entries(args).filter(([key, value]) => /^(workspaceId|pageId|folderId|databaseId|dashboardId|taskId|flowId|storeId|viewId|tokenId)$/.test(key) && typeof value === "string")) as Record<string, string>;
  const marker = creators[tool] ? [args.title, args.name, args.displayName].find(value => typeof value === "string") as string | undefined : undefined;
  const planned = plannedSqlFixtures(tool,args,context.workspaceId);
  recordFixtureEvent({ ...context, event: "started", ids, marker, fixtures:planned });
  try {
    const result = await send();
    recordFixtureEvent({ ...context, event: "completed", fixtures: [...planned, ...owned(tool, result, context.workspaceId)] });
    return result;
  } catch (error) {
    recordFixtureEvent({ ...context, event: "uncertain", fixtures:planned, error: publicErrorMessage(error) });
    throw error;
  }
}

export function ownedFixtures(events: FixtureEvent[], workspaceId: string, orgId: string): OwnedFixture[] {
  if (events.some(event => event.workspaceId !== workspaceId || event.orgId !== orgId)) throw new Error("Fixture journal belongs to another workspace or organization");
  const latest = new Map(events.map(event => [event.attempt, event]));
  const unresolved = [...latest.values()].filter(event => event.event === "started" || event.event === "uncertain");
  if (unresolved.length) throw new Error(`${unresolved.length} uncertain mutation(s); reconcile their exact IDs before cleanup. Journal retained.`);
  return [...latest.values()].flatMap(event => event.fixtures ?? []);
}

export async function coverageAttempt<T>(write: boolean, tokenCall: () => Promise<T>, cookieCall: () => Promise<T>): Promise<T> {
  try { return await tokenCall(); }
  catch (error) {
    if (write) throw new Error(`Token mutation outcome is unconfirmed; not replayed. Inspect the fixture journal before retrying. ${publicErrorMessage(error)}`, { cause: error });
    return cookieCall();
  }
}
