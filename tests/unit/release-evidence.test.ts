import { describe, expect, it, vi } from "vitest";
import { evidenceState, requireReleaseEvidence, type EvidenceRun } from "../../scripts/lib/evidence.js";
import { verifyRelease } from "../../scripts/lib/deployment-verification.js";
import { requireAuthRejection, ExpectedRestriction } from "../live/lib/restriction.js";
const source = { commit: "commit", sourceHash: "hash", dirty: false };
const complete: EvidenceRun = { schemaVersion: 2, runId: "run", source, selectedStages: ["Unit"], startedAt: "now", complete: true, runtime: "node", stages: { Unit: { kind: "offline", order: 0, passed: true, secs: 1, runAt: "now", commit: "commit" } } };
describe("REV-08 evidence identity", () => {
  it("distinguishes matching, stale, incomplete and missing evidence", () => {
    expect(evidenceState(complete, source)).toBe("current");
    expect(evidenceState(complete, {...source,dirty:true})).toBe("working-tree");
    expect(evidenceState({...complete,source:{...source,dirty:true}},source)).toBe("working-tree");
    expect(evidenceState(complete, { ...source, sourceHash: "changed" })).toBe("stale");
    expect(evidenceState({ ...complete, sourceChanged: true }, source)).toBe("stale");
    expect(evidenceState({ ...complete, complete: false }, source)).toBe("incomplete");
    expect(evidenceState({ ...complete, selectedStages: ["Unit", "Missing"] }, source)).toBe("incomplete");
    expect(evidenceState(undefined, source)).toBe("missing");
    expect(evidenceState({...complete, stages:{Unit:{...complete.stages.Unit,commit:"older"}}},source)).toBe("stale");
  });
});
describe("REV-07 deployment verification", () => {
  const release = { commit: "commit", sourceHash: "hash", buildId: "build", evidenceRunId: "run" };
  it.each([500, 403])("fails closed on HTTP %s", async status => {
    const fetcher = vi.fn(async () => new Response("error", { status }));
    await expect(verifyRelease("https://example.invalid/", release, { fetcher, attempts: 1 })).rejects.toThrow(`HTTP ${status}`);
  });
  it("rejects stale 200 responses and times out on network failures", async () => {
    await expect(verifyRelease("https://example.invalid/", release, { attempts: 1, fetcher: vi.fn(async () => Response.json({ ...release, commit: "old" })) })).rejects.toThrow("identity");
    await expect(verifyRelease("https://example.invalid/", release, { attempts: 1, fetcher: vi.fn(async () => { throw new Error("timeout"); }) })).rejects.toThrow("timeout");
  });
  it("polls until the exact release is visible", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ ...release, buildId: "old" })).mockResolvedValueOnce(Response.json(release));
    await verifyRelease("https://example.invalid/", release, { fetcher, attempts: 2, delayMs: 0 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
it("does not count timeouts, malformed data or false values as permission restrictions", () => {
  expect(() => requireAuthRejection({ success: false, error: "JWT auth failed: 403" })).toThrow(ExpectedRestriction);
  for (const error of ["Timeout", "malformed JSON", "HTTP 500", undefined]) {
    try { requireAuthRejection({ success: false, error }); } catch (failure) { expect(failure).not.toBeInstanceOf(ExpectedRestriction); }
  }
});

it("requires every selected release stage to pass, even when required offline stages pass", () => {
  expect(() => requireReleaseEvidence(complete, source, ["Unit"])).not.toThrow();
  const run = {...complete, selectedStages:["Unit","Live"], stages:{...complete.stages, Live:{...complete.stages.Unit,kind:"live" as const,passed:false}}};
  expect(() => requireReleaseEvidence(run, source, ["Unit"])).toThrow("passing evidence");
  expect(() => requireReleaseEvidence(complete, source, ["Missing"])).toThrow();
  expect(() => requireReleaseEvidence(complete, {...source,dirty:true}, ["Unit"])).toThrow();
});
