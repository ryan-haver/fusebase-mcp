import {
  assert, assertEqual, assertString, callTool, connectMcp, duringCleanup,
  requireSandboxWorkspace, runSuite, verifyWrite,
} from "./lib/harness.js";
import { verifyExecutableAutomation } from "./lib/automation-fixture.js";

runSuite("Automation execution validation", async () => {
  requireSandboxWorkspace();
  const client = await connectMcp("automation-execution-validation");
  let flowId: string | undefined;
  let deleted = false;
  try {
    const displayName = `QA Execution Validation ${Date.now()}`;
    const created = await callTool(client, "create_automation_flow", { displayName });
    assertString(created.id, "created QA flow ID");
    flowId = created.id;
    await verifyWrite("create_automation_flow", "new QA flow reads back with its unique name", async () => {
      const flow = await callTool(client, "get_automation_flow", { flowId });
      assertEqual(flow.id, flowId, "created flow id");
      assertEqual(flow.version?.displayName, displayName, "created flow name");
    });
    await verifyExecutableAutomation(client, flowId!);
    await callTool(client, "delete_automation_flow", { flowId });
    deleted = true;
    await verifyWrite("delete_automation_flow", "QA flow and its runs are absent after deletion", async () => {
      const flows = await callTool(client, "list_automation_flows");
      assert(!(flows.data ?? flows).some((f: any) => f.id === flowId), "deleted QA flow must be absent");
      const runs = await callTool(client, "list_flow_runs", { limit: 100 });
      assert(!(runs.data ?? runs).some((r: any) => r.flowId === flowId), "deleted QA flow runs must be absent");
    });
  } finally {
    try {
      if (flowId && !deleted) await duringCleanup(async () => {
        await callTool(client, "delete_automation_flow", { flowId });
        const flows = await callTool(client, "list_automation_flows");
        assert(!(flows.data ?? flows).some((f: any) => f.id === flowId), "QA flow cleanup must be confirmed");
      });
    } finally { await client.close(); }
  }
});
