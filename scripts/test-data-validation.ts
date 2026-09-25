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
    await fn();
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

  let folders: any[] = [];
  let foundFolder: any = null;
  for (let attempt = 1; attempt <= 4 && !foundFolder; attempt++) {
    await sleep(1200);
    folders = await callTool(client, "list_folders", { workspaceId: targetWsId });
    assertArray(folders, "list_folders", 1);
    foundFolder = folders.find((f: any) => f.name === folderTitle || f.title === folderTitle || f.id === folderId || f.globalId === folderId);
  }
  assert(!!foundFolder, `Expected newly created folder ${folderId} to appear in list_folders`);
  ok("list_folders", `Verified folder presence in workspace (${folders.length} folders)`);
  // Folders are notes, so delete_page removes them; there is no dedicated delete_folder tool.
  await cleanup(`delete folder ${folderId}`, () => callTool(client, "delete_page", { workspaceId: targetWsId, pageId: folderId }));

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
  const pageId = createPageRes.id;
  assertString(pageId, "created pageId");
  ok("create_page", `Created page '${testPageTitle}' with ID ${pageId}`);

  let pageDeleted = false;
  try {
    const pageMeta = await callTool(client, "get_page", { workspaceId: targetWsId, pageId });
    assertObject(pageMeta, "get_page");
    assertEqual(pageMeta.title, testPageTitle, "page title");
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
    const recheckMeta = await callTool(client, "get_page", { workspaceId: targetWsId, pageId });
    assertEqual(recheckMeta.title, updatedTitle, "renamed page title");
    ok("update_page", "Verified title update round-trip");

    await sleep(2000);
    const appendRes = await callTool(client, "append_page_content", {
      workspaceId: targetWsId,
      pageId,
      markdown: "## Appended Verification Section\n\nAppended paragraph with unique token 987654.",
    });
    assertIncludes(appendRes, "Successfully appended content", "append_page_content response");
    ok("append_page_content", "Append acknowledged");

    let readHtml: unknown = "";
    for (let i = 0; i < 5; i++) {
      await sleep(1500);
      readHtml = await callTool(client, "get_page_content", { workspaceId: targetWsId, pageId, format: "html" });
      if (typeof readHtml === "string" && readHtml.includes("Appended Verification Section")) break;
    }
    assertString(readHtml, "get_page_content (html)");
    assertIncludes(readHtml, "Original Header", "readHtml original header");
    assertIncludes(readHtml, "Appended Verification Section", "readHtml appended section");
    ok("get_page_content (html)", "Verified original + appended HTML content fidelity");

    let readMd: unknown = "";
    for (let i = 0; i < 5; i++) {
      readMd = await callTool(client, "get_page_content", { workspaceId: targetWsId, pageId, format: "markdown" });
      if (typeof readMd === "string" && readMd.includes("987654")) break;
      await sleep(1500);
    }
    assertString(readMd, "get_page_content (markdown)");
    assertIncludes(readMd, "Original Header", "readMd original header");
    assertIncludes(readMd, "987654", "readMd unique token");
    ok("get_page_content (markdown)", "Verified markdown format fidelity");

    const replaceRes = await callTool(client, "update_page_content", {
      workspaceId: targetWsId,
      pageId,
      markdown: "# Replaced Entire Note\n\nAll previous content replaced by clean validation text.",
    });
    assertIncludes(replaceRes, "Content written successfully", "update_page_content response");
    let replacedMd: unknown = "";
    for (let i = 0; i < 5; i++) {
      await sleep(1500);
      replacedMd = await callTool(client, "get_page_content", { workspaceId: targetWsId, pageId, format: "markdown" });
      if (typeof replacedMd === "string" && replacedMd.includes("Replaced Entire Note")) break;
    }
    assertIncludes(replacedMd, "Replaced Entire Note", "update_page_content readback");
    ok("update_page_content", "Verified full content replacement round-trip");

    const moveRes = await callTool(client, "move_page", { workspaceId: targetWsId, pageId, folderId: "root" });
    assertObject(moveRes, "move_page response");
    assertEqual(moveRes.success, true, "move_page.success");
    assertEqual(moveRes.destinationFolderId, "root", "move_page.destinationFolderId");
    ok("move_page", "Moved page to workspace root");

    const deletePageRes = await callTool(client, "delete_page", { workspaceId: targetWsId, pageId });
    assertIncludes(deletePageRes, "deleted successfully", "delete_page response");
    pageDeleted = true;
    ok("delete_page", `Deleted test page ${pageId}`);
  } finally {
    if (!pageDeleted) await cleanup(`delete page ${pageId}`, () => callTool(client, "delete_page", { workspaceId: targetWsId, pageId }));
  }

  // ──────────────────────────────────────────────────────────────────
  // Suite 4: Tags, Files & Attachments
  // ──────────────────────────────────────────────────────────────────
  suiteHeader("SUITE 4: Tags, Files & Attachments");

  const tagNoteRes = await callTool(client, "create_page", {
    workspaceId: targetWsId,
    title: `Tags & Files Test Page ${Date.now()}`,
    markdown: "# Tags and Attachments Testing",
  });
  assertObject(tagNoteRes, "create_page (tags page)");
  const tagPageId = tagNoteRes.id;
  assertString(tagPageId, "tagPageId");

  try {
    const tagsData = await callTool(client, "get_tags", { workspaceId: targetWsId });
    const tagsList = Array.isArray(tagsData) ? tagsData : tagsData?.tags;
    assertArray(tagsList, "get_tags (array or { tags: [] })");
    ok("get_tags", `Validated workspace tags (${tagsList.length} tags)`);

    const testTags = ["qa-audit-test", "val-tag-2"];
    const tagUpdateRes = await callTool(client, "update_page_tags", { workspaceId: targetWsId, pageId: tagPageId, tags: testTags });
    assertIncludes(tagUpdateRes, `Tags updated on page ${tagPageId}`, "update_page_tags response");
    ok("update_page_tags", "Updated page tags");

    const noteTags = await callTool(client, "get_note_tags", { workspaceId: targetWsId, pageId: tagPageId });
    assertJson(noteTags, "get_note_tags");
    assertIncludes(JSON.stringify(noteTags), "qa-audit-test", "get_note_tags contains applied tag");
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

    const attachments = await callTool(client, "get_page_attachments", { workspaceId: targetWsId, pageId: tagPageId });
    assertArray(attachments, "get_page_attachments");
    ok("get_page_attachments", `Validated page attachments list (${attachments.length} items)`);

    const downloadRes = await callTool(client, "download_attachment", {
      workspaceId: targetWsId,
      attachmentId,
      filename: "qa-val-fixture.txt",
    });
    assertObject(downloadRes, "download_attachment response");
    assertString(downloadRes.base64, "download_attachment.base64");
    assertIncludes(Buffer.from(downloadRes.base64, "base64").toString("utf8"), fixtureText, "downloaded fixture bytes");
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

  const commentPageRes = await callTool(client, "create_page", {
    workspaceId: targetWsId,
    title: `Comment Lifecycle Test Page ${Date.now()}`,
    markdown: "# Comments Testing",
  });
  assertObject(commentPageRes, "create_page (comment page)");
  const commentPageId = commentPageRes.id;
  assertString(commentPageId, "commentPageId");

  try {
    const postCommentRes = await callTool(client, "fusebase_post_comment", {
      workspaceId: targetWsId,
      noteId: commentPageId,
      text: "Data validation automated thread comment",
    });
    const postedThread = parseTrailingJson(postCommentRes, "fusebase_post_comment", "Comment posted successfully.");
    assertJson(postedThread, "fusebase_post_comment body");
    ok("fusebase_post_comment", `Posted comment to note ${commentPageId}`);

    const threads = await callTool(client, "get_comment_threads", { workspaceId: targetWsId, pageId: commentPageId });
    // Live shape: [{ thread: { globalId, noteGlobalId, resolved, ... }, comments, unreadComments }]
    assertArray(threads, "get_comment_threads", 1);
    const threadId = threads[0].thread?.globalId;
    assertString(threadId, "get_comment_threads[0].thread.globalId");
    assertEqual(threads[0].thread?.noteGlobalId, commentPageId, "get_comment_threads[0].thread.noteGlobalId");
    ok("get_comment_threads", `Verified thread retrieval (Thread: ${threadId})`);

    const replyRes = await callTool(client, "fusebase_reply_comment", {
      workspaceId: targetWsId,
      threadId,
      text: "Automated reply comment test",
    });
    parseTrailingJson(replyRes, "fusebase_reply_comment", "Reply posted successfully.");
    ok("fusebase_reply_comment", "Posted comment reply");

    const resolveRes = await callTool(client, "fusebase_resolve_thread", { workspaceId: targetWsId, threadId });
    parseTrailingJson(resolveRes, "fusebase_resolve_thread", "Thread resolved successfully.");
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
      const taskDesc = await callTool(client, "get_task_description", { workspaceId: targetWsId, taskId });
      assertJson(taskDesc, "get_task_description");
      ok("get_task_description", "Verified task details readback");

      const timeTracking = await callTool(client, "get_task_time_tracking", { workspaceId: targetWsId, taskId });
      assertJson(timeTracking, "get_task_time_tracking");
      ok("get_task_time_tracking", "Validated time tracking attributes");

      const updatedTaskTitle = `${taskTitle} (Updated & Done)`;
      const updateTaskRes = await callTool(client, "update_task", { workspaceId: targetWsId, taskId, title: updatedTaskTitle, completed: true });
      assertObject(updateTaskRes, "update_task response");
      ok("update_task", "Updated task title and marked completed");

      const searchTasksRes = await callTool(client, "search_tasks", { workspaceId: targetWsId, query: taskTitle });
      assertJson(searchTasksRes, "search_tasks");
      const hits = Array.isArray(searchTasksRes) ? searchTasksRes.length : searchTasksRes?.tasks?.length;
      ok("search_tasks", `Searched tasks by query (${hits ?? "n/a"} hits)`);

      const deleteTaskRes = await callTool(client, "delete_task", { workspaceId: targetWsId, taskId });
      assertIncludes(deleteTaskRes, "deleted successfully", "delete_task response");
      taskDeleted = true;
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
    const dbDetail = await callTool(client, "get_database_detail", { databaseId });
    assertObject(dbDetail, "get_database_detail");
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
    ok("add_database_column", `Added column '${colName}' (Key: ${columnKey})`);

    const renamedColName = "ValidationStatusRenamed";
    const renameColRes = await callTool(client, "rename_database_column", { dashboardId, viewId, columnKey, newName: renamedColName });
    assertJson(renameColRes, "rename_database_column");
    ok("rename_database_column", `Renamed column to '${renamedColName}'`);

    const setWidthRes = await callTool(client, "set_column_width", { dashboardId, viewId, columnKey, width: 240 });
    assertJson(setWidthRes, "set_column_width");
    ok("set_column_width", "Updated column width to 240px");

    const reorderRes = await callTool(client, "reorder_database_columns", { dashboardId, viewId, orderedKeys: [columnKey] });
    assertJson(reorderRes, "reorder_database_columns");
    ok("reorder_database_columns", "Reordered column display sequence");

    const addRowRes = await callTool(client, "add_database_row", { databaseId, dashboardId, viewId, entity: "custom" });
    assertJson(addRowRes, "add_database_row");
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
    ok("update_database_cell", "Updated cell value to 'Verified 100%'");

    const batchPutRes = await callTool(client, "batch_put_database_data", {
      dashboardId,
      viewId,
      rows: [{ create_new_row: true, values: [{ item_key: columnKey, value: "Batch Put Data Item" }] }],
    });
    assertJson(batchPutRes, "batch_put_database_data");
    ok("batch_put_database_data", "Batch row creation accepted");

    const reorderRowsRes = await callTool(client, "reorder_database_rows", { dashboardId, viewId, rowOrders: [{ rowUuid: targetRowUuid, order: 1 }] });
    assertJson(reorderRowsRes, "reorder_database_rows");
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
    ok("create_view", `Created view '${newViewId}'`);

    const dupViewRes = await callTool(client, "duplicate_view", { dashboardId, sourceViewId: newViewId, name: "Kanban Validation View (Copy)" });
    assertObject(dupViewRes, "duplicate_view response");
    const dupViewId = dupViewRes.viewId || dupViewRes.data?.global_id || dupViewRes.id;
    assertString(dupViewId, "duplicated view id");
    ok("duplicate_view", `Duplicated view (New View ID: ${dupViewId})`);

    const updateViewRes = await callTool(client, "update_view", { dashboardId, viewId: newViewId, name: "Kanban Validation View (Renamed)" });
    assertJson(updateViewRes, "update_view");
    ok("update_view", "Updated view name");

    const groupRes = await callTool(client, "set_view_grouping", { dashboardId, viewId: newViewId, groupByColumnKey: columnKey });
    assertJson(groupRes, "set_view_grouping");
    ok("set_view_grouping", "Configured kanban column grouping");

    const repRes = await callTool(client, "set_view_representation", { dashboardId, viewId: newViewId, representationType: "table" });
    assertJson(repRes, "set_view_representation");
    ok("set_view_representation", "Switched representation to 'table'");

    assertJson(await callTool(client, "delete_view", { dashboardId, viewId: dupViewId }), "delete_view (duplicate)");
    assertJson(await callTool(client, "delete_view", { dashboardId, viewId: newViewId }), "delete_view");
    ok("delete_view", "Deleted created and duplicated views");

    // Second database as relation target
    const targetDbRes = await callTool(client, "create_database", { title: `Target Relation DB ${Date.now()}` });
    assertObject(targetDbRes, "create_database (relation target)");
    const targetDbId = targetDbRes.databaseId || targetDbRes.id;
    const targetDashId = targetDbRes.dashboardId;
    const targetViewId = targetDbRes.viewId;
    assertString(targetDbId, "targetDbId");
    assertString(targetDashId, "targetDashId");
    assertString(targetViewId, "targetViewId");

    try {
      assertJson(await callTool(client, "add_database_row", { databaseId: targetDbId, dashboardId: targetDashId, viewId: targetViewId, entity: "custom" }), "add_database_row (target)");
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
      ok("add_relation_column", `Added relation to target DB (Key: ${relationKey}, Relation: ${relationId})`);

      const relations = await callTool(client, "list_database_relations", { dashboardId });
      assertJson(relations, "list_database_relations");
      assertIncludes(JSON.stringify(relations), relationId, "list_database_relations contains created relation");
      ok("list_database_relations", "Queried cross-table relations");

      const relRows = await callTool(client, "get_relation_rows", { relationId });
      assertJson(relRows, "get_relation_rows");
      ok("get_relation_rows", "Queried linked relation rows");

      const linkRes = await callTool(client, "link_database_rows", { relationId, sourceRowUuid: targetRowUuid, targetRowUuid: targetDbRowUuid });
      assertJson(linkRes, "link_database_rows");
      ok("link_database_rows", "Established row-level relation");

      const unlinkRes = await callTool(client, "unlink_database_rows", { relationId, sourceRowUuid: targetRowUuid, targetRowUuid: targetDbRowUuid });
      assertJson(unlinkRes, "unlink_database_rows");
      ok("unlink_database_rows", "Removed row-level relation link");

      const lookupRes = await callTool(client, "add_lookup_column", { dashboardId, viewId, name: "TargetTitleLookup", relationColumnKey: relationKey });
      assertObject(lookupRes, "add_lookup_column response");
      assertString(lookupRes.columnKey, "add_lookup_column.columnKey");
      ok("add_lookup_column", "Created lookup column targeting relation");

      const delRelRes = await callTool(client, "delete_relation", { relationId });
      assertJson(delRelRes, "delete_relation");
      ok("delete_relation", `Deleted relation ${relationId}`);

      const delDashRes = await callTool(client, "delete_dashboard", { dashboardId: targetDashId });
      assertJson(delDashRes, "delete_dashboard");
      ok("delete_dashboard", `Deleted relation-target dashboard ${targetDashId}`);
    } finally {
      await cleanup(`delete relation target database ${targetDbId}`, () => callTool(client, "delete_database", { databaseId: targetDbId }));
    }

    const delRowRes = await callTool(client, "delete_database_row", { dashboardId, rowId: targetRowUuid });
    assertJson(delRowRes, "delete_database_row");
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
    ok("import_csv", "Imported CSV dataset into database");

    const dupDbRes = await callTool(client, "duplicate_database", { sourceDbId: databaseId, title: `${dbTitle} (Clone)` });
    assertObject(dupDbRes, "duplicate_database response");
    const clonedDbId = dupDbRes.databaseId;
    assertString(clonedDbId, "duplicate_database.databaseId");
    ok("duplicate_database", `Cloned database (New DB ID: ${clonedDbId})`);
    await cleanup(`delete cloned database ${clonedDbId}`, () => callTool(client, "delete_database", { databaseId: clonedDbId }));

    const delColRes = await callTool(client, "delete_database_column", { dashboardId, viewId, columnKey });
    assertJson(delColRes, "delete_database_column");
    ok("delete_database_column", `Deleted column ${columnKey}`);

    const updateDbRes = await callTool(client, "update_database", { databaseId, title: `${dbTitle} (Renamed)` });
    assertJson(updateDbRes, "update_database");
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

    const delDbRes = await callTool(client, "delete_database", { databaseId });
    assertJson(delDbRes, "delete_database");
    databaseDeleted = true;
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

      const pubTestPage = await callTool(client, "create_page", {
        workspaceId: targetWsId,
        title: `Portal Publish Test ${Date.now()}`,
        markdown: "# Portal Publishing",
      });
      assertObject(pubTestPage, "create_page (portal page)");
      const pubTestPageId = pubTestPage.id;
      assertString(pubTestPageId, "pubTestPageId");
      try {
        const pubRes = await callTool(client, "publish_page_to_portal", { workspaceId: targetWsId, pageId: pubTestPageId, publish: true });
        assertIncludes(pubRes, "published to", "publish_page_to_portal response");
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
        ok("create_portal_magic_link", "Generated magic link");

        const inviteClientRes = await callTool(client, "invite_portal_client", { portalId, email: inviteEmail });
        assertJson(inviteClientRes, "invite_portal_client");
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

    const createdFolder = await callTool(client, "create_automation_folder", { displayName: `QA Auto Folder ${Date.now()}` });
    assertObject(createdFolder, "create_automation_folder");
    const autoFolderId = createdFolder.id;
    assertString(autoFolderId, "create_automation_folder.id");
    ok("create_automation_folder", `Created automation folder ${autoFolderId}`);
    let autoFolderDeleted = false;
    try {
      const delFolderRes = await callTool(client, "delete_automation_folder", { folderId: autoFolderId });
      assertIncludes(delFolderRes, "deleted successfully", "delete_automation_folder response");
      autoFolderDeleted = true;
      ok("delete_automation_folder", `Deleted automation folder ${autoFolderId}`);
    } finally {
      if (!autoFolderDeleted) await cleanup(`delete automation folder ${autoFolderId}`, () => callTool(client, "delete_automation_folder", { folderId: autoFolderId }));
    }

    const flowsList = await callTool(client, "list_automation_flows");
    assertJson(flowsList, "list_automation_flows");
    ok("list_automation_flows", "Listed automation flows");

    const createFlowRes = await callTool(client, "create_automation_flow", { displayName: `QA Test Flow ${Date.now()}` });
    assertObject(createFlowRes, "create_automation_flow");
    const flowId = createFlowRes.id;
    assertString(flowId, "create_automation_flow.id");
    ok("create_automation_flow", `Created flow ${flowId}`);

    let flowDeleted = false;
    try {
      const flow = await callTool(client, "get_automation_flow", { flowId });
      assertObject(flow, "get_automation_flow");
      assertEqual(flow.id, flowId, "get_automation_flow.id");
      ok("get_automation_flow", "Verified flow definition");

      const updateFlowRes = await callTool(client, "update_automation_flow", { flowId, displayName: "QA Test Flow (Updated)", type: "CHANGE_NAME" });
      assertJson(updateFlowRes, "update_automation_flow");
      ok("update_automation_flow", "Updated flow display name");

      const runs = await callTool(client, "list_flow_runs", { limit: 5 });
      assertJson(runs, "list_flow_runs");
      ok("list_flow_runs", "Queried flow execution runs");

      const triggerRes = await callTool(client, "trigger_automation_flow", { flowId, payload: { qa: true } });
      assertJson(triggerRes, "trigger_automation_flow");
      ok("trigger_automation_flow", "Triggered flow");

      const n8nRes = await callTool(client, "fusebase_work_trigger_n8n", { flowId, payload: { test: true } });
      assertJson(n8nRes, "fusebase_work_trigger_n8n");
      ok("fusebase_work_trigger_n8n", "Triggered flow via FuseBase Work n8n bridge");

      const delFlowRes = await callTool(client, "delete_automation_flow", { flowId });
      assertIncludes(delFlowRes, "deleted successfully", "delete_automation_flow response");
      flowDeleted = true;
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

  const swarmRes = await callTool(client, "fusebase_swarm_init", {
    title: `QA Swarm Data Validation ${Date.now()}`,
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
    // Swarm init does not create a status column, so add one to group/move cards by.
    const statusCol = await callTool(client, "add_database_column", { dashboardId: swarmDashId, viewId: swarmViewId, name: "Status", columnType: "text" });
    const statusKey = statusCol?.columnKey;
    assertString(statusKey, "swarm status columnKey");

    assertJson(await callTool(client, "add_database_row", { databaseId: swarmDbId, dashboardId: swarmDashId, viewId: swarmViewId, entity: "custom" }), "add_database_row (swarm)");
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
    ok("move_kanban_card", "Moved kanban card to 'In Progress'");

    const transitionRes = await callTool(client, "fusebase_swarm_task_transition", {
      dashboardId: swarmDashId,
      viewId: swarmViewId,
      rowId: swarmRowId,
      groupByColumnKey: statusKey,
      newStatus: "Review",
      comment: "QA transition verification complete",
    });
    assertObject(transitionRes, "fusebase_swarm_task_transition");
    assertEqual(transitionRes.success, true, "fusebase_swarm_task_transition.success");
    assertEqual(transitionRes.audit?.newStatus, "Review", "fusebase_swarm_task_transition.audit.newStatus");
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
  ok("create_interactive_app_page", `Created remote-frame page ${vibePageId}`);
  await cleanup(`delete page ${vibePageId}`, () => callTool(client, "delete_page", { workspaceId: targetWsId, pageId: vibePageId }));

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

  const sidebarRes = await callTool(client, "set_sidebar_collapsed", { collapsed: false });
  assertObject(sidebarRes, "set_sidebar_collapsed");
  assertEqual(sidebarRes.success, true, "sidebarRes.success");
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
    assertJson(await callTool(client, "apply_isolated_sql_migrations", { storeId, stage: SQL_STAGE, bundle, dryRun: false }), "apply_isolated_sql_migrations");
    ok("apply_isolated_sql_migrations", `Applied migration bundle (dry run + real) creating ${table}`);

    const tablesRes = await callTool(client, "list_isolated_sql_tables", { storeId, stage: SQL_STAGE });
    assertArray(tablesRes, "list_isolated_sql_tables");
    assertIncludes(JSON.stringify(tablesRes), table, "list_isolated_sql_tables contains migrated table");
    ok("list_isolated_sql_tables", `Listed tables (${tablesRes.length})`);

    const runId = `run-${Date.now()}`;
    try {
      const insertRes = await callTool(client, "insert_isolated_sql_row", { storeId, stage: SQL_STAGE, table, row: { id: `${runId}-1`, run_id: runId, event_type: "single" } });
      assertJson(insertRes, "insert_isolated_sql_row");
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
  const tryWork = async (tool: string, args: Record<string, unknown>): Promise<boolean> => {
    try {
      assertJson(await callTool(client, tool, args), tool);
      return true;
    } catch (err) {
      if (!(err instanceof ToolError)) throw err;
      return false;
    }
  };
  knownGap("COR-25", "fusebase_work_run_agent starts an agent thread",
    await tryWork("fusebase_work_run_agent", { workspaceId: targetWsId, agentId: runAgentId, prompt: "Status check for data validation suite" }));
  knownGap("COR-25", "fusebase_work_scrape_url starts a scraping agent thread",
    await tryWork("fusebase_work_scrape_url", { workspaceId: targetWsId, url: "https://example.com", formats: ["markdown"] }));

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
    const createTokenRes = await callTool(client, "fusebase_token_create", {
      name: `E2E QA Probe Token ${Date.now()}`,
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
      const getTokenRes = await callTool(client, "fusebase_token_get", { tokenId });
      assertJson(getTokenRes, "fusebase_token_get");
      assertIncludes(JSON.stringify(getTokenRes), tokenId, "fusebase_token_get references the created token");
      ok("fusebase_token_get", "Looked up created token");

      const revokeRes = await callTool(client, "fusebase_token_revoke", { tokenId });
      assertJson(revokeRes, "fusebase_token_revoke");
      tokenRevoked = true;
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
