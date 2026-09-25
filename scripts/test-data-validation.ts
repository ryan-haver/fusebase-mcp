/**
 * Live Data Validation Suite for FuseBase MCP
 *
 * Exercises the registered MCP tools (extended tier) against live FuseBase infrastructure,
 * scoped to an explicitly configured sandbox workspace (FUSEBASE_WORKSPACE_ID or
 * --workspace=<id>; there is no fallback to "the first workspace").
 *
 * For each tool it checks the returned data shape (types, required fields, round-trips such as
 * create -> read -> update -> read -> delete) and treats error-shaped results as failures
 * (see scripts/lib/live-harness.ts#callTool).
 *
 * Optional capabilities that may legitimately be absent for an org (FuseBase CLI not installed,
 * Gate token not configured, automations / portals / AI features not enabled on the plan) are
 * recorded as explicit SKIPS with a reason and reported separately from passes. A tool that
 * errors for any other reason fails the suite. At the end, every registered tool must have been
 * either exercised or explicitly skipped.
 *
 * Entities the suite needs are created during the run and cleaned up afterwards. Known leak:
 * on first run only, the sandbox isolated SQL store 'qa-val-store' (no delete tool; reused on
 * later runs). Portal invite / magic-link checks send real email and only run when
 * FUSEBASE_TEST_INVITE_EMAIL is set.
 */

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  assert,
  assertArray,
  assertBoolean,
  assertEqual,
  assertIncludes,
  assertNumber,
  assertObject,
  assertString,
  callTool,
  connectMcp,
  ROOT_DIR,
  requireSandboxWorkspace,
  runSuite,
  knownGap,
  skip,
  stats,
  ToolError,
  duringCleanup,
  verifyWrite,
  noReadBack,
  readViewRepresentations,
  findUserVar,
} from "./lib/live-harness.js";
import * as path from "path";

// ─── Local helpers ──────────────────────────────────────────────────

/** Patterns identifying an optional capability that is absent for this org / environment. */
const GATE_UNAVAILABLE =
  /requires Gate MCP bridge|FUSEBASE_GATE_TOKEN|No token configured|not configured with any tokens|\b(402|403)\b|forbidden|not enabled|premium|upgrade/i;
const AUTOMATION_UNAVAILABLE = /\b(402|403)\b|forbidden|not enabled|not available|premium|upgrade|\bplan\b/i;

const SANDBOX_STORE_ALIAS = "qa-val-store";
/** Tests only ever touch the dev stage of the sandbox store. */
const SQL_STAGE = "dev";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function ok(tool: string, message: string): void {
  console.log(`✅ ${tool}: ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Parsed JSON payload (object or array), never an error string. */
function assertJson(val: unknown, field: string): void {
  assert(val !== null && typeof val === "object", `Expected '${field}' to be a JSON object or array, got: ${JSON.stringify(val)?.slice(0, 300)}`);
}

/**
 * Run a call for an optional capability. If the tool fails with an error matching `unavailable`,
 * record a skip and return undefined. Any other failure (including assertion failures) is rethrown.
 */
async function optional<T>(tool: string, unavailable: RegExp, fn: () => Promise<T>): Promise<{ value: T } | undefined> {
  try {
    return { value: await fn() };
  } catch (e) {
    if (e instanceof ToolError && unavailable.test(e.detail)) {
      skip(tool, `capability unavailable: ${e.detail.slice(0, 200)}`);
      return undefined;
    }
    throw e;
  }
}

function skipAll(tools: string[], reason: string): void {
  for (const t of tools) skip(t, reason);
}

/** Best-effort cleanup: never marks anything passed, never masks the original failure. */
async function cleanup(what: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await duringCleanup(fn);
  } catch (e) {
    console.error(`⚠️  Cleanup failed (${what}): ${errMsg(e).slice(0, 300)}`);
  }
}

/** Tools like fusebase_post_comment return "<status line>\n<json>". */
function parseTrailingJson(text: unknown, field: string, statusPrefix: string): any {
  assertString(text, field);
  assertIncludes(text, statusPrefix, field);
  const nl = text.indexOf("\n");
  assert(nl >= 0, `Expected '${field}' to contain a JSON body after the status line`);
  return JSON.parse(text.slice(nl + 1));
}

// ─── Read-back helpers (used inside verifyWrite checks) ─────────────

/** Errors that mean the entity no longer exists. */
const NOT_FOUND = /\b(404|410)\b|not[ _-]?found|does not exist|no longer exists/i;

/**
 * Run a read that should fail once its entity is deleted. Resolves `{ gone: true }` on a
 * not-found error, `{ gone: false, value }` when the read still succeeds; any other error is rethrown.
 */
async function readUnlessGone<T>(read: () => Promise<T>): Promise<{ gone: true } | { gone: false; value: T }> {
  try {
    return { gone: false, value: await read() };
  } catch (e) {
    if (e instanceof ToolError && NOT_FOUND.test(e.detail)) return { gone: true };
    throw e;
  }
}

/** Title (get_page) and, optionally, markdown content (get_page_content) of a page. */
async function expectPage(client: Client, workspaceId: string, pageId: string, title: string, texts: string[] = []): Promise<void> {
  const meta = await callTool(client, "get_page", { workspaceId, pageId });
  assertObject(meta, "get_page");
  assertEqual(meta.title, title, "page title");
  if (texts.length === 0) return;
  const md = await callTool(client, "get_page_content", { workspaceId, pageId, format: "markdown" });
  for (const text of texts) assertIncludes(md, text, `page ${pageId} content`);
}

/** A deleted page reads back as not found, or at least no longer appears in its folder listing. */
async function expectPageGone(client: Client, workspaceId: string, pageId: string, folderId = "root"): Promise<void> {
  const res = await readUnlessGone(() => callTool(client, "get_page", { workspaceId, pageId }));
  if (res.gone) return;
  const listed = await callTool(client, "list_pages", { workspaceId, folderId, limit: 1000 });
  assertArray(listed?.pages, "list_pages.pages");
  assert(!listed.pages.some((p: any) => p.id === pageId), `Deleted page ${pageId} is still readable and still listed in folder '${folderId}'`);
}

/** Rows of a database view (up to 200). */
async function readRows(client: Client, dashboardId: string, viewId: string): Promise<any[]> {
  const res = await callTool(client, "get_database_rows", { dashboardId, viewId, limit: 200 });
  assertObject(res, "get_database_rows response");
  assertArray(res.rows, "get_database_rows.rows");
  return res.rows;
}

/** Column schema of a database view. */
async function readSchema(client: Client, dashboardId: string, viewId: string): Promise<any[]> {
  const cols = await callTool(client, "get_database_schema", { dashboardId, viewId });
  assertArray(cols, "get_database_schema");
  return cols;
}

/** Assert a view's schema has column `key` with the given name (and type, if given). */
async function expectColumn(client: Client, dashboardId: string, viewId: string, key: string, name: string, type?: string): Promise<any> {
  const col = (await readSchema(client, dashboardId, viewId)).find((c: any) => c.key === key);
  assert(!!col, `Column ${key} ('${name}') not found in get_database_schema`);
  assertEqual(col.name, name, `column ${key} name`);
  if (type !== undefined) assertEqual(col.type, type, `column ${key} type`);
  return col;
}

/** get_database_detail's database object. */
async function readDatabase(client: Client, databaseId: string): Promise<any> {
  const detail = await callTool(client, "get_database_detail", { databaseId });
  const db = detail?.data ?? detail;
  assertObject(db, "get_database_detail.data");
  return db;
}

/** get_dashboard_detail's views. */
async function readViews(client: Client, dashboardId: string): Promise<any[]> {
  const detail = await callTool(client, "get_dashboard_detail", { dashboardId });
  const views = detail?.data?.views ?? detail?.views;
  assertArray(views, "get_dashboard_detail.data.views");
  return views;
}

/** The sidebarCollapsed user var in a get_user_preferences payload, or undefined when it isn't there. */
function sidebarCollapsedOf(prefs: unknown): boolean | undefined {
  // Live shape: a list of user vars, e.g. { name: "sidebarCollapsed", value: "0" }.
  const found = findUserVar(prefs, "sidebarCollapsed");
  if (!found) return undefined;
  const v = (found.value as any)?.value ?? found.value;
  if (v === "1" || v === 1 || v === true || v === "true") return true;
  if (v === "0" || v === 0 || v === false || v === "false") return false;
  return undefined;
}

/** Label cells hold label nanoids; map them back to option names (a value the API kept as a name stays). */
function labelNames(col: { labels?: Array<{ nanoid: string; name: string }> }, value: unknown): string[] {
  const items = value === null || value === undefined ? [] : Array.isArray(value) ? value : [value];
  return items.map((v) => {
    const s = String(v);
    return col.labels?.find((l) => l.nanoid === s)?.name ?? s;
  });
}

/** True when some object in a relation payload maps `source` to `target`. */
function hasRelationLink(payload: unknown, source: string, target: string): boolean {
  if (Array.isArray(payload)) return payload.some((v) => hasRelationLink(v, source, target));
  if (payload && typeof payload === "object") {
    const values = Object.values(payload as Record<string, unknown>);
    if (values.includes(source) && values.includes(target)) return true;
    return values.some((v) => hasRelationLink(v, source, target));
  }
  return false;
}

/** Tasks of a task list (list_task_lists) plus the workspace tasks whose title contains `query` (search_tasks). */
async function readTasks(client: Client, workspaceId: string, taskListId: string, query: string): Promise<any[]> {
  const listed = await callTool(client, "list_task_lists", { workspaceId, taskListId });
  const tasks: any[] = Array.isArray(listed?.tasks) ? [...listed.tasks] : [];
  const found = await callTool(client, "search_tasks", { workspaceId, query, limit: 100 });
  assertArray(found?.tasks, "search_tasks.tasks");
  tasks.push(...found.tasks);
  return tasks;
}

function taskIdOf(t: any): string {
  return String(t?.globalId ?? t?.id ?? t?.taskId ?? "");
}

/** Automation flow runs as an array (list_flow_runs returns a page object or an array). */
async function readFlowRuns(client: Client): Promise<any[]> {
  const runs = await callTool(client, "list_flow_runs", { limit: 50 });
  const list = Array.isArray(runs) ? runs : runs?.data;
  assertArray(list, "list_flow_runs (array or { data })");
  return list;
}

function suiteHeader(title: string): void {
  console.log("\n==================================================");
  console.log(title);
  console.log("==================================================");
}

// ─── Main Test Runner ───────────────────────────────────────────────

async function main() {
  console.log("================================================================================");
  console.log("                FUSEBASE MCP LIVE DATA VALIDATION SUITE (SANDBOX)               ");
  console.log("================================================================================\n");

  const targetWsId = requireSandboxWorkspace();

  const client = await connectMcp("fusebase-data-validator", { tier: "all" });
  try {
    await runAllSuites(client, targetWsId);
  } finally {
    await client.close().catch((e) => console.error(`⚠️  Failed to close MCP client: ${errMsg(e)}`));
  }
}

async function runAllSuites(client: Client, targetWsId: string) {
  console.log("✅ Connected to MCP Server via stdio.\n");

  const toolsList = await client.listTools();
  assertArray(toolsList.tools, "listTools().tools", 1);
  console.log(`[Setup] Registered MCP tools: ${toolsList.tools.length}`);

  // ──────────────────────────────────────────────────────────────────
  // Suite 1: Workspaces & Organizations
  // ──────────────────────────────────────────────────────────────────
  suiteHeader("SUITE 1: Workspaces & Organizations");

  const workspaces = await callTool(client, "list_workspaces");
  assertArray(workspaces, "list_workspaces", 1);
  const targetWs = workspaces.find((w: any) => w.workspaceId === targetWsId);
  assert(!!targetWs, `Sandbox workspace ${targetWsId} (FUSEBASE_WORKSPACE_ID) not found in list_workspaces`);
  assertString(targetWs.workspaceId, "workspaceId");
  assertString(targetWs.orgId, "orgId");
  assertString(targetWs.title, "title");
  const orgId: string = targetWs.orgId;
  ok("list_workspaces", `Found ${workspaces.length} workspaces. Sandbox: "${targetWs.title}" (${targetWsId}) [Org: ${orgId}]`);

  const wsInfo = await callTool(client, "get_workspace_info", { workspaceId: targetWsId });
  assertObject(wsInfo, "get_workspace_info");
  assert(Object.keys(wsInfo).length > 0, "get_workspace_info should contain billing or quota details");
  ok("get_workspace_info", "Validated workspace metadata");

  const wsDetail = await callTool(client, "get_workspace_detail", { workspaceId: targetWsId });
  assertObject(wsDetail, "get_workspace_detail");
  ok("get_workspace_detail", "Validated workspace detail properties");

  const wsEmails = await callTool(client, "get_workspace_emails", { workspaceId: targetWsId });
  assertJson(wsEmails, "get_workspace_emails");
  ok("get_workspace_emails", "Validated routing email schema");

  const wsMembersV1 = await callTool(client, "get_workspace_members_v1", { workspaceId: targetWsId });
  assertArray(wsMembersV1, "get_workspace_members_v1");
  ok("get_workspace_members_v1", `Validated members array (${wsMembersV1.length} members)`);

  const members = await callTool(client, "get_members", { workspaceId: targetWsId });
  assertArray(members, "get_members", 1);
  assertString(members[0].id || members[0].userId, "member id");
  ok("get_members", `Validated member accounts (${members.length} members)`);

  const orgFeatures = await callTool(client, "get_org_features", { orgId });
  assertJson(orgFeatures, "get_org_features");
  ok("get_org_features", "Validated organization feature flags");

  const orgLimits = await callTool(client, "get_org_limits", { orgId });
  assertObject(orgLimits, "get_org_limits");
  ok("get_org_limits", "Validated quota and limits structure");

  const orgPerms = await callTool(client, "get_org_permissions", { orgId });
  assertJson(orgPerms, "get_org_permissions");
  ok("get_org_permissions", "Validated RBAC permission definitions");

  const orgUsage = await callTool(client, "get_org_usage", { orgId });
  assertJson(orgUsage, "get_org_usage");
  ok("get_org_usage", "Validated organization storage/seat usage");

  const usageSummary = await callTool(client, "get_usage_summary");
  assertJson(usageSummary, "get_usage_summary");
  ok("get_usage_summary", "Validated platform usage summary");

  const orgTrials = await callTool(client, "get_org_trials", { orgId });
  assertJson(orgTrials, "get_org_trials");
  ok("get_org_trials", "Validated organization trials structure");

  // ──────────────────────────────────────────────────────────────────
  // Suite 2: Folders & Taxonomy
  // ──────────────────────────────────────────────────────────────────
  suiteHeader("SUITE 2: Folders & Taxonomy");

  const labels = await callTool(client, "get_labels", { workspaceId: targetWsId });
  assertArray(labels, "get_labels");
  ok("get_labels", `Validated workspace labels (${labels.length} labels)`);

  const folderTitle = `Data Validation Folder ${Date.now()}`;
  const createFolderRes = await callTool(client, "create_folder", { workspaceId: targetWsId, title: folderTitle });
  assertObject(createFolderRes, "create_folder");
  const folderId = createFolderRes.globalId || createFolderRes.id || createFolderRes.folderId;
  assertString(folderId, "created folderId");
  ok("create_folder", `Created folder '${folderTitle}' with ID ${folderId}`);

  // Folders are notes, so delete_page removes them; there is no dedicated delete_folder tool.
  // The folder is kept until Suite 3 has moved a page into it and back out.
  const deleteFolder = () => cleanup(`delete folder ${folderId}`, () => callTool(client, "delete_page", { workspaceId: targetWsId, pageId: folderId }));
  let folders: any[] = [];
  try {
    await verifyWrite("create_folder", `folder ${folderId} listed with name '${folderTitle}'`, async () => {
      folders = await callTool(client, "list_folders", { workspaceId: targetWsId });
      assertArray(folders, "list_folders", 1);
      // list_folders nests subfolders under `children`.
      const flat: any[] = [];
      const collect = (items: any[]): void => {
        for (const f of items) {
          flat.push(f);
          if (Array.isArray(f.children)) collect(f.children);
        }
      };
      collect(folders);
      const foundFolder = flat.find((f: any) => f.id === folderId || f.globalId === folderId || f.name === folderTitle || f.title === folderTitle);
      assert(!!foundFolder, `Expected newly created folder ${folderId} to appear in list_folders`);
      assertEqual(foundFolder.name ?? foundFolder.title, folderTitle, "listed folder name");
    });
  } catch (e) {
    await deleteFolder();
    throw e;
  }
  ok("list_folders", `Verified folder presence in workspace (${folders.length} folders)`);

  // ──────────────────────────────────────────────────────────────────
  // Suite 3: Pages & Collaborative Y.js Content
  // ──────────────────────────────────────────────────────────────────
  suiteHeader("SUITE 3: Pages & Collaborative Y.js Content");

  const testPageTitle = `Validation Note ${Date.now()}`;
  const createPageRes = await callTool(client, "create_page", {
    workspaceId: targetWsId,
    title: testPageTitle,
    markdown: "# Original Header\n\nThis is the initial body text.",
  });
  assertObject(createPageRes, "create_page response");
  let pageId = createPageRes.id;
  assertString(pageId, "created pageId");
  ok("create_page", `Created page '${testPageTitle}' with ID ${pageId}`);

  let pageDeleted = false;
  try {
    await verifyWrite("create_page", `page ${pageId} has title '${testPageTitle}' and its initial markdown`, () =>
      expectPage(client, targetWsId, pageId, testPageTitle, ["Original Header", "This is the initial body text."]),
    );
    ok("get_page", "Verified metadata matches created note");

    const listPagesData = await callTool(client, "list_pages", { workspaceId: targetWsId });
    assertObject(listPagesData, "list_pages response");
    assertArray(listPagesData.pages, "list_pages.pages", 1);
    const pageInList = listPagesData.pages.find((p: any) => p.id === pageId || p.title === testPageTitle);
    assert(!!pageInList, "Page must be present in list_pages");
    ok("list_pages", `Verified page presence in workspace (${listPagesData.pages.length} pages, total: ${listPagesData.total})`);

    const recentPagesData = await callTool(client, "get_recent_pages", { workspaceId: targetWsId });
    assertObject(recentPagesData, "get_recent_pages response");
    assertArray(recentPagesData.pages, "recentPagesData.pages");
    ok("get_recent_pages", `Verified recent pages array (${recentPagesData.pages.length} items)`);

    const recentUpdated = await callTool(client, "get_recently_updated_notes");
    assertJson(recentUpdated, "get_recently_updated_notes");
    ok("get_recently_updated_notes", "Validated updated notes response");

    const updatedTitle = `${testPageTitle} (Renamed)`;
    const updatePageRes = await callTool(client, "update_page", { workspaceId: targetWsId, pageId, title: updatedTitle });
    assertIncludes(updatePageRes, `Page ${pageId} updated`, "update_page response");
    await verifyWrite("update_page", `page ${pageId} title reads back as '${updatedTitle}'`, async () => {
      const recheckMeta = await callTool(client, "get_page", { workspaceId: targetWsId, pageId });
      assertEqual(recheckMeta.title, updatedTitle, "renamed page title");
    });
    ok("update_page", "Verified title update round-trip");

    await sleep(2000);
    const appendRes = await callTool(client, "append_page_content", {
      workspaceId: targetWsId,
      pageId,
      markdown: "## Appended Verification Section\n\nAppended paragraph with unique token 987654.",
    });
    assertIncludes(appendRes, "Successfully appended content", "append_page_content response");
    ok("append_page_content", "Append acknowledged");

    // verifyWrite retries both reads until the appended section has synced.
    await verifyWrite("append_page_content", `page ${pageId} keeps its original header and gains the appended section (html + markdown)`, async () => {
      const readHtml = await callTool(client, "get_page_content", { workspaceId: targetWsId, pageId, format: "html" });
      assertString(readHtml, "get_page_content (html)");
      assertIncludes(readHtml, "Original Header", "readHtml original header");
      assertIncludes(readHtml, "Appended Verification Section", "readHtml appended section");

      const readMd = await callTool(client, "get_page_content", { workspaceId: targetWsId, pageId, format: "markdown" });
      assertString(readMd, "get_page_content (markdown)");
      assertIncludes(readMd, "Original Header", "readMd original header");
      assertIncludes(readMd, "Appended Verification Section", "readMd appended section");
      assertIncludes(readMd, "987654", "readMd unique token");
    });
    ok("get_page_content (html)", "Verified original + appended HTML content fidelity");
    ok("get_page_content (markdown)", "Verified markdown format fidelity");

    const replaceRes = await callTool(client, "update_page_content", {
      workspaceId: targetWsId,
      pageId,
      markdown: "# Replaced Entire Note\n\nAll previous content replaced by clean validation text.",
    });
    assertIncludes(replaceRes, "Content written successfully", "update_page_content response");
    await verifyWrite("update_page_content", `page ${pageId} content replaced: new text present, original and appended text gone`, async () => {
      const replacedMd = await callTool(client, "get_page_content", { workspaceId: targetWsId, pageId, format: "markdown" });
      assertIncludes(replacedMd, "Replaced Entire Note", "update_page_content readback");
      assertIncludes(replacedMd, "All previous content replaced by clean validation text.", "update_page_content readback body");
      assert(!String(replacedMd).includes("Original Header"), "Replaced page should no longer contain 'Original Header'");
      assert(!String(replacedMd).includes("987654"), "Replaced page should no longer contain the appended token 987654");
    });
    ok("update_page_content", "Verified full content replacement round-trip");

    // Move the page (created at root) into the Suite 2 folder, then back to root.
    const rootMeta = await callTool(client, "get_page", { workspaceId: targetWsId, pageId });
    const rootParentId = rootMeta?.parentId;
    assertString(rootParentId, "get_page.parentId before the move");
    assert(rootParentId !== folderId, `Page ${pageId} should start outside folder ${folderId}`);
    /** Assert get_page reports `parentId`. */
    const expectParent = async (parentId: string): Promise<void> => {
      const meta = await callTool(client, "get_page", { workspaceId: targetWsId, pageId });
      assertObject(meta, "get_page");
      assertEqual(meta.parentId, parentId, "get_page.parentId");
    };

    // move_page may give the page a new id (COR-26); follow the id it returns.
    const idBeforeMoveIn = pageId;
    const moveInRes = await callTool(client, "move_page", { workspaceId: targetWsId, pageId, folderId });
    assertObject(moveInRes, "move_page response (into folder)");
    assertEqual(moveInRes.success, true, "move_page.success (into folder)");
    assertEqual(moveInRes.destinationFolderId, folderId, "move_page.destinationFolderId (into folder)");
    assertString(moveInRes.pageId, "move_page.pageId (into folder)");
    pageId = moveInRes.pageId;
    await verifyWrite("move_page", `page ${pageId} has parentId ${folderId} (the Suite 2 folder)`, async () => {
      await expectParent(folderId);
      if (pageId !== idBeforeMoveIn) {
        const old = await readUnlessGone(() => callTool(client, "get_page", { workspaceId: targetWsId, pageId: idBeforeMoveIn }));
        assert(old.gone, `page ${idBeforeMoveIn} should be gone under its old id after move_page gave it id ${pageId}`);
      }
    });

    const moveRes = await callTool(client, "move_page", { workspaceId: targetWsId, pageId, folderId: "root" });
    assertObject(moveRes, "move_page response");
    assertEqual(moveRes.success, true, "move_page.success");
    assertEqual(moveRes.destinationFolderId, "root", "move_page.destinationFolderId");
    assertString(moveRes.pageId, "move_page.pageId (to root)");
    pageId = moveRes.pageId;
    await verifyWrite("move_page", `page ${pageId} is back at the top level: parentId ${rootParentId}, listed in the default folder and no longer in folder ${folderId}`, async () => {
      await expectParent(rootParentId);
      // Top-level pages live in the default (Unsorted) folder; the "root" listing covers the whole workspace.
      const topLevel = await callTool(client, "list_pages", { workspaceId: targetWsId, folderId: "default", limit: 1000 });
      assertArray(topLevel?.pages, "list_pages(default).pages", 1);
      assert(topLevel.pages.some((p: any) => p.id === pageId), `Moved page ${pageId} should be listed at the top level (default folder)`);
      const inFolder = await callTool(client, "list_pages", { workspaceId: targetWsId, folderId, limit: 1000 });
      assert(!(inFolder?.pages ?? []).some((p: any) => p.id === pageId), `Moved page ${pageId} should no longer be in folder ${folderId}`);
    });
    ok("move_page", "Moved page into a folder and back to workspace root");

    const deletePageRes = await callTool(client, "delete_page", { workspaceId: targetWsId, pageId });
    assertIncludes(deletePageRes, "deleted successfully", "delete_page response");
    pageDeleted = true;
    await verifyWrite("delete_page", `page ${pageId} is gone (get_page not found, or no longer listed in root)`, () =>
      expectPageGone(client, targetWsId, pageId),
    );
    ok("delete_page", `Deleted test page ${pageId}`);
  } finally {
    if (!pageDeleted) await cleanup(`delete page ${pageId}`, () => callTool(client, "delete_page", { workspaceId: targetWsId, pageId }));
    await deleteFolder();
  }

  // ──────────────────────────────────────────────────────────────────
  // Suite 4: Tags, Files & Attachments
  // ──────────────────────────────────────────────────────────────────
  suiteHeader("SUITE 4: Tags, Files & Attachments");

  const tagPageTitle = `Tags & Files Test Page ${Date.now()}`;
  const tagNoteRes = await callTool(client, "create_page", {
    workspaceId: targetWsId,
    title: tagPageTitle,
    markdown: "# Tags and Attachments Testing",
  });
  assertObject(tagNoteRes, "create_page (tags page)");
  const tagPageId = tagNoteRes.id;
  assertString(tagPageId, "tagPageId");

  try {
    await verifyWrite("create_page", `tags page ${tagPageId} has its title and heading`, () =>
      expectPage(client, targetWsId, tagPageId, tagPageTitle, ["Tags and Attachments Testing"]),
    );

    const tagsData = await callTool(client, "get_tags", { workspaceId: targetWsId });
    const tagsList = Array.isArray(tagsData) ? tagsData : tagsData?.tags;
    assertArray(tagsList, "get_tags (array or { tags: [] })");
    ok("get_tags", `Validated workspace tags (${tagsList.length} tags)`);

    const testTags = ["qa-audit-test", "val-tag-2"];
    const tagUpdateRes = await callTool(client, "update_page_tags", { workspaceId: targetWsId, pageId: tagPageId, tags: testTags });
    assertIncludes(tagUpdateRes, `Tags updated on page ${tagPageId}`, "update_page_tags response");
    ok("update_page_tags", "Updated page tags");

    await verifyWrite("update_page_tags", `page ${tagPageId} carries tags ${testTags.join(", ")}`, async () => {
      const noteTags = await callTool(client, "get_note_tags", { workspaceId: targetWsId, pageId: tagPageId });
      assertJson(noteTags, "get_note_tags");
      for (const tag of testTags) assertIncludes(JSON.stringify(noteTags), tag, `get_note_tags contains applied tag '${tag}'`);
    });
    ok("get_note_tags", "Verified page tags round-trip");

    const fileCount = await callTool(client, "get_file_count", { workspaceId: targetWsId });
    assertString(fileCount, "fileCount text");
    assert(/Total files: \d+/.test(fileCount), `get_file_count should report 'Total files: N', got: ${fileCount}`);
    ok("get_file_count", `Validated workspace file count (${fileCount})`);

    const files = await callTool(client, "list_files", { workspaceId: targetWsId });
    assertArray(files, "list_files");
    ok("list_files", `Validated files array (${files.length} files)`);

    const fixtureText = "FuseBase MCP Data Validation Fixture Bytes";
    const uploadRes = await callTool(client, "upload_file", {
      workspaceId: targetWsId,
      pageId: tagPageId,
      filename: "qa-val-fixture.txt",
      content: Buffer.from(fixtureText).toString("base64"),
    });
    assertObject(uploadRes, "upload_file response");
    assertEqual(uploadRes.success, true, "upload_file.success");
    const attachmentId = uploadRes.attachmentId;
    assertString(attachmentId, "upload_file.attachmentId");
    ok("upload_file", `Uploaded fixture file (Attachment ID: ${attachmentId})`);

    let attachmentCount = 0;
    await verifyWrite("upload_file", `attachment ${attachmentId} listed on page ${tagPageId} as 'qa-val-fixture.txt' and downloads with the fixture bytes`, async () => {
      const attachments = await callTool(client, "get_page_attachments", { workspaceId: targetWsId, pageId: tagPageId });
      assertArray(attachments, "get_page_attachments", 1);
      attachmentCount = attachments.length;
      const listed = attachments.find((a: any) => a.id === attachmentId);
      assert(!!listed, `Uploaded attachment ${attachmentId} should be listed by get_page_attachments`);
      assertEqual(listed.name, "qa-val-fixture.txt", "listed attachment name");

      const downloadRes = await callTool(client, "download_attachment", {
        workspaceId: targetWsId,
        attachmentId,
        filename: "qa-val-fixture.txt",
      });
      assertObject(downloadRes, "download_attachment response");
      assertString(downloadRes.base64, "download_attachment.base64");
      assertIncludes(Buffer.from(downloadRes.base64, "base64").toString("utf8"), fixtureText, "downloaded fixture bytes");
    });
    ok("get_page_attachments", `Validated page attachments list (${attachmentCount} items)`);
    ok("download_attachment", "Downloaded attachment and verified content round-trip");
  } finally {
    await cleanup(`delete page ${tagPageId}`, () => callTool(client, "delete_page", { workspaceId: targetWsId, pageId: tagPageId }));
  }

  // ──────────────────────────────────────────────────────────────────
  // Suite 5: Comments, Threads & Mentions
  // ──────────────────────────────────────────────────────────────────
  suiteHeader("SUITE 5: Comments, Threads & Mentions");

  const activityStream = await callTool(client, "get_activity_stream", { workspaceId: targetWsId });
  assertJson(activityStream, "get_activity_stream");
  ok("get_activity_stream", "Validated activity stream response");

  const mentions = await callTool(client, "fusebase_poll_mentions", { workspaceId: targetWsId });
  assertJson(mentions, "fusebase_poll_mentions");
  ok("fusebase_poll_mentions", "Polled mention notifications");

  const mentionEntities = await callTool(client, "get_mention_entities", { workspaceId: targetWsId });
  assertJson(mentionEntities, "get_mention_entities");
  ok("get_mention_entities", "Validated mentionable entities list");

  const commentPageTitle = `Comment Lifecycle Test Page ${Date.now()}`;
  const commentPageRes = await callTool(client, "create_page", {
    workspaceId: targetWsId,
    title: commentPageTitle,
    markdown: "# Comments Testing",
  });
  assertObject(commentPageRes, "create_page (comment page)");
  const commentPageId = commentPageRes.id;
  assertString(commentPageId, "commentPageId");

  try {
    await verifyWrite("create_page", `comment page ${commentPageId} has its title and heading`, () =>
      expectPage(client, targetWsId, commentPageId, commentPageTitle, ["Comments Testing"]),
    );

    const commentText = "Data validation automated thread comment";
    const postCommentRes = await callTool(client, "fusebase_post_comment", {
      workspaceId: targetWsId,
      noteId: commentPageId,
      text: commentText,
    });
    const postedThread = parseTrailingJson(postCommentRes, "fusebase_post_comment", "Comment posted successfully.");
    assertJson(postedThread, "fusebase_post_comment body");
    ok("fusebase_post_comment", `Posted comment to note ${commentPageId}`);

    // Live shape: [{ thread: { globalId, noteGlobalId, resolved, ... }, comments, unreadComments,
    //   commentList: [{ id, text, replyTo, userId, createdAt }] }]
    /** The thread on the comment page with a comment whose text is exactly `text`. */
    const findThread = async (text: string): Promise<any> => {
      const threads = await callTool(client, "get_comment_threads", { workspaceId: targetWsId, pageId: commentPageId });
      assertArray(threads, "get_comment_threads", 1);
      const entry = threads.find((t: any) => Array.isArray(t.commentList) && t.commentList.some((c: any) => c.text === text));
      assert(!!entry, `get_comment_threads should contain a thread with the comment '${text}'`);
      return entry;
    };
    let threadId = "";
    await verifyWrite("fusebase_post_comment", `thread on page ${commentPageId} contains '${commentText}'`, async () => {
      const entry = await findThread(commentText);
      assertString(entry.thread?.globalId, "comment thread.globalId");
      assertEqual(entry.thread?.noteGlobalId, commentPageId, "comment thread.noteGlobalId");
      threadId = entry.thread.globalId;
    });
    ok("get_comment_threads", `Verified thread retrieval (Thread: ${threadId})`);

    const replyText = "Automated reply comment test";
    const replyRes = await callTool(client, "fusebase_reply_comment", {
      workspaceId: targetWsId,
      threadId,
      text: replyText,
    });
    parseTrailingJson(replyRes, "fusebase_reply_comment", "Reply posted successfully.");
    await verifyWrite("fusebase_reply_comment", `thread ${threadId} contains the reply '${replyText}'`, async () => {
      const entry = await findThread(replyText);
      assertEqual(entry.thread?.globalId, threadId, "replied thread.globalId");
    });
    ok("fusebase_reply_comment", "Posted comment reply");

    const resolveRes = await callTool(client, "fusebase_resolve_thread", { workspaceId: targetWsId, threadId });
    parseTrailingJson(resolveRes, "fusebase_resolve_thread", "Thread resolved successfully.");
    await verifyWrite("fusebase_resolve_thread", `thread ${threadId} reads back as resolved`, async () => {
      const threads = await callTool(client, "get_comment_threads", { workspaceId: targetWsId, pageId: commentPageId });
      assertArray(threads, "get_comment_threads", 1);
      const entry = threads.find((t: any) => t.thread?.globalId === threadId);
      assert(!!entry, `Resolved thread ${threadId} should still be returned by get_comment_threads`);
      assertEqual(entry.thread?.resolved, true, "thread.resolved");
    });
    ok("fusebase_resolve_thread", "Resolved comment thread");
  } finally {
    await cleanup(`delete page ${commentPageId}`, () => callTool(client, "delete_page", { workspaceId: targetWsId, pageId: commentPageId }));
  }

  // ──────────────────────────────────────────────────────────────────
  // Suite 6: Tasks & Project Management
  // ──────────────────────────────────────────────────────────────────
  suiteHeader("SUITE 6: Tasks & Project Management");

  const taskCount = await callTool(client, "get_task_count", { workspaceId: targetWsId });
  assertString(taskCount, "get_task_count");
  assert(/has \d+ tasks/.test(taskCount), `get_task_count should report 'has N tasks', got: ${taskCount}`);
  ok("get_task_count", taskCount);

  const taskUsage = await callTool(client, "get_task_usage", { workspaceId: targetWsId });
  assertJson(taskUsage, "get_task_usage");
  ok("get_task_usage", "Validated task metrics and quotas");

  const taskSummary = await callTool(client, "get_tasks_workspace_summary");
  assertArray(taskSummary, "get_tasks_workspace_summary");
  ok("get_tasks_workspace_summary", `Validated summary list (${taskSummary.length} workspaces)`);

  const taskListsRes = await callTool(client, "list_task_lists", { workspaceId: targetWsId });
  const taskLists = Array.isArray(taskListsRes) ? taskListsRes : taskListsRes?.taskLists;
  assertArray(taskLists, "list_task_lists");
  ok("list_task_lists", `Found ${taskLists.length} task lists`);

  const taskTools = ["create_task", "get_task_description", "get_task_time_tracking", "update_task", "search_tasks", "delete_task"];
  if (taskLists.length === 0) {
    skipAll(taskTools, "sandbox workspace has no task list (no MCP tool creates one); create a task list to exercise task CRUD");
  } else {
    const taskListId = taskLists[0].globalId || taskLists[0].id;
    assertString(taskListId, "taskListId");

    const taskTitle = `Data Validation Task ${Date.now()}`;
    const createTaskRes = await callTool(client, "create_task", { workspaceId: targetWsId, title: taskTitle, taskListId });
    assertObject(createTaskRes, "create_task response");
    const rawTaskId = createTaskRes.globalId ?? createTaskRes.id ?? createTaskRes.taskId;
    assert(typeof rawTaskId === "string" || typeof rawTaskId === "number", `create_task should return an id, got: ${JSON.stringify(rawTaskId)}`);
    const taskId = String(rawTaskId);
    assertString(taskId, "created taskId");
    ok("create_task", `Created task '${taskTitle}' (ID: ${taskId})`);

    let taskDeleted = false;
    try {
      await verifyWrite("create_task", `task ${taskId} exists in list ${taskListId} with title '${taskTitle}'`, async () => {
        const task = (await readTasks(client, targetWsId, taskListId, taskTitle)).find((t) => taskIdOf(t) === taskId);
        assert(!!task, `Created task ${taskId} should be returned by list_task_lists / search_tasks`);
        assertEqual(task.title, taskTitle, "task title");
      });

      const taskDesc = await callTool(client, "get_task_description", { workspaceId: targetWsId, taskId });
      assertJson(taskDesc, "get_task_description");
      ok("get_task_description", "Verified task details readback");

      const timeTracking = await callTool(client, "get_task_time_tracking", { workspaceId: targetWsId, taskId });
      assertJson(timeTracking, "get_task_time_tracking");
      ok("get_task_time_tracking", "Validated time tracking attributes");

      const updatedTaskTitle = `${taskTitle} (Updated & Done)`;
      const updateTaskRes = await callTool(client, "update_task", { workspaceId: targetWsId, taskId, title: updatedTaskTitle, completed: true });
      assertObject(updateTaskRes, "update_task response");
      await verifyWrite("update_task", `task ${taskId} reads back with title '${updatedTaskTitle}' and done: true`, async () => {
        const task = (await readTasks(client, targetWsId, taskListId, taskTitle)).find((t) => taskIdOf(t) === taskId);
        assert(!!task, `Updated task ${taskId} should be returned by list_task_lists / search_tasks`);
        assertEqual(task.title, updatedTaskTitle, "updated task title");
        assertEqual(task.done, true, "updated task done");
      });
      ok("update_task", "Updated task title and marked completed");

      const searchTasksRes = await callTool(client, "search_tasks", { workspaceId: targetWsId, query: taskTitle });
      assertJson(searchTasksRes, "search_tasks");
      assertArray(searchTasksRes.tasks, "search_tasks.tasks", 1);
      const hit = searchTasksRes.tasks.find((t: any) => taskIdOf(t) === taskId);
      assert(!!hit, `search_tasks(query '${taskTitle}') should find task ${taskId}`);
      assertEqual(hit.title, updatedTaskTitle, "search_tasks hit title");
      assert(searchTasksRes.tasks.every((t: any) => String(t.title ?? "").toLowerCase().includes(taskTitle.toLowerCase())), "search_tasks should only return tasks whose title contains the query");
      ok("search_tasks", `Searched tasks by query (${searchTasksRes.tasks.length} hits)`);

      const deleteTaskRes = await callTool(client, "delete_task", { workspaceId: targetWsId, taskId });
      assertIncludes(deleteTaskRes, "deleted successfully", "delete_task response");
      taskDeleted = true;
      await verifyWrite("delete_task", `task ${taskId} no longer returned by list_task_lists / search_tasks`, async () => {
        const tasks = await readTasks(client, targetWsId, taskListId, taskTitle);
        assert(!tasks.some((t) => taskIdOf(t) === taskId), `Deleted task ${taskId} is still returned`);
      });
      ok("delete_task", `Deleted test task ${taskId}`);
    } finally {
      if (!taskDeleted) await cleanup(`delete task ${taskId}`, () => callTool(client, "delete_task", { workspaceId: targetWsId, taskId }));
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Suite 7: Databases, Views, Columns, Rows, Relations & Formulas
  // ──────────────────────────────────────────────────────────────────
  suiteHeader("SUITE 7: Databases, Views, Columns, Rows, Relations & Formulas");

  const dbTitle = `QA Data Validation DB ${Date.now()}`;
  const createDbRes = await callTool(client, "create_database", { title: dbTitle });
  assertObject(createDbRes, "create_database response");
  const databaseId = createDbRes.databaseId || createDbRes.id;
  const dashboardId = createDbRes.dashboardId;
  const viewId = createDbRes.viewId;
  assertString(databaseId, "databaseId");
  assertString(dashboardId, "dashboardId");
  assertString(viewId, "viewId");
  ok("create_database", `Created database '${dbTitle}' (DB: ${databaseId}, Dash: ${dashboardId}, View: ${viewId})`);

  let databaseDeleted = false;
  try {
    await verifyWrite("create_database", `database ${databaseId} has title '${dbTitle}' and dashboard ${dashboardId}`, async () => {
      const db = await readDatabase(client, databaseId);
      assertEqual(db.title, dbTitle, "get_database_detail.data.title");
      assertArray(db.dashboards, "get_database_detail.data.dashboards", 1);
      assert(db.dashboards.some((d: any) => d.global_id === dashboardId), `Database ${databaseId} should contain dashboard ${dashboardId}`);
    });
    ok("get_database_detail", "Verified database root metadata");

    const dbSchema = await callTool(client, "get_database_schema", { dashboardId, viewId });
    assertArray(dbSchema, "get_database_schema (columns)");
    ok("get_database_schema", `Validated column schema definition (${dbSchema.length} columns)`);

    const wsDatabases = await callTool(client, "list_databases", { workspaceId: targetWsId });
    assertArray(wsDatabases, "list_databases");
    ok("list_databases", `Verified workspace database query (${wsDatabases.length} databases)`);

    const allDbs = await callTool(client, "list_all_databases");
    assertObject(allDbs, "list_all_databases");
    assertArray(allDbs.data, "list_all_databases.data", 1);
    assert(allDbs.data.some((d: any) => d.global_id === databaseId), `list_all_databases should include created database ${databaseId}`);
    ok("list_all_databases", `Verified global databases listing (${allDbs.data.length} databases)`);

    const dashDetail = await callTool(client, "get_dashboard_detail", { dashboardId });
    assertObject(dashDetail, "get_dashboard_detail");
    ok("get_dashboard_detail", "Verified dashboard view hierarchy");

    const colName = "ValidationStatus";
    const addColRes = await callTool(client, "add_database_column", { dashboardId, viewId, name: colName, columnType: "text" });
    assertObject(addColRes, "add_database_column response");
    const columnKey = addColRes.columnKey || addColRes.column?.key || addColRes.key;
    assertString(columnKey, "columnKey");
    await verifyWrite("add_database_column", `schema has column ${columnKey} named '${colName}' of type string`, () =>
      expectColumn(client, dashboardId, viewId, columnKey, colName, "string"),
    );
    ok("add_database_column", `Added column '${colName}' (Key: ${columnKey})`);

    const renamedColName = "ValidationStatusRenamed";
    const renameColRes = await callTool(client, "rename_database_column", { dashboardId, viewId, columnKey, newName: renamedColName });
    assertJson(renameColRes, "rename_database_column");
    await verifyWrite("rename_database_column", `column ${columnKey} is now named '${renamedColName}'`, () =>
      expectColumn(client, dashboardId, viewId, columnKey, renamedColName),
    );
    ok("rename_database_column", `Renamed column to '${renamedColName}'`);

    const setWidthRes = await callTool(client, "set_column_width", { dashboardId, viewId, columnKey, width: 240 });
    assertJson(setWidthRes, "set_column_width");
    await verifyWrite("set_column_width", `column ${columnKey} has metadata.width 240`, async () => {
      const col = await expectColumn(client, dashboardId, viewId, columnKey, renamedColName);
      assertEqual(col.metadata?.width, 240, `column ${columnKey} metadata.width`);
    });
    ok("set_column_width", "Updated column width to 240px");

    const reorderRes = await callTool(client, "reorder_database_columns", { dashboardId, viewId, orderedKeys: [columnKey] });
    assertJson(reorderRes, "reorder_database_columns");
    await verifyWrite("reorder_database_columns", `column ${columnKey} is first in the view schema`, async () => {
      const cols = await readSchema(client, dashboardId, viewId);
      assertEqual(cols[0]?.key, columnKey, "first column key after reorder");
    });
    ok("reorder_database_columns", "Reordered column display sequence");

    const addRowRes = await callTool(client, "add_database_row", { databaseId, dashboardId, viewId, entity: "custom" });
    assertJson(addRowRes, "add_database_row");
    const addedRowUuid = addRowRes.rowUuid;
    assertString(addedRowUuid, "add_database_row.rowUuid");
    await verifyWrite("add_database_row", `row ${addedRowUuid} is returned by get_database_rows`, async () => {
      const rows = await readRows(client, dashboardId, viewId);
      assert(rows.some((r: any) => r.rowUuid === addedRowUuid), `Added row ${addedRowUuid} should be returned by get_database_rows`);
    });
    ok("add_database_row", "Added row");

    const rowsRes = await callTool(client, "get_database_rows", { dashboardId, viewId });
    assertObject(rowsRes, "get_database_rows response");
    assertArray(rowsRes.rows, "get_database_rows.rows", 1);
    const targetRowUuid = rowsRes.rows[0].rowUuid;
    assertString(targetRowUuid, "get_database_rows.rows[0].rowUuid");
    ok("get_database_rows", `Queried table row records (${rowsRes.rows.length} rows)`);

    const viewData = await callTool(client, "get_database_data", { dashboardId, viewId });
    assertObject(viewData, "get_database_data");
    ok("get_database_data", "Read formatted table view dataset");

    const cellRes = await callTool(client, "update_database_cell", { dashboardId, viewId, rowUuid: targetRowUuid, columnKey, value: "Verified 100%" });
    assertJson(cellRes, "update_database_cell");
    await verifyWrite("update_database_cell", `row ${targetRowUuid} cell ${columnKey} reads 'Verified 100%'`, async () => {
      const row = (await readRows(client, dashboardId, viewId)).find((r: any) => r.rowUuid === targetRowUuid);
      assert(!!row, `Row ${targetRowUuid} should be returned by get_database_rows`);
      assertEqual(row.cells?.[columnKey], "Verified 100%", `row ${targetRowUuid} cells.${columnKey}`);
    });
    ok("update_database_cell", "Updated cell value to 'Verified 100%'");

    const batchPutRes = await callTool(client, "batch_put_database_data", {
      dashboardId,
      viewId,
      rows: [{ create_new_row: true, values: [{ item_key: columnKey, value: "Batch Put Data Item" }] }],
    });
    assertJson(batchPutRes, "batch_put_database_data");
    await verifyWrite("batch_put_database_data", `a row with cell ${columnKey} = 'Batch Put Data Item' exists`, async () => {
      const rows = await readRows(client, dashboardId, viewId);
      assert(rows.some((r: any) => r.cells?.[columnKey] === "Batch Put Data Item"), `A row with ${columnKey} = 'Batch Put Data Item' should be returned by get_database_rows`);
    });
    ok("batch_put_database_data", "Batch row creation accepted");

    // Move the last row to the top (sending the full order so no two rows share a position).
    const rowsBefore = await readRows(client, dashboardId, viewId);
    assert(rowsBefore.length >= 2, `reorder_database_rows needs at least 2 rows, got ${rowsBefore.length}`);
    const previousFirst: string = rowsBefore[0].rowUuid;
    const movedRow: string = rowsBefore[rowsBefore.length - 1].rowUuid;
    const newOrder = [movedRow, ...rowsBefore.map((r: any) => r.rowUuid as string).filter((id: string) => id !== movedRow)];
    const reorderRowsRes = await callTool(client, "reorder_database_rows", {
      dashboardId,
      viewId,
      rowOrders: newOrder.map((rowUuid, i) => ({ rowUuid, order: i + 1 })),
    });
    assertJson(reorderRowsRes, "reorder_database_rows");
    await verifyWrite("reorder_database_rows", `row ${movedRow} (previously last) is now first, followed by the previous first row ${previousFirst}`, async () => {
      const rows = await readRows(client, dashboardId, viewId);
      assertEqual(rows[0]?.rowUuid, movedRow, "first row after reorder");
      assertEqual(rows[1]?.rowUuid, previousFirst, "second row after reorder (the previous first)");
    });
    ok("reorder_database_rows", "Verified row reordering mutation");

    const aliasRes = await callTool(client, "resolve_database_alias", { alias: dbTitle });
    assertObject(aliasRes, "resolve_database_alias");
    assertEqual(aliasRes.found, true, "resolve_database_alias.found");
    assertEqual(aliasRes.databaseId, databaseId, "resolve_database_alias.databaseId");
    ok("resolve_database_alias", "Resolved created database by title");

    const createViewRes = await callTool(client, "create_view", { dashboardId, name: "Kanban Validation View", representationType: "kanban" });
    assertObject(createViewRes, "create_view response");
    const newViewId = createViewRes.viewId || createViewRes.data?.global_id || createViewRes.id;
    assertString(newViewId, "created newViewId");
    /** Assert the dashboard lists view `id` with `name`. */
    const expectView = async (id: string, name: string): Promise<void> => {
      const view = (await readViews(client, dashboardId)).find((v: any) => v.global_id === id);
      assert(!!view, `View ${id} should be listed by get_dashboard_detail`);
      assertEqual(view.name, name, `view ${id} name`);
    };
    await verifyWrite("create_view", `dashboard lists view ${newViewId} named 'Kanban Validation View', whose default representation is kanban`, async () => {
      await expectView(newViewId, "Kanban Validation View");
      const reps = await readViewRepresentations(client, dashboardId, newViewId);
      assert(
        reps.some((r) => r.global_id === "kanban" && r.is_default === true),
        `View ${newViewId} should have kanban as its default representation, got: ${JSON.stringify(reps).slice(0, 300)}`,
      );
    });
    ok("create_view", `Created view '${newViewId}'`);

    const dupViewRes = await callTool(client, "duplicate_view", { dashboardId, sourceViewId: newViewId, name: "Kanban Validation View (Copy)" });
    assertObject(dupViewRes, "duplicate_view response");
    const dupViewId = dupViewRes.viewId || dupViewRes.data?.global_id || dupViewRes.id;
    assertString(dupViewId, "duplicated view id");
    await verifyWrite("duplicate_view", `dashboard lists view ${dupViewId} named 'Kanban Validation View (Copy)' with the source schema (column ${columnKey})`, async () => {
      await expectView(dupViewId, "Kanban Validation View (Copy)");
      const cols = await readSchema(client, dashboardId, dupViewId);
      assert(cols.some((c: any) => c.key === columnKey), `Duplicated view ${dupViewId} should carry column ${columnKey} from its source`);
    });
    ok("duplicate_view", `Duplicated view (New View ID: ${dupViewId})`);

    const updateViewRes = await callTool(client, "update_view", { dashboardId, viewId: newViewId, name: "Kanban Validation View (Renamed)" });
    assertJson(updateViewRes, "update_view");
    await verifyWrite("update_view", `view ${newViewId} is now named 'Kanban Validation View (Renamed)'`, () => expectView(newViewId, "Kanban Validation View (Renamed)"));
    ok("update_view", "Updated view name");

    const groupRes = await callTool(client, "set_view_grouping", { dashboardId, viewId: newViewId, groupByColumnKey: columnKey });
    assertJson(groupRes, "set_view_grouping");
    await verifyWrite("set_view_grouping", `view ${newViewId}'s kanban representation is grouped by ${columnKey}`, async () => {
      const kanban = (await readViewRepresentations(client, dashboardId, newViewId)).find((r) => r.global_id === "kanban");
      assert(!!kanban, `View ${newViewId} should have a kanban representation`);
      assertEqual(kanban.settings?.groupByField, columnKey, "kanban settings.groupByField");
    });
    ok("set_view_grouping", "Configured kanban column grouping");

    const repRes = await callTool(client, "set_view_representation", { dashboardId, viewId: newViewId, representationType: "table" });
    assertJson(repRes, "set_view_representation");
    await verifyWrite("set_view_representation", `view ${newViewId}'s default representation is no longer kanban (table if one is marked default)`, async () => {
      const reps = await readViewRepresentations(client, dashboardId, newViewId);
      const defaults = reps.filter((r) => r.is_default === true);
      assert(
        defaults.every((r) => r.global_id === "table"),
        `After switching to table, the default representation should be table, got: ${JSON.stringify(reps).slice(0, 300)}`,
      );
    });
    ok("set_view_representation", "Switched representation to 'table'");

    assertJson(await callTool(client, "delete_view", { dashboardId, viewId: dupViewId }), "delete_view (duplicate)");
    assertJson(await callTool(client, "delete_view", { dashboardId, viewId: newViewId }), "delete_view");
    await verifyWrite("delete_view", `views ${dupViewId} and ${newViewId} are no longer listed by the dashboard`, async () => {
      const ids = (await readViews(client, dashboardId)).map((v: any) => v.global_id);
      assert(!ids.includes(dupViewId), `Deleted view ${dupViewId} is still listed`);
      assert(!ids.includes(newViewId), `Deleted view ${newViewId} is still listed`);
    }, { count: 2 });
    ok("delete_view", "Deleted created and duplicated views");

    // Second database as relation target
    const targetDbTitle = `Target Relation DB ${Date.now()}`;
    const targetDbRes = await callTool(client, "create_database", { title: targetDbTitle });
    assertObject(targetDbRes, "create_database (relation target)");
    const targetDbId = targetDbRes.databaseId || targetDbRes.id;
    const targetDashId = targetDbRes.dashboardId;
    const targetViewId = targetDbRes.viewId;
    assertString(targetDbId, "targetDbId");
    assertString(targetDashId, "targetDashId");
    assertString(targetViewId, "targetViewId");

    try {
      await verifyWrite("create_database", `relation target database ${targetDbId} has title '${targetDbTitle}' and dashboard ${targetDashId}`, async () => {
        const db = await readDatabase(client, targetDbId);
        assertEqual(db.title, targetDbTitle, "target get_database_detail.data.title");
        assertArray(db.dashboards, "target get_database_detail.data.dashboards", 1);
        assert(db.dashboards.some((d: any) => d.global_id === targetDashId), `Database ${targetDbId} should contain dashboard ${targetDashId}`);
      });

      const targetAddRowRes = await callTool(client, "add_database_row", { databaseId: targetDbId, dashboardId: targetDashId, viewId: targetViewId, entity: "custom" });
      assertJson(targetAddRowRes, "add_database_row (target)");
      const targetAddedRowUuid = targetAddRowRes.rowUuid;
      assertString(targetAddedRowUuid, "add_database_row (target).rowUuid");
      await verifyWrite("add_database_row", `target row ${targetAddedRowUuid} is returned by get_database_rows`, async () => {
        const rows = await readRows(client, targetDashId, targetViewId);
        assert(rows.some((r: any) => r.rowUuid === targetAddedRowUuid), `Added target row ${targetAddedRowUuid} should be returned by get_database_rows`);
      });
      const targetRows = await callTool(client, "get_database_rows", { dashboardId: targetDashId, viewId: targetViewId });
      assertArray(targetRows?.rows, "target get_database_rows.rows", 1);
      const targetDbRowUuid = targetRows.rows[0].rowUuid;
      assertString(targetDbRowUuid, "target rowUuid");

      const relRes = await callTool(client, "add_relation_column", {
        dashboardId,
        viewId,
        name: "LinkedTargetDB",
        targetDashboardId: targetDashId,
        targetViewId,
      });
      assertObject(relRes, "add_relation_column response");
      const relationKey = relRes.columnKey;
      const relationId = relRes.relationId;
      assertString(relationKey, "add_relation_column.columnKey");
      assertString(relationId, "add_relation_column.relationId");
      await verifyWrite("add_relation_column", `schema has relation column ${relationKey} 'LinkedTargetDB' and list_database_relations includes relation ${relationId}`, async () => {
        await expectColumn(client, dashboardId, viewId, relationKey, "LinkedTargetDB");
        const relations = await callTool(client, "list_database_relations", { dashboardId });
        assertJson(relations, "list_database_relations");
        assertIncludes(JSON.stringify(relations), relationId, "list_database_relations contains created relation");
      });
      ok("add_relation_column", `Added relation to target DB (Key: ${relationKey}, Relation: ${relationId})`);
      ok("list_database_relations", "Queried cross-table relations");

      const relRows = await callTool(client, "get_relation_rows", { relationId });
      assertJson(relRows, "get_relation_rows");
      ok("get_relation_rows", "Queried linked relation rows");

      const linkRes = await callTool(client, "link_database_rows", { relationId, sourceRowUuid: targetRowUuid, targetRowUuid: targetDbRowUuid });
      assertJson(linkRes, "link_database_rows");
      await verifyWrite("link_database_rows", `relation ${relationId} maps row ${targetRowUuid} to ${targetDbRowUuid}`, async () => {
        const linked = await callTool(client, "get_relation_rows", { relationId });
        assert(hasRelationLink(linked, targetRowUuid, targetDbRowUuid), `get_relation_rows should map ${targetRowUuid} -> ${targetDbRowUuid}, got: ${JSON.stringify(linked).slice(0, 300)}`);
      });
      ok("link_database_rows", "Established row-level relation");

      const unlinkRes = await callTool(client, "unlink_database_rows", { relationId, sourceRowUuid: targetRowUuid, targetRowUuid: targetDbRowUuid });
      assertJson(unlinkRes, "unlink_database_rows");
      await verifyWrite("unlink_database_rows", `relation ${relationId} no longer maps row ${targetRowUuid} to ${targetDbRowUuid}`, async () => {
        const unlinked = await callTool(client, "get_relation_rows", { relationId });
        assertJson(unlinked, "get_relation_rows");
        assert(!hasRelationLink(unlinked, targetRowUuid, targetDbRowUuid), `get_relation_rows still maps ${targetRowUuid} -> ${targetDbRowUuid}`);
      });
      ok("unlink_database_rows", "Removed row-level relation link");

      const lookupRes = await callTool(client, "add_lookup_column", { dashboardId, viewId, name: "TargetTitleLookup", relationColumnKey: relationKey });
      assertObject(lookupRes, "add_lookup_column response");
      assertString(lookupRes.columnKey, "add_lookup_column.columnKey");
      await verifyWrite("add_lookup_column", `schema has lookup column ${lookupRes.columnKey} named 'TargetTitleLookup'`, () =>
        expectColumn(client, dashboardId, viewId, lookupRes.columnKey, "TargetTitleLookup"),
      );
      ok("add_lookup_column", "Created lookup column targeting relation");

      const delRelRes = await callTool(client, "delete_relation", { relationId });
      assertJson(delRelRes, "delete_relation");
      await verifyWrite("delete_relation", `relation ${relationId} reads back as not found (or soft-deleted)`, async () => {
        const res = await readUnlessGone(() => callTool(client, "get_relation_rows", { relationId }));
        assert(res.gone || /"deleted_at"\s*:\s*"[^"]+"/.test(JSON.stringify(res.value)), `Deleted relation ${relationId} is still readable: ${res.gone ? "" : JSON.stringify(res.value).slice(0, 300)}`);
      });
      ok("delete_relation", `Deleted relation ${relationId}`);

      const delDashRes = await callTool(client, "delete_dashboard", { dashboardId: targetDashId });
      assertJson(delDashRes, "delete_dashboard");
      await verifyWrite("delete_dashboard", `dashboard ${targetDashId} is not found, or no longer part of database ${targetDbId}`, async () => {
        const res = await readUnlessGone(() => callTool(client, "get_dashboard_detail", { dashboardId: targetDashId }));
        if (res.gone) return;
        const db = await readDatabase(client, targetDbId);
        assertArray(db.dashboards, "target get_database_detail.data.dashboards");
        assert(!db.dashboards.some((d: any) => d.global_id === targetDashId), `Deleted dashboard ${targetDashId} is still readable and still listed in database ${targetDbId}`);
      });
      ok("delete_dashboard", `Deleted relation-target dashboard ${targetDashId}`);
    } finally {
      await cleanup(`delete relation target database ${targetDbId}`, () => callTool(client, "delete_database", { databaseId: targetDbId }));
    }

    const delRowRes = await callTool(client, "delete_database_row", { dashboardId, rowId: targetRowUuid });
    assertJson(delRowRes, "delete_database_row");
    await verifyWrite("delete_database_row", `row ${targetRowUuid} is no longer returned by get_database_rows`, async () => {
      const rows = await readRows(client, dashboardId, viewId);
      assert(!rows.some((r: any) => r.rowUuid === targetRowUuid), `Deleted row ${targetRowUuid} is still returned`);
    });
    ok("delete_database_row", `Deleted row ${targetRowUuid}`);

    const exportCsvRes = await callTool(client, "export_csv", { dashboardId, viewId });
    assertString(exportCsvRes, "export_csv", 1);
    assertIncludes(exportCsvRes, renamedColName, "export_csv header contains renamed column");
    ok("export_csv", "Exported table schema and data to CSV format");

    const importCsvRes = await callTool(client, "import_csv", {
      databaseId,
      dashboardId,
      viewId,
      csvContent: `Title,${renamedColName}\nTask Alpha,Active\nTask Beta,Closed`,
    });
    assertJson(importCsvRes, "import_csv");
    // The import runs as a server-side job, so allow it longer to land.
    await verifyWrite("import_csv", "rows 'Task Alpha'/'Active' and 'Task Beta'/'Closed' are returned by get_database_rows", async () => {
      const rows = await readRows(client, dashboardId, viewId);
      for (const [title, status] of [["Task Alpha", "Active"], ["Task Beta", "Closed"]]) {
        assert(
          rows.some((r: any) => {
            const values = Object.values(r.cells ?? {});
            return values.includes(title) && values.includes(status);
          }),
          `Imported row '${title}' with '${status}' should be returned by get_database_rows`,
        );
      }
    }, { timeoutMs: 60_000, intervalMs: 3000 });
    ok("import_csv", "Imported CSV dataset into database");

    const clonedDbTitle = `${dbTitle} (Clone)`;
    const dupDbRes = await callTool(client, "duplicate_database", { sourceDbId: databaseId, title: clonedDbTitle });
    assertObject(dupDbRes, "duplicate_database response");
    const clonedDbId = dupDbRes.databaseId;
    assertString(clonedDbId, "duplicate_database.databaseId");
    try {
      await verifyWrite("duplicate_database", `clone ${clonedDbId} is titled '${clonedDbTitle}' with a table whose view carries column '${renamedColName}'`, async () => {
        const clone = await readDatabase(client, clonedDbId);
        assertEqual(clone.global_id, clonedDbId, "clone get_database_detail.data.global_id");
        assertEqual(clone.title, clonedDbTitle, "clone get_database_detail.data.title");
        assertArray(clone.dashboards, "clone get_database_detail.data.dashboards", 1);
        const cloneDashId = clone.dashboards[0].global_id;
        assertString(cloneDashId, "clone dashboards[0].global_id");
        const cloneViews = await readViews(client, cloneDashId);
        assertArray(cloneViews, "clone views", 1);
        const cols = await readSchema(client, cloneDashId, cloneViews[0].global_id);
        assert(cols.some((c: any) => c.name === renamedColName), `Cloned table should carry column '${renamedColName}'`);
      });
    } finally {
      await cleanup(`delete cloned database ${clonedDbId}`, () => callTool(client, "delete_database", { databaseId: clonedDbId }));
    }
    ok("duplicate_database", `Cloned database (New DB ID: ${clonedDbId})`);

    const delColRes = await callTool(client, "delete_database_column", { dashboardId, viewId, columnKey });
    assertJson(delColRes, "delete_database_column");
    await verifyWrite("delete_database_column", `column ${columnKey} is no longer in the view schema`, async () => {
      const cols = await readSchema(client, dashboardId, viewId);
      assert(!cols.some((c: any) => c.key === columnKey), `Deleted column ${columnKey} is still in the schema`);
    });
    ok("delete_database_column", `Deleted column ${columnKey}`);

    const renamedDbTitle = `${dbTitle} (Renamed)`;
    const updateDbRes = await callTool(client, "update_database", { databaseId, title: renamedDbTitle });
    assertJson(updateDbRes, "update_database");
    await verifyWrite("update_database", `database ${databaseId} title reads back as '${renamedDbTitle}'`, async () => {
      const db = await readDatabase(client, databaseId);
      assertEqual(db.title, renamedDbTitle, "database title after update_database");
    });
    ok("update_database", "Updated database properties");

    // Look up the test's own table: generic names like "custom" are ambiguous by design (COR-2).
    const dbEntity = await callTool(client, "get_database_entity", { entity: dashboardId });
    assertJson(dbEntity, "get_database_entity");
    ok("get_database_entity", "Queried database entity schema definitions");

    // COR-21: create_dashboard_table is broken for both database and table IDs (404 / 500
    // "global_id is required"); tracked as a known gap until it is reimplemented.
    let tableCreated = false;
    try {
      await callTool(client, "create_dashboard_table", { dashboardId, title: "Secondary Test Table" });
      tableCreated = true;
    } catch (err) {
      if (!(err instanceof ToolError)) throw err;
    }
    knownGap("COR-21", "create_dashboard_table adds a table", tableCreated);
    if (tableCreated) {
      await verifyWrite("create_dashboard_table", "a table or view named 'Secondary Test Table' is listed in the database or dashboard", async () => {
        const db = await readDatabase(client, databaseId);
        const views = await readViews(client, dashboardId);
        assert(
          JSON.stringify(db).includes("Secondary Test Table") || views.some((v: any) => v.name === "Secondary Test Table"),
          "'Secondary Test Table' should appear in get_database_detail or get_dashboard_detail",
        );
      });
    }

    const delDbRes = await callTool(client, "delete_database", { databaseId });
    assertJson(delDbRes, "delete_database");
    databaseDeleted = true;
    await verifyWrite("delete_database", `database ${databaseId} is no longer listed by list_all_databases`, async () => {
      const remaining = await callTool(client, "list_all_databases");
      assertArray(remaining?.data, "list_all_databases.data");
      assert(!remaining.data.some((d: any) => d.global_id === databaseId), `Deleted database ${databaseId} is still listed`);
    });
    ok("delete_database", `Deleted database ${databaseId}`);
  } finally {
    if (!databaseDeleted) await cleanup(`delete database ${databaseId}`, () => callTool(client, "delete_database", { databaseId }));
  }

  // ──────────────────────────────────────────────────────────────────
  // Suite 8: Client Portals & Clients
  // ──────────────────────────────────────────────────────────────────
  suiteHeader("SUITE 8: Client Portals & Clients");

  const navMenu = await callTool(client, "get_navigation_menu", { workspaceId: targetWsId });
  assertJson(navMenu, "get_navigation_menu");
  ok("get_navigation_menu", "Validated workspace navigation tree");

  // Creating portals is never exercised: there is no delete_portal tool, so every run would leak
  // an externally visible portal.
  skip("create_portal", "no delete_portal tool to clean up a created portal; not exercised");

  const portalAvail = await callTool(client, "check_portal_availability");
  assertString(portalAvail, "check_portal_availability");
  const portalMatch = /^Client portal availability: (ENABLED|DISABLED)$/.exec(portalAvail.trim());
  assert(!!portalMatch, `check_portal_availability returned unexpected text: ${portalAvail}`);
  ok("check_portal_availability", portalAvail.trim());

  const portalBoundTools = [
    "get_portal",
    "get_workspace_portal",
    "get_portal_theme",
    "get_portal_navigation_menu",
    "get_portal_pages",
    "publish_page_to_portal",
    "list_portal_clients",
    "create_portal_magic_link",
    "invite_portal_client",
  ];

  if (portalMatch![1] === "DISABLED") {
    skipAll(["list_portals", ...portalBoundTools], "client portal feature is DISABLED for this org (check_portal_availability)");
  } else {
    const portals = await callTool(client, "list_portals", { workspaceId: targetWsId });
    assertArray(portals, "list_portals");
    ok("list_portals", `Found ${portals.length} portals bound to the sandbox workspace`);

    if (portals.length === 0) {
      skipAll(portalBoundTools, "sandbox workspace has no client portal; create one manually to exercise portal tools");
    } else {
      const portalId = String(portals[0].globalId ?? portals[0].id ?? "");
      assertString(portalId, "sandbox portal id");

      const portalDetail = await callTool(client, "get_portal", { portalId });
      assertObject(portalDetail, "get_portal");
      ok("get_portal", "Verified portal metadata and domain");

      const wsPortal = await callTool(client, "get_workspace_portal", { workspaceId: targetWsId });
      assertJson(wsPortal, "get_workspace_portal");
      ok("get_workspace_portal", "Queried workspace portal binding");

      const portalTheme = await callTool(client, "get_portal_theme", { workspaceId: targetWsId });
      assertObject(portalTheme, "get_portal_theme");
      ok("get_portal_theme", "Validated theme styling and brand navigation");

      const portalNav = await callTool(client, "get_portal_navigation_menu", { workspaceId: targetWsId });
      assertObject(portalNav, "get_portal_navigation_menu");
      ok("get_portal_navigation_menu", "Validated navigation menu schema");

      const portalClients = await callTool(client, "list_portal_clients", { portalId });
      assertArray(portalClients, "list_portal_clients");
      ok("list_portal_clients", `Queried portal client accounts (${portalClients.length} clients)`);

      const pubTestTitle = `Portal Publish Test ${Date.now()}`;
      const pubTestPage = await callTool(client, "create_page", {
        workspaceId: targetWsId,
        title: pubTestTitle,
        markdown: "# Portal Publishing",
      });
      assertObject(pubTestPage, "create_page (portal page)");
      const pubTestPageId = pubTestPage.id;
      assertString(pubTestPageId, "pubTestPageId");
      try {
        await verifyWrite("create_page", `portal test page ${pubTestPageId} has its title and heading`, () =>
          expectPage(client, targetWsId, pubTestPageId, pubTestTitle, ["Portal Publishing"]),
        );
        const pubRes = await callTool(client, "publish_page_to_portal", { workspaceId: targetWsId, pageId: pubTestPageId, publish: true });
        assertIncludes(pubRes, "published to", "publish_page_to_portal response");
        await verifyWrite("publish_page_to_portal", `page ${pubTestPageId} reads back with isPortalShare: true`, async () => {
          const meta = await callTool(client, "get_page", { workspaceId: targetWsId, pageId: pubTestPageId });
          assertObject(meta, "get_page (portal page)");
          assertEqual(meta.isPortalShare, true, "get_page.isPortalShare");
        });
        ok("publish_page_to_portal", "Published page to client portal");

        const portalPages = await callTool(client, "get_portal_pages", { workspaceId: targetWsId, noteId: pubTestPageId });
        assertJson(portalPages, "get_portal_pages");
        ok("get_portal_pages", "Verified published portal pages response");
      } finally {
        await cleanup(`delete page ${pubTestPageId}`, () => callTool(client, "delete_page", { workspaceId: targetWsId, pageId: pubTestPageId }));
      }

      // These send real email and leave a portal client behind, so they only run when an
      // address you control is configured.
      const inviteEmail = process.env.FUSEBASE_TEST_INVITE_EMAIL;
      if (!inviteEmail) {
        skipAll(["create_portal_magic_link", "invite_portal_client"], "sends real email; set FUSEBASE_TEST_INVITE_EMAIL to an address you control to run");
      } else {
        const magicLinkRes = await callTool(client, "create_portal_magic_link", { portalId, email: inviteEmail });
        assertJson(magicLinkRes, "create_portal_magic_link");
        noReadBack("create_portal_magic_link", "the link is returned once and emailed; no tool lists issued magic links");
        ok("create_portal_magic_link", "Generated magic link");

        const inviteClientRes = await callTool(client, "invite_portal_client", { portalId, email: inviteEmail });
        assertJson(inviteClientRes, "invite_portal_client");
        await verifyWrite("invite_portal_client", "the invited address is listed by list_portal_clients", async () => {
          const clients = await callTool(client, "list_portal_clients", { portalId });
          assert(JSON.stringify(clients).toLowerCase().includes(inviteEmail.toLowerCase()), "Invited address should be listed by list_portal_clients");
        });
        ok("invite_portal_client", "Dispatched portal client invitation");
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Suite 9: ActivePieces Workflow Automations
  // ──────────────────────────────────────────────────────────────────
  suiteHeader("SUITE 9: ActivePieces Workflow Automations");

  const automationTools = [
    "get_automation_user",
    "list_automation_pieces",
    "list_automation_folders",
    "create_automation_folder",
    "delete_automation_folder",
    "list_automation_flows",
    "create_automation_flow",
    "get_automation_flow",
    "update_automation_flow",
    "list_flow_runs",
    "trigger_automation_flow",
    "delete_automation_flow",
  ];

  const flagsProbe = await optional("get_automation_flags", AUTOMATION_UNAVAILABLE, () => callTool(client, "get_automation_flags"));
  const automationAvailable = !!flagsProbe;
  if (!flagsProbe) {
    skipAll([...automationTools, "fusebase_work_trigger_n8n"], "automations unavailable for this org (see get_automation_flags skip)");
  } else {
    const flags = flagsProbe.value;
    assertObject(flags, "get_automation_flags");
    ok("get_automation_flags", `ActivePieces Edition '${flags.EDITION}' (${flags.CURRENT_VERSION})`);

    const autoUser = await callTool(client, "get_automation_user");
    assertObject(autoUser, "get_automation_user");
    assertString(autoUser.id, "get_automation_user.id");
    ok("get_automation_user", "Automation user profile resolved");

    const pieces = await callTool(client, "list_automation_pieces");
    assertJson(pieces, "list_automation_pieces");
    ok("list_automation_pieces", `Verified pieces catalog (${Array.isArray(pieces) ? pieces.length : "object"})`);

    const autoFolders = await callTool(client, "list_automation_folders");
    assertObject(autoFolders, "list_automation_folders");
    assertArray(autoFolders.data, "list_automation_folders.data");
    ok("list_automation_folders", `Queried automation folders (${autoFolders.data.length})`);

    const autoFolderName = `QA Auto Folder ${Date.now()}`;
    const createdFolder = await callTool(client, "create_automation_folder", { displayName: autoFolderName });
    assertObject(createdFolder, "create_automation_folder");
    const autoFolderId = createdFolder.id;
    assertString(autoFolderId, "create_automation_folder.id");
    /** Automation folders as listed by list_automation_folders. */
    const readAutoFolders = async (): Promise<any[]> => {
      const res = await callTool(client, "list_automation_folders");
      assertArray(res?.data, "list_automation_folders.data");
      return res.data;
    };
    let autoFolderDeleted = false;
    try {
      await verifyWrite("create_automation_folder", `automation folder ${autoFolderId} listed as '${autoFolderName}'`, async () => {
        const folder = (await readAutoFolders()).find((f: any) => f.id === autoFolderId);
        assert(!!folder, `Created automation folder ${autoFolderId} should be listed`);
        assertEqual(folder.displayName, autoFolderName, "automation folder displayName");
      });
      ok("create_automation_folder", `Created automation folder ${autoFolderId}`);

      const delFolderRes = await callTool(client, "delete_automation_folder", { folderId: autoFolderId });
      assertIncludes(delFolderRes, "deleted successfully", "delete_automation_folder response");
      autoFolderDeleted = true;
      await verifyWrite("delete_automation_folder", `automation folder ${autoFolderId} is no longer listed`, async () => {
        assert(!(await readAutoFolders()).some((f: any) => f.id === autoFolderId), `Deleted automation folder ${autoFolderId} is still listed`);
      });
      ok("delete_automation_folder", `Deleted automation folder ${autoFolderId}`);
    } finally {
      if (!autoFolderDeleted) await cleanup(`delete automation folder ${autoFolderId}`, () => callTool(client, "delete_automation_folder", { folderId: autoFolderId }));
    }

    const flowsList = await callTool(client, "list_automation_flows");
    assertJson(flowsList, "list_automation_flows");
    ok("list_automation_flows", "Listed automation flows");

    const flowName = `QA Test Flow ${Date.now()}`;
    const createFlowRes = await callTool(client, "create_automation_flow", { displayName: flowName });
    assertObject(createFlowRes, "create_automation_flow");
    const flowId = createFlowRes.id;
    assertString(flowId, "create_automation_flow.id");
    ok("create_automation_flow", `Created flow ${flowId}`);

    let flowDeleted = false;
    try {
      /** Assert get_automation_flow returns this flow with the given display name. */
      const expectFlowName = async (name: string): Promise<void> => {
        const flow = await callTool(client, "get_automation_flow", { flowId });
        assertObject(flow, "get_automation_flow");
        assertEqual(flow.id, flowId, "get_automation_flow.id");
        assertEqual(flow.version?.displayName, name, "get_automation_flow.version.displayName");
      };
      await verifyWrite("create_automation_flow", `flow ${flowId} reads back with displayName '${flowName}'`, () => expectFlowName(flowName));
      ok("get_automation_flow", "Verified flow definition");

      const updateFlowRes = await callTool(client, "update_automation_flow", { flowId, displayName: "QA Test Flow (Updated)", type: "CHANGE_NAME" });
      assertJson(updateFlowRes, "update_automation_flow");
      await verifyWrite("update_automation_flow", `flow ${flowId} reads back with displayName 'QA Test Flow (Updated)'`, () => expectFlowName("QA Test Flow (Updated)"));
      ok("update_automation_flow", "Updated flow display name");

      const runs = await callTool(client, "list_flow_runs", { limit: 5 });
      assertJson(runs, "list_flow_runs");
      ok("list_flow_runs", "Queried flow execution runs");

      /**
       * Prove a trigger by the run it reports. The test flow is an unpublished draft with an empty
       * trigger: when FuseBase answers without a run, there is nothing a read can observe.
       */
      const proveTrigger = async (tool: string, res: any): Promise<void> => {
        const reported = typeof res?.id === "string" ? res : res?.data;
        const runId: string | undefined =
          typeof reported?.id === "string" && (reported.flowId === flowId || "status" in reported) ? reported.id : undefined;
        if (!runId) {
          noReadBack(tool, "the trigger response carries no run: the test flow is an unpublished draft with an empty trigger, which ActivePieces doesn't execute, so list_flow_runs has no run to show (no tool can give a flow a real trigger)");
          return;
        }
        await verifyWrite(tool, `list_flow_runs shows run ${runId} of flow ${flowId}`, async () => {
          const run = (await readFlowRuns(client)).find((r: any) => r.id === runId);
          assert(!!run, `list_flow_runs should include run ${runId} reported by ${tool}`);
          assertEqual(run.flowId, flowId, "flow run flowId");
        }, { timeoutMs: 30_000 });
      };
      const triggerRes = await callTool(client, "trigger_automation_flow", { flowId, payload: { qa: true } });
      assertJson(triggerRes, "trigger_automation_flow");
      await proveTrigger("trigger_automation_flow", triggerRes);
      ok("trigger_automation_flow", "Triggered flow");

      const n8nRes = await callTool(client, "fusebase_work_trigger_n8n", { flowId, payload: { test: true } });
      assertJson(n8nRes, "fusebase_work_trigger_n8n");
      await proveTrigger("fusebase_work_trigger_n8n", n8nRes);
      ok("fusebase_work_trigger_n8n", "Triggered flow via FuseBase Work n8n bridge");

      const delFlowRes = await callTool(client, "delete_automation_flow", { flowId });
      assertIncludes(delFlowRes, "deleted successfully", "delete_automation_flow response");
      flowDeleted = true;
      await verifyWrite("delete_automation_flow", `flow ${flowId} reads back as not found`, async () => {
        const res = await readUnlessGone(() => callTool(client, "get_automation_flow", { flowId }));
        assert(res.gone, `Deleted flow ${flowId} is still readable via get_automation_flow`);
      });
      ok("delete_automation_flow", `Deleted test flow ${flowId}`);
    } finally {
      if (!flowDeleted) await cleanup(`delete automation flow ${flowId}`, () => callTool(client, "delete_automation_flow", { flowId }));
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Suite 10: AI Assistant, Personas & Swarm
  // ──────────────────────────────────────────────────────────────────
  suiteHeader("SUITE 10: AI Assistant, Personas & Swarm");

  const agents = await callTool(client, "list_agents");
  assertArray(agents, "list_agents", 1);
  ok("list_agents", `Found ${agents.length} AI agent personas`);

  const firstAgentGlobalId = agents[0].globalId;
  assertString(firstAgentGlobalId, "list_agents[0].globalId");
  const agentPub = await callTool(client, "get_agent_public_profile", { agentGlobalId: firstAgentGlobalId });
  assertObject(agentPub, "get_agent_public_profile");
  assertString(agentPub.title || agentPub.name, "agent title");
  ok("get_agent_public_profile", `Verified public profile ('${agentPub.title || agentPub.name}')`);

  const aiCats = await callTool(client, "list_ai_agent_categories", { orgId });
  assertArray(aiCats, "list_ai_agent_categories", 1);
  ok("list_ai_agent_categories", `Verified taxonomy (${aiCats.length} categories)`);

  const aiState = await callTool(client, "get_ai_assistant_state", { workspaceId: targetWsId });
  assertObject(aiState, "get_ai_assistant_state");
  assertArray(aiState.promptSuggestions, "promptSuggestions");
  ok("get_ai_assistant_state", "Validated assistant state and suggestions");

  // list_ai_agent_threads takes the numeric agent id.
  const numericAgent = agents.find((a: any) => a.id !== undefined && /^\d+$/.test(String(a.id)));
  if (!numericAgent) {
    skip("list_ai_agent_threads", "no agent returned by list_agents exposes a numeric id");
  } else {
    const agentThreads = await callTool(client, "list_ai_agent_threads", { agentId: String(numericAgent.id) });
    assertArray(agentThreads, "list_ai_agent_threads");
    ok("list_ai_agent_threads", `Queried agent threads (${agentThreads.length} threads)`);
  }

  const aiFavs = await callTool(client, "get_ai_agent_favorites");
  assertArray(aiFavs, "get_ai_agent_favorites");
  ok("get_ai_agent_favorites", `Queried user agent favorites (${aiFavs.length} items)`);

  const aiUsage = await callTool(client, "get_ai_usage");
  assertString(aiUsage, "get_ai_usage");
  assert(/^AI Usage: \S+\/\S+/.test(aiUsage), `get_ai_usage should report 'AI Usage: x/y', got: ${aiUsage}`);
  ok("get_ai_usage", aiUsage);

  const swarmTitle = `QA Swarm Data Validation ${Date.now()}`;
  const swarmRes = await callTool(client, "fusebase_swarm_init", {
    title: swarmTitle,
    description: "Automated swarm verification",
  });
  assertObject(swarmRes, "fusebase_swarm_init");
  assertEqual(swarmRes.success, true, "fusebase_swarm_init.success");
  const swarmDbId = swarmRes.databaseId;
  const swarmDashId = swarmRes.dashboardId;
  const swarmViewId = swarmRes.viewId;
  assertString(swarmDbId, "swarm databaseId");
  assertString(swarmDashId, "swarm dashboardId");
  assertString(swarmViewId, "swarm viewId");
  ok("fusebase_swarm_init", `Initialized swarm database ${swarmDbId}`);

  try {
    const roleKey: string = swarmRes.roleColumnKey;
    const auditKey: string = swarmRes.auditColumnKey;
    assertString(roleKey, "fusebase_swarm_init.roleColumnKey");
    assertString(auditKey, "fusebase_swarm_init.auditColumnKey");
    await verifyWrite("fusebase_swarm_init", `swarm database ${swarmDbId} titled '${swarmTitle}' with label columns Status and Role and an Audit Log column`, async () => {
      const db = await readDatabase(client, swarmDbId);
      assertEqual(db.title, swarmTitle, "swarm get_database_detail.data.title");
      await expectColumn(client, swarmDashId, swarmViewId, swarmRes.statusColumnKey, "Status", "label");
      await expectColumn(client, swarmDashId, swarmViewId, roleKey, "Role", "label");
      await expectColumn(client, swarmDashId, swarmViewId, auditKey, "Audit Log", "string");
    });

    // Swarm init does not create a status column, so add one to group/move cards by.
    const statusCol = await callTool(client, "add_database_column", { dashboardId: swarmDashId, viewId: swarmViewId, name: "Status", columnType: "text" });
    const statusKey = statusCol?.columnKey;
    assertString(statusKey, "swarm status columnKey");
    await verifyWrite("add_database_column", `swarm schema has text column ${statusKey} named 'Status'`, () =>
      expectColumn(client, swarmDashId, swarmViewId, statusKey, "Status", "string"),
    );

    const swarmAddRowRes = await callTool(client, "add_database_row", { databaseId: swarmDbId, dashboardId: swarmDashId, viewId: swarmViewId, entity: "custom" });
    assertJson(swarmAddRowRes, "add_database_row (swarm)");
    const swarmAddedRowUuid = swarmAddRowRes.rowUuid;
    assertString(swarmAddedRowUuid, "add_database_row (swarm).rowUuid");
    await verifyWrite("add_database_row", `swarm row ${swarmAddedRowUuid} is returned by get_database_rows`, async () => {
      const rows = await readRows(client, swarmDashId, swarmViewId);
      assert(rows.some((r: any) => r.rowUuid === swarmAddedRowUuid), `Added swarm row ${swarmAddedRowUuid} should be returned by get_database_rows`);
    });
    /** Assert the swarm card's status cell reads `value`. */
    const expectSwarmStatus = async (rowId: string, value: string): Promise<void> => {
      const row = (await readRows(client, swarmDashId, swarmViewId)).find((r: any) => r.rowUuid === rowId);
      assert(!!row, `Swarm row ${rowId} should be returned by get_database_rows`);
      assertEqual(row.cells?.[statusKey], value, `swarm row ${rowId} cells.${statusKey}`);
    };
    const swarmRows = await callTool(client, "get_database_rows", { dashboardId: swarmDashId, viewId: swarmViewId });
    assertArray(swarmRows?.rows, "swarm get_database_rows.rows", 1);
    const swarmRowId = swarmRows.rows[0].rowUuid;
    assertString(swarmRowId, "swarm rowUuid");

    const moveCardRes = await callTool(client, "move_kanban_card", {
      dashboardId: swarmDashId,
      viewId: swarmViewId,
      rowId: swarmRowId,
      groupByColumnKey: statusKey,
      newValue: "In Progress",
    });
    assertJson(moveCardRes, "move_kanban_card");
    await verifyWrite("move_kanban_card", `card ${swarmRowId} status cell reads 'In Progress'`, () => expectSwarmStatus(swarmRowId, "In Progress"));
    ok("move_kanban_card", "Moved kanban card to 'In Progress'");

    const transitionComment = "QA transition verification complete";
    const transitionRes = await callTool(client, "fusebase_swarm_task_transition", {
      dashboardId: swarmDashId,
      viewId: swarmViewId,
      rowId: swarmRowId,
      groupByColumnKey: statusKey,
      newStatus: "Review",
      comment: transitionComment,
      nextRole: "agent-qa",
      auditColumnKey: auditKey,
      roleColumnKey: roleKey,
    });
    assertObject(transitionRes, "fusebase_swarm_task_transition");
    assertEqual(transitionRes.success, true, "fusebase_swarm_task_transition.success");
    assertEqual(transitionRes.audit?.newStatus, "Review", "fusebase_swarm_task_transition.audit.newStatus");
    assertEqual(transitionRes.auditStored, true, "fusebase_swarm_task_transition.auditStored");
    assertEqual(transitionRes.handoverStored, true, "fusebase_swarm_task_transition.handoverStored");
    await verifyWrite("fusebase_swarm_task_transition", `card ${swarmRowId}: status 'Review', Audit Log contains the comment, Role is agent-qa`, async () => {
      await expectSwarmStatus(swarmRowId, "Review");
      const row = (await readRows(client, swarmDashId, swarmViewId)).find((r: any) => r.rowUuid === swarmRowId);
      assert(!!row, `Swarm row ${swarmRowId} should be returned by get_database_rows`);
      const audit = String(row.cells?.[auditKey] ?? "");
      assertIncludes(audit, transitionComment, "Audit Log cell");
      assertIncludes(audit, "→ Review", "Audit Log cell status");
      assertIncludes(audit, "(handed over to agent-qa)", "Audit Log cell handover");
      // Label cells hold label nanoids; map them back to option names via the schema.
      const roleCol = (await readSchema(client, swarmDashId, swarmViewId)).find((c: any) => c.key === roleKey);
      assert(!!roleCol, `Role column ${roleKey} should be in the schema`);
      assertEqual(JSON.stringify(labelNames(roleCol, row.cells?.[roleKey])), JSON.stringify(["agent-qa"]), "Role cell (label names)");
    });
    ok("fusebase_swarm_task_transition", "Transitioned task with audit log");
  } finally {
    await cleanup(`delete swarm database ${swarmDbId}`, () => callTool(client, "delete_database", { databaseId: swarmDbId }));
  }

  // ──────────────────────────────────────────────────────────────────
  // Suite 11: Developer CLI & Hosted Vibe Apps
  // ──────────────────────────────────────────────────────────────────
  suiteHeader("SUITE 11: Developer CLI & Hosted Vibe Apps");

  const cliStatus = await callTool(client, "fusebase_cli_status");
  assertObject(cliStatus, "fusebase_cli_status");
  assertBoolean(cliStatus.installed, "cliStatus.installed");
  assertString(cliStatus.installCommand, "cliStatus.installCommand");
  ok("fusebase_cli_status", `CLI installed: ${cliStatus.installed}`);

  // These CLI commands mutate hosted apps (scaffold, deploy, sidecars, secrets, permissions) and
  // need a real app to target; the suite has no sandbox app, so they are never run blind.
  const cliMutatingTools = [
    "fusebase_cli_init",
    "fusebase_cli_deploy",
    "fusebase_cli_sidecar_add",
    "fusebase_cli_sidecar_list",
    "fusebase_cli_sidecar_remove",
    "fusebase_cli_secret_create",
    "fusebase_cli_secret_list",
    "fusebase_cli_logs",
    "fusebase_cli_app_update",
  ];
  if (!cliStatus.installed) {
    // Verify the not-installed path reports an error instead of pretending to succeed.
    let notInstalledError: unknown;
    try {
      await callTool(client, "fusebase_cli_list_apps");
    } catch (e) {
      notInstalledError = e;
    }
    assert(
      notInstalledError instanceof ToolError && /FuseBase CLI not found/i.test(notInstalledError.detail),
      `fusebase_cli_list_apps should fail with 'FuseBase CLI not found' when the CLI is not installed, got: ${notInstalledError === undefined ? "success" : errMsg(notInstalledError)}`,
    );
    skip("fusebase_cli_list_apps", "FuseBase CLI not installed (verified tool reports the missing CLI)");
    skipAll(cliMutatingTools, "FuseBase CLI not installed");
  } else {
    // `fusebase app list` needs a project with fusebase.json; the repo ships one under apps/
    // (which is inside the CLI tools' allowed working directories).
    const cliApps = await callTool(client, "fusebase_cli_list_apps", { cwd: path.join(ROOT_DIR, "apps", "client-portal-dashboard") });
    assertObject(cliApps, "fusebase_cli_list_apps");
    assertEqual(cliApps.success, true, "fusebase_cli_list_apps.success");
    ok("fusebase_cli_list_apps", "Queried registered hosted apps");
    skipAll(cliMutatingTools, "mutates hosted apps; the suite has no sandbox app to target");
  }

  const vibePageRes = await callTool(client, "create_interactive_app_page", {
    workspaceId: targetWsId,
    title: "QA Vibe Code Widget",
    appUrl: "https://example.com/vibe-widget",
    description: "### Custom Vibe App",
  });
  assertObject(vibePageRes, "create_interactive_app_page response");
  const vibePageId = vibePageRes.id;
  assertString(vibePageId, "vibePageId");
  try {
    await verifyWrite("create_interactive_app_page", `page ${vibePageId} titled 'QA Vibe Code Widget' embeds https://example.com/vibe-widget under its description`, async () => {
      const meta = await callTool(client, "get_page", { workspaceId: targetWsId, pageId: vibePageId });
      assertObject(meta, "get_page (vibe page)");
      assertEqual(meta.title, "QA Vibe Code Widget", "vibe page title");
      const html = await callTool(client, "get_page_content", { workspaceId: targetWsId, pageId: vibePageId, format: "html" });
      assertIncludes(html, "Custom Vibe App", "vibe page description");
      assertIncludes(html, "https://example.com/vibe-widget", "vibe page remote-frame src");
    });
  } finally {
    await cleanup(`delete page ${vibePageId}`, () => callTool(client, "delete_page", { workspaceId: targetWsId, pageId: vibePageId }));
  }
  ok("create_interactive_app_page", `Created remote-frame page ${vibePageId}`);

  // ──────────────────────────────────────────────────────────────────
  // Suite 12: Diagnostics, Preferences & Offline Guides
  // ──────────────────────────────────────────────────────────────────
  suiteHeader("SUITE 12: Diagnostics, Preferences & Offline Guides");

  const verRes = await callTool(client, "check_version");
  assertObject(verRes, "check_version");
  assertString(verRes.version, "version");
  ok("check_version", `Running FuseBase MCP v${verRes.version}`);

  // refresh_auth launches a browser and rewrites the stored session cookie, and it can take
  // longer than the 60s MCP request timeout (COR-23). Opt in explicitly.
  if (process.env.FUSEBASE_TEST_REFRESH_AUTH === "1") {
    const refreshRes = await callTool(client, "refresh_auth");
    assertIncludes(refreshRes, "Authentication refreshed successfully", "refresh_auth response");
    ok("refresh_auth", "Refreshed authenticated session");
  } else {
    skip("refresh_auth", "launches a browser and rewrites the stored cookie; set FUSEBASE_TEST_REFRESH_AUTH=1 to run");
  }

  const health = await callTool(client, "check_session_health");
  assertObject(health, "check_session_health");
  assertEqual(health.authenticated, true, "health.authenticated");
  if (health.status === "WARNING" && health.gateError) {
    // Honest partial state: the session works but the Gate token was rejected. Gate-only
    // suites below will fail until the token is regenerated.
    console.log(`⚠️  check_session_health: WARNING — Gate token rejected (${String(health.gateError).slice(0, 120)})`);
  } else {
    assertEqual(health.status, "HEALTHY", "health.status");
  }
  ok("check_session_health", `Session state is ${health.status} (${health.ageHours}h old)`);

  const profiles = await callTool(client, "list_agent_profiles");
  assertObject(profiles, "list_agent_profiles");
  assertArray(profiles.profiles, "profiles.profiles", 1);
  ok("list_agent_profiles", `Found ${profiles.profiles.length} agent profiles`);

  const switchRes = await callTool(client, "switch_active_profile", { profile: "default" });
  assertIncludes(switchRes, "Active profile switched to 'default'", "switch_active_profile response");
  ok("switch_active_profile", "Switched active profile to 'default'");

  assertString(await callTool(client, "set_tool_tier", { tier: "core" }), "set_tool_tier (core)");
  assertString(await callTool(client, "set_tool_tier", { tier: "all" }), "set_tool_tier (all)");
  ok("set_tool_tier", "Switched tool tier core -> all");

  const userPrefs = await callTool(client, "get_user_preferences");
  assertObject(userPrefs, "get_user_preferences");
  ok("get_user_preferences", "Validated user UI preferences");

  // The sidebar state is the user var sidebarCollapsed ("1"/"0"). Flip it, prove it, then restore it.
  /** sidebarCollapsed as reported by get_user_preferences. */
  const readSidebarCollapsed = async (): Promise<boolean | undefined> => sidebarCollapsedOf(await callTool(client, "get_user_preferences"));
  const setSidebar = async (collapsed: boolean): Promise<void> => {
    const sidebarRes = await callTool(client, "set_sidebar_collapsed", { collapsed });
    assertObject(sidebarRes, "set_sidebar_collapsed");
    assertEqual(sidebarRes.success, true, "sidebarRes.success");
  };
  const expectSidebar = (collapsed: boolean) => async (): Promise<void> => {
    assertEqual(await readSidebarCollapsed(), collapsed, "get_user_preferences sidebarCollapsed");
  };
  // This is the account owner's real UI setting: never write it without knowing the value to
  // restore, and always restore it, even if a check fails.
  const initialCollapsed = sidebarCollapsedOf(userPrefs);
  assert(initialCollapsed !== undefined, `get_user_preferences should expose the sidebarCollapsed user var, got: ${JSON.stringify(userPrefs).slice(0, 300)}`);
  let sidebarRestored = false;
  try {
    await setSidebar(!initialCollapsed);
    await verifyWrite("set_sidebar_collapsed", `sidebarCollapsed flipped to ${!initialCollapsed}`, expectSidebar(!initialCollapsed));
    await setSidebar(initialCollapsed);
    await verifyWrite("set_sidebar_collapsed", `sidebarCollapsed restored to ${initialCollapsed}`, expectSidebar(initialCollapsed));
    sidebarRestored = true;
  } finally {
    if (!sidebarRestored) {
      await cleanup("restore sidebarCollapsed", () => callTool(client, "set_sidebar_collapsed", { collapsed: initialCollapsed }));
    }
  }
  ok("set_sidebar_collapsed", "Updated sidebar collapsed state");

  const billingInfo = await callTool(client, "get_billing_info");
  assertObject(billingInfo, "get_billing_info");
  assert(billingInfo.credit !== undefined && !isNaN(Number(billingInfo.credit)), "billingInfo.credit should be a valid number or numeric string");
  ok("get_billing_info", "Validated billing credits and subscription plan");

  const dashTemplates = await callTool(client, "get_dashboard_templates");
  assertObject(dashTemplates, "get_dashboard_templates");
  assertArray(dashTemplates.data, "dashTemplates.data");
  ok("get_dashboard_templates", `Verified dashboard templates (${dashTemplates.data.length} templates)`);

  const entityTemplates = await callTool(client, "get_database_entity_templates");
  assertObject(entityTemplates, "get_database_entity_templates");
  assertArray(entityTemplates.data, "entityTemplates.data");
  ok("get_database_entity_templates", `Verified entity models (${entityTemplates.data.length} templates)`);

  const memberRoles = await callTool(client, "get_member_roles");
  assertArray(memberRoles, "get_member_roles", 1);
  ok("get_member_roles", `Validated member roles catalog (${memberRoles.length} roles)`);

  const premStatus = await callTool(client, "get_workspace_premium_status", { workspaceId: targetWsId });
  assertObject(premStatus, "get_workspace_premium_status");
  ok("get_workspace_premium_status", "Validated workspace premium status");

  const importStatus = await callTool(client, "get_active_import_status", { workspaceId: targetWsId });
  assert(importStatus === null || (typeof importStatus === "object"), `get_active_import_status should return JSON (object or null), got: ${JSON.stringify(importStatus)?.slice(0, 300)}`);
  ok("get_active_import_status", "Validated import job status response");

  const guideSections = await callTool(client, "list_guide_sections");
  assertObject(guideSections, "list_guide_sections");
  assertArray(guideSections.sections, "guideSections.sections", 10);
  assertNumber(guideSections.total_guides, "guideSections.total_guides");
  ok("list_guide_sections", `Validated guide catalog (${guideSections.sections.length} sections, ${guideSections.total_guides} guides)`);

  const searchGuidesRes = await callTool(client, "search_guides", { query: "database" });
  assertObject(searchGuidesRes, "search_guides");
  assertArray(searchGuidesRes.results, "searchGuidesRes.results", 1);
  const sampleGuide = searchGuidesRes.results[0];
  assertString(sampleGuide.title, "sampleGuide.title");
  assertString(sampleGuide.section, "sampleGuide.section");
  assertString(sampleGuide.slug, "sampleGuide.slug");
  ok("search_guides", `Found guide '${sampleGuide.title}'`);
  const guideContent = await callTool(client, "get_guide", { section: sampleGuide.section, slug: sampleGuide.slug });
  assertString(guideContent, "guideContent", 50);
  assert(!guideContent.startsWith("Guide not found"), `get_guide could not find ${sampleGuide.section}/${sampleGuide.slug}`);
  ok("get_guide", `Retrieved guide '${sampleGuide.title}' (${guideContent.length} chars)`);

  // ──────────────────────────────────────────────────────────────────
  // Suite 13: PostgreSQL Gate Isolated SQL Stores
  // ──────────────────────────────────────────────────────────────────
  suiteHeader("SUITE 13: PostgreSQL Gate Isolated SQL Stores");

  const sqlTools = [
    "create_isolated_store",
    "apply_isolated_sql_migrations",
    "list_isolated_sql_tables",
    "insert_isolated_sql_row",
    "batch_insert_isolated_sql_rows",
    "select_isolated_sql_rows",
    "query_isolated_sql",
    "execute_isolated_sql",
  ];
  const storesProbe = await optional("list_isolated_stores", GATE_UNAVAILABLE, () => callTool(client, "list_isolated_stores", { orgId }));
  if (!storesProbe) {
    skipAll(sqlTools, "isolated SQL stores unavailable (see list_isolated_stores skip)");
  } else {
    const stores = storesProbe.value;
    assertArray(stores, "list_isolated_stores");
    ok("list_isolated_stores", `Listed isolated stores (${stores.length})`);

    // There is no delete tool for stores (TST-11), and with a token-managed session a new
    // store is bound to the token's app. So the suite reuses an existing store and only
    // creates one when explicitly allowed.
    let storeId: string | undefined;
    const existingStore = stores.find((s: any) => s.alias === SANDBOX_STORE_ALIAS);
    if (existingStore) {
      storeId = existingStore.id ?? existingStore.globalId;
      assertString(storeId, "existing sandbox store id");
      skip("create_isolated_store", `sandbox store '${SANDBOX_STORE_ALIAS}' already exists (no delete tool, so it is reused rather than re-created)`);
    } else if (process.env.FUSEBASE_TEST_CREATE_SQL_STORE === "1") {
      const createdStore = await callTool(client, "create_isolated_store", { alias: SANDBOX_STORE_ALIAS, engine: "postgres", storeType: "sql", orgId });
      assertObject(createdStore, "create_isolated_store");
      storeId = createdStore.id ?? createdStore.globalId;
      assertString(storeId, "create_isolated_store.id");
      const createdStoreId = storeId;
      await verifyWrite("create_isolated_store", `list_isolated_stores lists '${SANDBOX_STORE_ALIAS}' as ${createdStoreId}`, async () => {
        const listedStores = await callTool(client, "list_isolated_stores", { orgId });
        assertArray(listedStores, "list_isolated_stores");
        const listed = listedStores.find((s: any) => s.alias === SANDBOX_STORE_ALIAS);
        assert(!!listed, `Created store '${SANDBOX_STORE_ALIAS}' should be listed`);
        assertEqual(listed.id ?? listed.globalId, createdStoreId, "listed store id");
      });
      ok("create_isolated_store", `Provisioned sandbox store '${SANDBOX_STORE_ALIAS}' (${storeId}); it persists for reuse`);
    } else {
      skipAll(sqlTools, `no '${SANDBOX_STORE_ALIAS}' store and stores can't be deleted; set FUSEBASE_TEST_CREATE_SQL_STORE=1 to create one`);
    }

    if (storeId) {

    const table = "qa_validation_events";
    const bundle = {
      version: "1",
      name: "qa-validation",
      migrations: [
        {
          version: "001",
          name: "create_qa_validation_events",
          sql: `CREATE TABLE IF NOT EXISTS ${table} (id text PRIMARY KEY, run_id text NOT NULL, event_type text NOT NULL);`,
        },
      ],
    };
    assertJson(await callTool(client, "apply_isolated_sql_migrations", { storeId, stage: SQL_STAGE, bundle, dryRun: true }), "apply_isolated_sql_migrations (dry run)");
    noReadBack("apply_isolated_sql_migrations", "dry run: validates the bundle without applying it, so nothing is stored (the real run below is verified)");
    assertJson(await callTool(client, "apply_isolated_sql_migrations", { storeId, stage: SQL_STAGE, bundle, dryRun: false }), "apply_isolated_sql_migrations");
    let tableCount = 0;
    await verifyWrite("apply_isolated_sql_migrations", `list_isolated_sql_tables includes ${table}`, async () => {
      const tablesRes = await callTool(client, "list_isolated_sql_tables", { storeId, stage: SQL_STAGE });
      assertArray(tablesRes, "list_isolated_sql_tables");
      assertIncludes(JSON.stringify(tablesRes), table, "list_isolated_sql_tables contains migrated table");
      tableCount = tablesRes.length;
    });
    ok("apply_isolated_sql_migrations", `Applied migration bundle (dry run + real) creating ${table}`);
    ok("list_isolated_sql_tables", `Listed tables (${tableCount})`);

    const runId = `run-${Date.now()}`;
    /** This run's rows, keyed by id. */
    const readRunRows = async (): Promise<Map<string, any>> => {
      const res = await callTool(client, "select_isolated_sql_rows", { storeId, stage: SQL_STAGE, table, where: { run_id: runId }, limit: 10 });
      assertObject(res, "select_isolated_sql_rows");
      assertArray(res.rows, "select_isolated_sql_rows.rows");
      return new Map(res.rows.map((r: any) => [r.id, r]));
    };
    try {
      const insertRes = await callTool(client, "insert_isolated_sql_row", { storeId, stage: SQL_STAGE, table, row: { id: `${runId}-1`, run_id: runId, event_type: "single" } });
      assertJson(insertRes, "insert_isolated_sql_row");
      await verifyWrite("insert_isolated_sql_row", `row ${runId}-1 reads back with event_type 'single'`, async () => {
        assertEqual((await readRunRows()).get(`${runId}-1`)?.event_type, "single", `${runId}-1 event_type`);
      });
      ok("insert_isolated_sql_row", "Inserted single row");

      const batchRes = await callTool(client, "batch_insert_isolated_sql_rows", {
        storeId,
        stage: SQL_STAGE,
        table,
        rows: [
          { id: `${runId}-2`, run_id: runId, event_type: "batch_1" },
          { id: `${runId}-3`, run_id: runId, event_type: "batch_2" },
        ],
      });
      assertJson(batchRes, "batch_insert_isolated_sql_rows");
      await verifyWrite("batch_insert_isolated_sql_rows", `rows ${runId}-2 / -3 read back with event_type batch_1 / batch_2`, async () => {
        const rows = await readRunRows();
        assertEqual(rows.get(`${runId}-2`)?.event_type, "batch_1", `${runId}-2 event_type`);
        assertEqual(rows.get(`${runId}-3`)?.event_type, "batch_2", `${runId}-3 event_type`);
      });
      ok("batch_insert_isolated_sql_rows", "Batch inserted rows");

      const selectRes = await callTool(client, "select_isolated_sql_rows", { storeId, stage: SQL_STAGE, table, where: { run_id: runId }, limit: 10 });
      assertObject(selectRes, "select_isolated_sql_rows");
      assertArray(selectRes.rows, "select_isolated_sql_rows.rows", 3);
      ok("select_isolated_sql_rows", `Selected ${selectRes.rows.length} rows for this run`);

      const queryRes = await callTool(client, "query_isolated_sql", { storeId, stage: SQL_STAGE, sql: `SELECT count(*)::int AS n FROM ${table} WHERE run_id = $1`, params: [runId] });
      assertObject(queryRes, "query_isolated_sql");
      assertArray(queryRes.rows, "query_isolated_sql.rows", 1);
      assertEqual(Number(queryRes.rows[0].n), 3, "query_isolated_sql count");
      ok("query_isolated_sql", "Read-only count query returned 3");

      const execRes = await callTool(client, "execute_isolated_sql", { storeId, stage: SQL_STAGE, sql: `DELETE FROM ${table} WHERE run_id = $1`, params: [runId] });
      assertObject(execRes, "execute_isolated_sql");
      assertEqual(Number(execRes.rowCount), 3, "execute_isolated_sql.rowCount");
      await verifyWrite("execute_isolated_sql", `no rows left for ${runId}`, async () => {
        const countRes = await callTool(client, "query_isolated_sql", { storeId, stage: SQL_STAGE, sql: `SELECT count(*)::int AS n FROM ${table} WHERE run_id = $1`, params: [runId] });
        assertArray(countRes?.rows, "query_isolated_sql.rows", 1);
        assertEqual(Number(countRes.rows[0].n), 0, "rows left for this run after DELETE");
      });
      ok("execute_isolated_sql", "Deleted this run's rows (rowCount 3)");
    } finally {
      await cleanup(`delete isolated rows for ${runId}`, () =>
        callTool(client, "execute_isolated_sql", { storeId, stage: SQL_STAGE, sql: `DELETE FROM ${table} WHERE run_id = $1`, params: [runId] }),
      );
    }
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Suite 14: FuseBase Work & Firecrawl (n8n trigger runs in Suite 9)
  // ──────────────────────────────────────────────────────────────────
  suiteHeader("SUITE 14: FuseBase Work & Firecrawl");

  // COR-25: thread creation now sends the required workspaceId, but the request body the
  // server expects is still unknown (it answers 500). Tracked as a known gap until the web
  // app's request is captured.
  const runAgentId = numericAgent ? String(numericAgent.id) : firstAgentGlobalId;
  /** The tool's payload, or undefined when it fails (ToolError). */
  const tryWork = async (tool: string, args: Record<string, unknown>): Promise<any> => {
    try {
      const res = await callTool(client, tool, args);
      assertJson(res, tool);
      return res;
    } catch (err) {
      if (!(err instanceof ToolError)) throw err;
      return undefined;
    }
  };
  const runAgentRes = await tryWork("fusebase_work_run_agent", { workspaceId: targetWsId, agentId: runAgentId, prompt: "Status check for data validation suite" });
  knownGap("COR-25", "fusebase_work_run_agent starts an agent thread", runAgentRes !== undefined);
  if (runAgentRes !== undefined) {
    // A failed call records no write; a successful one must show up as a thread of the agent.
    const threadId = String(runAgentRes.globalId ?? runAgentRes.id ?? runAgentRes.threadId ?? runAgentRes.thread?.globalId ?? runAgentRes.thread?.id ?? "");
    if (!numericAgent) {
      noReadBack("fusebase_work_run_agent", "list_ai_agent_threads needs a numeric agent id and list_agents returned none");
    } else {
      await verifyWrite("fusebase_work_run_agent", `agent ${numericAgent.id} lists the new thread ${threadId}`, async () => {
        assertString(threadId, "fusebase_work_run_agent thread id");
        const threads = await callTool(client, "list_ai_agent_threads", { agentId: String(numericAgent.id) });
        assertArray(threads, "list_ai_agent_threads");
        assertIncludes(JSON.stringify(threads), threadId, "list_ai_agent_threads contains the started thread");
      });
    }
  }
  knownGap("COR-25", "fusebase_work_scrape_url starts a scraping agent thread",
    (await tryWork("fusebase_work_scrape_url", { workspaceId: targetWsId, url: "https://example.com", formats: ["markdown"] })) !== undefined);

  if (!automationAvailable) console.log("(fusebase_work_trigger_n8n skipped with automations — see Suite 9)");

  // ──────────────────────────────────────────────────────────────────
  // Suite 15: Direct Gate Bridge & Token Management
  // ──────────────────────────────────────────────────────────────────
  suiteHeader("SUITE 15: Direct Gate Bridge & Token Management");

  const gateTools = [
    "fusebase_token_permission_catalog",
    "fusebase_gate_whoami",
    "fusebase_token_create",
    "fusebase_token_get",
    "fusebase_token_revoke",
    "fusebase_direct_tool_call",
  ];
  const tokenListProbe = await optional("fusebase_token_list", GATE_UNAVAILABLE, () => callTool(client, "fusebase_token_list", { limit: 10 }));
  if (!tokenListProbe) {
    skipAll(gateTools, "Gate token not configured / Gate unavailable (see fusebase_token_list skip)");
  } else {
    assertJson(tokenListProbe.value, "fusebase_token_list");
    ok("fusebase_token_list", "Listed tokens");

    const catalogRes = await callTool(client, "fusebase_token_permission_catalog", {});
    assertJson(catalogRes, "fusebase_token_permission_catalog");
    ok("fusebase_token_permission_catalog", "Queried Gate permission catalog");

    const whoamiRes = await callTool(client, "fusebase_gate_whoami", { target: "gate" });
    assertJson(whoamiRes, "fusebase_gate_whoami");
    ok("fusebase_gate_whoami", "Verified token identity & tenant context");

    // The create response contains the one-time secret: never log it.
    const tokenName = `E2E QA Probe Token ${Date.now()}`;
    const createTokenRes = await callTool(client, "fusebase_token_create", {
      name: tokenName,
      scopes: [{ scope_type: "org", scope_id: orgId }],
      permissions: ["notes.read"],
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    assert(createTokenRes !== null && typeof createTokenRes === "object", "fusebase_token_create should return a JSON object");
    // Live shape: { ok, opId, data: { success, data: { global_id, token (secret), ... } } }
    const tokenId = createTokenRes?.data?.data?.global_id;
    assertString(tokenId, "fusebase_token_create token id");
    ok("fusebase_token_create", `Created scoped token ${tokenId} (secret not logged)`);

    let tokenRevoked = false;
    try {
      // Token payloads are never echoed in failure messages, in case one carries a secret.
      await verifyWrite("fusebase_token_create", `token ${tokenId} reads back with its name and the notes.read permission`, async () => {
        const getTokenRes = await callTool(client, "fusebase_token_get", { tokenId });
        assertJson(getTokenRes, "fusebase_token_get");
        const text = JSON.stringify(getTokenRes);
        assert(text.includes(tokenId), "fusebase_token_get should reference the created token id");
        assert(text.includes(tokenName), "fusebase_token_get should show the created token's name");
        assert(text.includes("notes.read"), "fusebase_token_get should show the notes.read permission");
      });
      ok("fusebase_token_get", "Looked up created token");

      const revokeRes = await callTool(client, "fusebase_token_revoke", { tokenId });
      assertJson(revokeRes, "fusebase_token_revoke");
      tokenRevoked = true;
      await verifyWrite("fusebase_token_revoke", `token ${tokenId} reads back as revoked (or not found)`, async () => {
        const res = await readUnlessGone(() => callTool(client, "fusebase_token_get", { tokenId }));
        if (res.gone) return;
        const text = JSON.stringify(res.value);
        assert(
          /"(revoked_at|revokedAt)"\s*:\s*"[^"]+"|"(revoked|is_revoked|isRevoked)"\s*:\s*true|"status"\s*:\s*"revoked"|"(is_active|isActive|active)"\s*:\s*false/i.test(text),
          "fusebase_token_get should show the token as revoked (revoked_at / revoked / status / is_active field)",
        );
      });
      ok("fusebase_token_revoke", "Revoked created token");
    } finally {
      if (!tokenRevoked) await cleanup(`revoke token ${tokenId}`, () => callTool(client, "fusebase_token_revoke", { tokenId }));
    }

    const directRes = await callTool(client, "fusebase_direct_tool_call", { opId: "listIsolatedStores", args: { orgId }, target: "gate" });
    assertJson(directRes, "fusebase_direct_tool_call");
    ok("fusebase_direct_tool_call", "Dispatched direct Gate bridge tool call");
  }

  // ──────────────────────────────────────────────────────────────────
  // Coverage: every registered tool must be exercised or explicitly skipped
  // ──────────────────────────────────────────────────────────────────
  const skippedNames = new Set(stats.skipped.map((s) => s.what));
  const uncovered = toolsList.tools.map((t) => t.name).filter((n) => !stats.executedTools.has(n) && !skippedNames.has(n));
  assert(uncovered.length === 0, `Registered tools neither exercised nor skipped (${uncovered.length}): ${uncovered.join(", ")}`);
  console.log(`\n[Coverage] ${toolsList.tools.length} registered tools: exercised or explicitly skipped (skips listed below).`);
}

runSuite("Live data validation", main);
