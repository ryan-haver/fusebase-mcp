/**
 * COR-24: Gate tool_call arguments must follow the Gate SDK contracts
 * (apps/client-portal-dashboard/vendor/fusebase-gate-sdk): path params at the top level,
 * request fields inside `body`. Found live — createIsolatedStore was rejected with
 * "Unrecognized keys: alias, engine, storeType, source".
 */
import { describe, expect, it, vi } from "vitest";
import { FusebaseClient } from "../../src/client.js";

function clientWithBridge(scopes: Array<{ scope_type: string; scope_id: string }> = []) {
  const toolCall = vi.fn(async () => ({ data: { store: { globalId: "s1" }, success: true } }));
  const whoami = vi.fn(async () => ({ auth: { scopes } }));
  const bridge = { hasGate: true, isConfigured: true, getIdentity: async () => ({ orgId: "org1" }), toolCall, whoami };
  const client = new FusebaseClient({ host: "unit-test.invalid", orgId: "org1", autoRefresh: false, gateBridge: bridge as any });
  return { client, toolCall };
}

describe("Gate isolated-store contracts (COR-24)", () => {
  it("createIsolatedStore puts the store fields in body", async () => {
    const { client, toolCall } = clientWithBridge();
    await client.createIsolatedStore("qa-store");
    expect(toolCall).toHaveBeenCalledWith("createIsolatedStore", {
      orgId: "org1",
      body: { alias: "qa-store", storeType: "sql", engine: "postgres", source: { sourceType: "org", sourceId: "org1" } },
    });
  });

  // Live: "Token-managed isolated stores must use sourceType 'app'".
  it("defaults the store source to the token's app scope when one exists", async () => {
    const { client, toolCall } = clientWithBridge([
      { scope_type: "org", scope_id: "org1" },
      { scope_type: "client", scope_id: "app123" },
    ]);
    await client.createIsolatedStore("qa-store");
    expect(toolCall).toHaveBeenCalledWith("createIsolatedStore", expect.objectContaining({
      body: expect.objectContaining({ source: { sourceType: "app", sourceId: "app123" } }),
    }));
  });

  it("applyIsolatedStoreSqlMigrations puts bundle and dryRun in body, stage in the path", async () => {
    const { client, toolCall } = clientWithBridge();
    const bundle = { version: 1, migrations: [] };
    await client.applyIsolatedStoreSqlMigrations("store1", bundle, "dev", true);
    expect(toolCall).toHaveBeenCalledWith("applyIsolatedStoreSqlMigrations", {
      orgId: "org1",
      storeId: "store1",
      stage: "dev",
      body: { bundle, dryRun: true },
    });
  });
});
