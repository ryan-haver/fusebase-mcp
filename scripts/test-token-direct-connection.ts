/**
 * Live test: direct Gate / Dashboards token connection.
 *
 * Checks that the token-mode tools return real data (identity, permission catalog,
 * token list, isolated stores) and that lookups of a nonexistent token fail cleanly.
 * Requires valid FUSEBASE_GATE_TOKEN / FUSEBASE_DASHBOARDS_TOKEN (or legacy aliases).
 */

import {
  assert,
  assertArray,
  assertObject,
  assertString,
  callTool,
  connectMcp,
  runSuite,
  ToolError,
} from "./lib/live-harness.js";

async function expectToolError(fn: () => Promise<unknown>, what: string): Promise<string> {
  try {
    const result = await fn();
    throw new Error(`${what}: expected an error for a nonexistent token, got success: ${JSON.stringify(result).slice(0, 300)}`);
  } catch (err) {
    if (!(err instanceof ToolError)) throw err;
    return err.detail;
  }
}

async function main() {
  const client = await connectMcp("test-token-direct", { tier: "all" });
  try {
    console.log("1. fusebase_gate_whoami");
    const whoami = await callTool(client, "fusebase_gate_whoami");
    assertObject(whoami, "whoami");
    const identity = whoami.data ?? whoami;
    assertObject(identity, "whoami identity");
    // Live shape: { schemaVersion, server, capabilities, auth: { org: { id }, ... }, defaults, usage }
    assertString(identity.auth?.org?.id, "whoami auth.org.id");

    console.log("2. fusebase_token_permission_catalog");
    const catalog = await callTool(client, "fusebase_token_permission_catalog");
    assertObject(catalog, "permission catalog");
    assert(Object.keys(catalog.data ?? catalog).length > 0, "permission catalog should not be empty");

    console.log("3. fusebase_token_list");
    const list = await callTool(client, "fusebase_token_list", { limit: 5 });
    // Live shape: { ok, opId, data: { success, data: [...tokens], pagination } }
    const tokens = list?.data?.data;
    assertArray(tokens, "token list");

    console.log("4. fusebase_direct_tool_call (listIsolatedStores)");
    const direct = await callTool(client, "fusebase_direct_tool_call", { opId: "listIsolatedStores", args: {}, target: "gate" });
    assert(direct !== undefined && direct !== null, "direct_tool_call should return a payload");

    console.log("5. list_isolated_stores");
    const stores = await callTool(client, "list_isolated_stores");
    assert(stores !== undefined && stores !== null, "list_isolated_stores should return a payload");

    console.log("6. fusebase_token_get (nonexistent id)");
    const getErr = await expectToolError(() => callTool(client, "fusebase_token_get", { tokenId: "non-existent-probe-id" }), "fusebase_token_get");
    assertString(getErr, "token_get error detail");

    console.log("7. fusebase_token_revoke (nonexistent id)");
    const revokeErr = await expectToolError(() => callTool(client, "fusebase_token_revoke", { tokenId: "non-existent-probe-id" }), "fusebase_token_revoke");
    assertString(revokeErr, "token_revoke error detail");
  } finally {
    await client.close();
  }
}

runSuite("Direct token connection", main);
