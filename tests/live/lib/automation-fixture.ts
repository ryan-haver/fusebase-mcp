import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { assert, assertArray, assertEqual, assertString, callTool, verifyWrite } from "./harness.js";

/** Configure and execute only the caller's newly created, disposable QA flow. */
export async function verifyExecutableAutomation(client: Client, flowId: string): Promise<void> {
  const pieces = await callTool(client, "list_automation_pieces");
  const catalog = Array.isArray(pieces) ? pieces : pieces.data;
  assertArray(catalog, "automation pieces");
  const manual = catalog.find((piece: any) => piece.name === "@activepieces/piece-fusebase-manual");
  assertString(manual?.version, "manual trigger piece version");
  const trigger = {
    name: "trigger", displayName: "QA manual trigger", valid: true, type: "PIECE_TRIGGER",
    settings: {
      pieceName: manual.name, pieceVersion: manual.version, pieceType: manual.pieceType,
      packageType: manual.packageType, triggerName: "manual_run", input: {}, inputUiInfo: {},
    },
  };
  await callTool(client, "update_automation_flow", { flowId, type: "UPDATE_TRIGGER", request: trigger });
  await verifyWrite("update_automation_flow", "QA manual trigger saved", async () => {
    const flow = await callTool(client, "get_automation_flow", { flowId });
    assertEqual(flow.version?.trigger?.settings?.pieceName, manual.name, "saved trigger piece");
    assertEqual(flow.version?.trigger?.settings?.triggerName, "manual_run", "saved trigger name");
  });

  // Manual Run intentionally emits an empty event. Correlate each run through this unique flow
  // and its embedded fixture marker, rather than assuming the webhook payload is forwarded.
  const action = {
    name: "qa_result", displayName: "QA calculate result", valid: true, type: "CODE",
    settings: {
      sourceCode: { packageJson: "{}", code: "export const code = async (inputs) => ({ fixture: inputs.fixture, result: Number(inputs.value) * 2 });" },
      input: { fixture: flowId, value: 20 }, inputUiInfo: {},
    },
  };
  const expectAction = async (value: number): Promise<void> => {
    const flow = await callTool(client, "get_automation_flow", { flowId });
    const saved = flow.version?.trigger?.nextAction;
    assertEqual(saved?.name, action.name, "saved action name");
    assertEqual(saved?.settings?.sourceCode?.code, action.settings.sourceCode.code, "saved action code");
    assertEqual(saved?.settings?.input?.fixture, flowId, "saved fixture marker");
    assertEqual(saved?.settings?.input?.value, value, "saved calculation input");
  };
  await callTool(client, "update_automation_flow", { flowId, type: "ADD_ACTION", request: { parentStep: "trigger", action } });
  await verifyWrite("update_automation_flow", "QA code action saved", () => expectAction(20));
  action.settings.input.value = 21;
  await callTool(client, "update_automation_flow", { flowId, type: "UPDATE_ACTION", request: action });
  await verifyWrite("update_automation_flow", "QA code action input updated to 21", () => expectAction(21));
  await callTool(client, "update_automation_flow", { flowId, type: "LOCK_AND_PUBLISH" });
  await verifyWrite("update_automation_flow", "QA flow published and enabled", async () => {
    const flow = await callTool(client, "get_automation_flow", { flowId });
    assertString(flow.publishedVersionId, "published flow version");
    assertEqual(flow.status, "ENABLED", "published flow status");
    await expectAction(21);
  });

  const provenRuns = new Set<string>();
  for (const tool of ["trigger_automation_flow", "fusebase_work_trigger_n8n"]) {
    await callTool(client, tool, { flowId, payload: {} });
    let completedRunId = "";
    await verifyWrite(tool, `distinct successful run calculates 21 * 2 = 42 for QA flow ${flowId}`, async () => {
      const listed = await callTool(client, "list_flow_runs", { limit: 100 });
      const runs = Array.isArray(listed) ? listed : listed.data;
      assertArray(runs, "flow runs");
      const run = runs.find((r: any) => r.flowId === flowId && !provenRuns.has(r.id));
      assert(!!run, `${tool} has no observable new run; an accepted request is not proof`);
      assertEqual(run.status, "SUCCEEDED", "flow must finish successfully");
      const detail = await callTool(client, "list_flow_runs", { runId: run.id });
      assertEqual(detail.id, run.id, "run detail id");
      assertEqual(detail.flowId, flowId, "run detail flowId");
      assertEqual(detail.status, "SUCCEEDED", "run detail status");
      const step = detail.steps?.qa_result;
      assertEqual(step?.status, "SUCCEEDED", "calculation step status");
      assertEqual(step?.output?.fixture, flowId, "execution output fixture marker");
      assertEqual(step?.output?.result, 42, "execution output calculation");
      completedRunId = run.id;
    }, { timeoutMs: 120_000, intervalMs: 2500 });
    provenRuns.add(completedRunId);
    console.log(`✅ ${tool}: run ${completedRunId} completed, fixture matched, calculated result = 42`);
  }
  assertEqual(provenRuns.size, 2, "each trigger must produce its own completed run");
  await callTool(client, "update_automation_flow", { flowId, type: "CHANGE_STATUS", status: "DISABLED" });
  await verifyWrite("update_automation_flow", "QA flow disabled after execution", async () => {
    const flow = await callTool(client, "get_automation_flow", { flowId });
    assertEqual(flow.status, "DISABLED", "flow status after disabling");
  });
}
