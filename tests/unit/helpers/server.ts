/**
 * In-process MCP server + client wired the same way as createFusebaseServer() in
 * src/index.ts, but with a fake FusebaseClient so no network is touched.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { registerCoreTools } from "../../../src/tools/core-tools.js";
import { registerExtendedTools } from "../../../src/tools/extended-tools.js";
import { registerResources } from "../../../src/resources.js";
import { registerPrompts } from "../../../src/prompts.js";
import type { FusebaseClient } from "../../../src/client.js";

/**
 * A FusebaseClient stand-in: listed methods are used as given, anything else rejects
 * so an unexpected network path shows up as a clear test failure.
 */
export function fakeClient(overrides: Record<string, unknown> = {}): FusebaseClient {
  const base: Record<string, unknown> = { host: "unit-test.invalid", orgId: "unit-org", getCookie: () => "unit-cookie", ...overrides };
  return new Proxy(base, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === "then") return undefined;
      return () => Promise.reject(new Error(`fakeClient: ${prop}() not stubbed`));
    },
  }) as unknown as FusebaseClient;
}

export async function startServer(client: FusebaseClient = fakeClient(), opts: { tier?: "core" | "all" } = {}) {
  const server = new McpServer({ name: "fusebase", version: "test" });
  let extended = false;
  const enableExtendedTools = () => {
    if (extended) return;
    registerExtendedTools(server, () => client);
    extended = true;
  };
  registerCoreTools(server, () => client, {
    enableExtendedTools,
    isExtendedToolsEnabled: () => extended,
    setActiveProfile: () => {},
    getActiveProfile: () => undefined,
  });
  registerResources(server, () => client);
  registerPrompts(server, () => client);
  if (opts.tier === "all") enableExtendedTools();

  const mcp = new Client({ name: "unit", version: "0" }, { capabilities: {} });
  const listChanged: number[] = [];
  mcp.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
    listChanged.push(Date.now());
  });

  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), mcp.connect(clientSide)]);

  return {
    mcp,
    listChanged,
    async callText(name: string, args: Record<string, unknown> = {}) {
      const res = await mcp.callTool({ name, arguments: args });
      return { isError: Boolean(res.isError), text: String((res.content as any)?.[0]?.text ?? "") };
    },
    async close() {
      await mcp.close();
      await server.close();
    },
  };
}
