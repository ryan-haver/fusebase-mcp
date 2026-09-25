/**
 * DOC-1: fusebase://status publishes tool counts, which must match what the server registers,
 * and no test figures (those come from real runs on the status dashboard).
 */
import { describe, expect, it } from "vitest";
import { startServer } from "./helpers/server.js";

async function readStatus(tier: "core" | "all") {
  const srv = await startServer(undefined, { tier });
  try {
    const res = await srv.mcp.readResource({ uri: "fusebase://status" });
    const { tools } = await srv.mcp.listTools();
    return { status: JSON.parse(String((res.contents[0] as { text?: string }).text)), toolCount: tools.length };
  } finally {
    await srv.close();
  }
}

describe("fusebase://status", () => {
  it("reports the tool counts the server actually registers", async () => {
    const all = await readStatus("all");
    const core = await readStatus("core");
    expect(all.status.totalTools).toBe(all.toolCount);
    expect(all.status.coreTools).toBe(core.toolCount);
    expect(all.status.extendedTools).toBe(all.toolCount - core.toolCount);
  });

  it("carries no hard-coded test results", async () => {
    const { status } = await readStatus("core");
    expect(status).not.toHaveProperty("passedAssertions");
    expect(status).not.toHaveProperty("totalSuites");
  });
});
