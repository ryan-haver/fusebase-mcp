/** What a test stage reported about itself, parsed from its output (see scripts/test-all.ts). */
export interface StageCounts {
  assertions?: { passed: number; total: number };
  skipped?: number;
  knownGaps?: number;
  tools?: number;
}

/** Read the counts from a live suite's closing line (tests/live/lib/harness.ts) or vitest's summary. */
export function parseCounts(output: string): StageCounts {
  const live = [...output.matchAll(/(\d+)\/(\d+) assertions passed, (\d+) skipped, (\d+) known gaps, (\d+) tools exercised/g)].pop();
  if (live) {
    const [passed, total, skipped, knownGaps, tools] = live.slice(1).map(Number);
    return { assertions: { passed, total }, skipped, knownGaps, tools };
  }
  const liveFailed = [...output.matchAll(/FAILED after (\d+)\/(\d+) assertions/g)].pop();
  if (liveFailed) return { assertions: { passed: Number(liveFailed[1]), total: Number(liveFailed[2]) } };
  const vitest = [...output.matchAll(/Tests\s+(.*?)\((\d+)\)/g)].pop();
  if (vitest) {
    const passed = Number(/(\d+) passed/.exec(vitest[1])?.[1] ?? 0);
    const expectedFail = Number(/(\d+) expected fail/.exec(vitest[1])?.[1] ?? 0);
    // Expected failures are known bugs pinned with it.fails: they pass by failing.
    return { assertions: { passed: passed + expectedFail, total: Number(vitest[2]) }, ...(expectedFail ? { knownGaps: expectedFail } : {}) };
  }
  return {};
}
