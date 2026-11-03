import { describe, expect, it, vi } from "vitest";
import { FusebaseClient } from "../../src/client.js";

function setup() {
  const client = new FusebaseClient({ host: "unit-test.invalid", orgId: "test", autoRefresh: false });
  const request = vi.spyOn(client as any, "request").mockResolvedValue({});
  return { client, request };
}

describe("automation configuration and execution evidence", () => {
  it("preserves the existing rename contract and rejects missing fields", async () => {
    const { client, request } = setup();
    await client.updateAutomationFlow("qa-flow", { type: "CHANGE_NAME", displayName: "QA" });
    expect(JSON.parse((request.mock.calls[0][1] as { body: string }).body)).toEqual({ type: "CHANGE_NAME", request: { displayName: "QA" } });
    request.mockClear();
    await expect(client.updateAutomationFlow("qa-flow", { type: "CHANGE_STATUS" })).rejects.toThrow("requires status");
    await expect(client.updateAutomationFlow("qa-flow", { type: "ADD_ACTION" })).rejects.toThrow("requires request");
    expect(request).not.toHaveBeenCalled();
  });

  it("sends configuration inside the ActivePieces request wrapper", async () => {
    const { client, request } = setup();
    const action = { parentStep: "trigger", action: { name: "verify", type: "CODE" } };
    await client.updateAutomationFlow("qa-flow", { type: "ADD_ACTION", request: action });
    expect(JSON.parse((request.mock.calls[0][1] as { body: string }).body)).toEqual({ type: "ADD_ACTION", request: action });
    await client.updateAutomationFlow("qa-flow", { type: "LOCK_AND_PUBLISH" });
    expect(JSON.parse((request.mock.calls[1][1] as { body: string }).body)).toEqual({ type: "LOCK_AND_PUBLISH", request: {} });
  });

  it("fetches run details, rather than a list that omits step outputs", async () => {
    const { client, request } = setup();
    await client.listFlowRuns(undefined, 20, "run-1");
    expect(request).toHaveBeenCalledWith("/automation/api/v1/flow-runs/run-1");
  });

  it("reads step outputs from FuseBase's separately stored execution log", async () => {
    const { client, request } = setup();
    request.mockResolvedValueOnce({ id: "run-1", logsFileId: "log-1", status: "SUCCEEDED" });
    request.mockResolvedValueOnce(JSON.stringify({ executionState: { steps: { qa_result: { output: 42 } } } }));
    expect(await client.listFlowRuns(undefined, 20, "run-1")).toMatchObject({ steps: { qa_result: { output: 42 } } });
    expect(request).toHaveBeenLastCalledWith("/automation/api/v1/files/log-1");
  });

  it("does not silently treat missing log output as execution proof", async () => {
    const { client, request } = setup();
    request.mockResolvedValueOnce({ logsFileId: "log-1" });
    request.mockResolvedValueOnce({});
    await expect(client.listFlowRuns(undefined, 20, "run-1")).rejects.toThrow("does not contain step outputs");
  });

  it("uses populated outputs without fetching another file", async () => {
    const { client, request } = setup();
    request.mockResolvedValueOnce({ steps: { qa_result: { output: 42 } }, logsFileId: "log-1" });
    await client.listFlowRuns(undefined, 20, "run-1");
    expect(request).toHaveBeenCalledTimes(1);
  });
});
