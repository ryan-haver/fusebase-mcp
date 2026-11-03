/** Explicit account-wide checks. Run under op; defaults to neither operation. */
import {
  assert, assertEqual, assertIncludes, assertString, callTool, connectMcp,
  findUserVar, requireSandboxWorkspace, runSuite, verifyWrite,
} from "./lib/harness.js";

function sidebarValue(preferences: unknown): boolean {
  const found = findUserVar(preferences, "sidebarCollapsed");
  assert(found !== undefined, "original sidebar value must be known before changing it");
  assert(["0", "1", 0, 1, false, true].includes(found.value as string | number | boolean), "sidebar value must be recognized");
  return found.value === "1" || found.value === 1 || found.value === true;
}

runSuite("Account preference and authentication validation", async () => {
  const preferences = process.argv.includes("--preferences");
  const refresh = process.argv.includes("--refresh-auth");
  assert(preferences || refresh, "choose --preferences and/or --refresh-auth explicitly");
  const workspaceId = requireSandboxWorkspace();
  let client = await connectMcp("account-validation");
  try {
    if (preferences) {
      const original = sidebarValue(await callTool(client, "get_user_preferences"));
      try {
        await callTool(client, "set_sidebar_collapsed", { collapsed: !original });
        await verifyWrite("set_sidebar_collapsed", "sidebar preference changed and read back", async () => {
          assertEqual(sidebarValue(await callTool(client, "get_user_preferences")), !original, "changed sidebar state");
        });
      } finally {
        await callTool(client, "set_sidebar_collapsed", { collapsed: original });
        await verifyWrite("set_sidebar_collapsed", "original sidebar preference restored and read back", async () => {
          assertEqual(sidebarValue(await callTool(client, "get_user_preferences")), original, "restored sidebar state");
        });
      }
    }

    if (refresh) {
      const result = await callTool(client, "refresh_auth", { interactive: false }, { timeoutMs: 420_000 });
      assertIncludes(result, "Authentication refreshed successfully", "auth refresh response");
      // A new server must load the newly persisted cookie, rather than reuse in-memory auth.
      await client.close();
      client = await connectMcp("refreshed-account-validation");
      const health = await callTool(client, "check_session_health");
      assertEqual(health.authenticated, true, "refreshed session authenticated");
      assert(["HYBRID", "SESSION_COOKIE"].includes(health.authMode), "refresh must retain cookie authentication");
      assert(typeof health.ageHours === "number" && health.ageHours < 1, "persisted cookie must be fresh");
      // This endpoint requires the cookie, so a working Gate token cannot mask a broken refresh.
      const workspace = await callTool(client, "get_workspace_detail", { workspaceId });
      assertString(workspace.workspaceId ?? workspace.globalId ?? workspace.id, "cookie-authenticated workspace read");
      assertEqual(workspace.workspaceId ?? workspace.globalId, workspaceId, "refreshed session reads the intended sandbox");
      console.log("✅ Fresh cookie persisted and authenticated read succeeded from a new MCP process");
    }
  } finally { await client.close(); }
});
