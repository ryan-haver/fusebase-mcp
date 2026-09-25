/**
 * DOC-1: the status dashboard's test figures come from real test output, parsed here.
 */
import { describe, expect, it } from "vitest";
import { parseCounts } from "../../scripts/lib/stage-counts.js";

describe("parseCounts", () => {
  it("reads a live suite's closing line", () => {
    const out = "...\n✅ Database & relational live suite: 369/369 assertions passed, 0 skipped, 1 known gaps, 41 tools exercised (41.1s)\n";
    expect(parseCounts(out)).toEqual({ assertions: { passed: 369, total: 369 }, skipped: 0, knownGaps: 1, tools: 41 });
  });

  it("reads how far a failed live suite got", () => {
    const out = "❌ Live data validation FAILED after 445/446 assertions:\n ❌ Assertion failed: ...";
    expect(parseCounts(out)).toEqual({ assertions: { passed: 445, total: 446 } });
  });

  it("reads vitest's summary, counting expected failures as known gaps", () => {
    expect(parseCounts("      Tests  382 passed | 6 expected fail (388)\n")).toEqual({ assertions: { passed: 388, total: 388 }, knownGaps: 6 });
    expect(parseCounts("      Tests  2 failed | 380 passed (382)\n")).toEqual({ assertions: { passed: 380, total: 382 } });
  });

  it("returns nothing for stages that print no counts", () => {
    expect(parseCounts("Found 0 errors.")).toEqual({});
  });
});
