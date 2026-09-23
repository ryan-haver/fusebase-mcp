import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

vi.mock("../../src/yjs-ws-writer.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/yjs-ws-writer.js")>();
  return { ...actual, writeContentViaWebSocket: vi.fn(async () => ({ success: true })) };
});

import { writeContentViaWebSocket } from "../../src/yjs-ws-writer.js";
import { fakeClient, startServer } from "./helpers/server.js";

const DESTRUCTIVE_NAME = /(^|_)(delete|revoke|remove|unlink)(_|$)/;

let session: Awaited<ReturnType<typeof startServer>> | undefined;
afterEach(async () => {
  await session?.close();
  session = undefined;
  vi.mocked(writeContentViaWebSocket).mockClear();
});

describe("tool tiers", () => {
  it("registers 34 core tools and 175 after set_tool_tier(all), with unique names", async () => {
    session = await startServer();
    expect((await session.mcp.listTools()).tools).toHaveLength(34);
    const res = await session.callText("set_tool_tier", { tier: "all" });
    expect(res.isError).toBe(false);
    const names = (await session.mcp.listTools()).tools.map((t) => t.name);
    expect(names).toHaveLength(175);
    expect(new Set(names).size).toBe(175);
  });

  it("is idempotent when set_tool_tier(all) is called twice", async () => {
    session = await startServer();
    await session.callText("set_tool_tier", { tier: "all" });
    await session.callText("set_tool_tier", { tier: "all" });
    expect((await session.mcp.listTools()).tools).toHaveLength(175);
  });

  // MCP-3: each of the 141 registrations sends its own list_changed notification.
  it.fails("sends a single tools/list_changed notification per tier switch (MCP-3)", async () => {
    session = await startServer();
    await session.callText("set_tool_tier", { tier: "all" });
    await new Promise((r) => setTimeout(r, 50));
    expect(session.listChanged).toHaveLength(1);
  });

  // MCP-3: there is no way back to the core tier without a restart.
  it.fails("can switch back to the core tier (MCP-3)", async () => {
    session = await startServer();
    await session.callText("set_tool_tier", { tier: "all" });
    await session.callText("set_tool_tier", { tier: "core" });
    expect((await session.mcp.listTools()).tools).toHaveLength(34);
  });

  // MCP-5: the description quotes stale counts (33 / 103 / 136).
  it.fails("describes set_tool_tier with the real tool counts (MCP-5)", async () => {
    session = await startServer();
    const tool = (await session.mcp.listTools()).tools.find((t) => t.name === "set_tool_tier");
    expect(tool?.description).toContain("34");
    expect(tool?.description).toContain("175");
  });
});

describe("tool annotations", () => {
  // MCP-1: 0 of 175 tools declare annotations.
  it.fails("marks every delete/revoke/remove/unlink tool with destructiveHint (MCP-1)", async () => {
    session = await startServer(undefined, { tier: "all" });
    const tools = (await session.mcp.listTools()).tools.filter((t) => DESTRUCTIVE_NAME.test(t.name));
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.filter((t) => t.annotations?.destructiveHint !== true).map((t) => t.name)).toEqual([]);
  });

  it.fails("declares readOnlyHint or destructiveHint on every tool (MCP-1)", async () => {
    session = await startServer(undefined, { tier: "all" });
    const missing = (await session.mcp.listTools()).tools
      .filter((t) => t.annotations?.readOnlyHint === undefined && t.annotations?.destructiveHint === undefined)
      .map((t) => t.name);
    expect(missing).toEqual([]);
  });
});

describe("resources and prompts", () => {
  it("lists 4 static resources, 6 templates and 17 prompts", async () => {
    session = await startServer();
    expect((await session.mcp.listResources()).resources).toHaveLength(4);
    expect((await session.mcp.listResourceTemplates()).resourceTemplates).toHaveLength(6);
    expect((await session.mcp.listPrompts()).prompts).toHaveLength(17);
  });

  // MCP-6: prompt arguments arrive as strings; z.number() rejects them.
  it.fails("accepts numeric prompt arguments sent as strings (MCP-6)", async () => {
    session = await startServer();
    const res = await session.mcp.getPrompt({ name: "crm-seed-demo-data", arguments: { companyCount: "5" } });
    expect(res.messages.length).toBeGreaterThan(0);
  });
});

describe("input validation", () => {
  it("rejects a call with missing required arguments as an error result", async () => {
    session = await startServer();
    const res = await session.callText("get_page", {});
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/invalid/i);
  });
});

describe("download_attachment (SEC-2)", () => {
  let outside: string;
  beforeEach(() => {
    outside = fs.mkdtempSync(path.join(os.tmpdir(), "fusebase-sec2-"));
  });
  afterEach(() => fs.rmSync(outside, { recursive: true, force: true }));

  // SEC-2: outputPath is written verbatim, anywhere on disk.
  it.fails("refuses to write outside the download directory", async () => {
    const client = fakeClient({
      downloadAttachment: async () => ({ base64: Buffer.from("payload").toString("base64"), mime: "application/octet-stream", size: 7 }),
    });
    session = await startServer(client);
    const target = path.join(outside, "written-by-tool.bin");
    const res = await session.callText("download_attachment", {
      workspaceId: "ws", attachmentId: "att", filename: "x.bin", saveToDisk: true, outputPath: target,
    });
    expect(fs.existsSync(target)).toBe(false);
    expect(res.isError).toBe(true);
  });
});

describe("update_page_content", () => {
  // CON-9a: whitespace-only markdown parses to [] and replace=true wipes the page.
  it.fails("refuses to replace a page with empty content (CON-9a)", async () => {
    session = await startServer();
    const res = await session.callText("update_page_content", { workspaceId: "ws", pageId: "p", markdown: "   \n  " });
    expect(writeContentViaWebSocket).not.toHaveBeenCalled();
    expect(res.isError).toBe(true);
  });

  // COR-12: in token-only mode (no cookie) it still tries the cookie WebSocket writer.
  it.fails("does not attempt a cookie WebSocket write in token-only mode (COR-12)", async () => {
    session = await startServer(fakeClient({ getCookie: () => "" }));
    await session.callText("update_page_content", { workspaceId: "ws", pageId: "p", markdown: "# Hello" });
    expect(writeContentViaWebSocket).not.toHaveBeenCalledWith(expect.anything(), "ws", "p", "", expect.anything(), expect.anything());
  });

  it("writes parsed markdown blocks through the WebSocket writer", async () => {
    session = await startServer();
    const res = await session.callText("update_page_content", { workspaceId: "ws", pageId: "p", markdown: "# Hello\n\nWorld" });
    expect(res.isError).toBe(false);
    expect(writeContentViaWebSocket).toHaveBeenCalledTimes(1);
    const blocks = vi.mocked(writeContentViaWebSocket).mock.calls[0][4];
    expect(blocks).toHaveLength(2);
  });
});
