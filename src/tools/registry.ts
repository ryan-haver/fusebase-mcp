import type { McpServer, RegisteredTool, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import { publicErrorMessage } from "../error-redaction.js";

const registrations = new WeakMap<McpServer, Map<string, RegisteredTool>>();

export { toolAnnotations } from "../tool-effects.js";
import { toolAnnotations } from "../tool-effects.js";

/** Keep public SDK handles so tier changes can disable tools as well as hide their schemas. */
export function registeredTools(server: McpServer): ReadonlyMap<string, RegisteredTool> {
  return registrations.get(server) ?? new Map();
}

export function registerAnnotatedTool<Args extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: Args,
  handler: ToolCallback<Args>,
): RegisteredTool {
  // Client acquisition happens before many handlers' local try/catch blocks. Keep one
  // final boundary so those errors cannot bypass diagnostic redaction.
  const guarded = (async (...args: Parameters<ToolCallback<Args>>) => {
    try {
      // The SDK expresses ToolCallback as a conditional type. Preserve its exact
      // Parameters/ReturnType tuple while forwarding it through this generic wrapper.
      const invoke = handler as unknown as (...params: Parameters<ToolCallback<Args>>) => ReturnType<ToolCallback<Args>>;
      return await invoke(...args);
    } catch (error) {
      return { isError: true, content: [{ type: "text" as const, text: `Error: ${publicErrorMessage(error)}` }] };
    }
  }) as ToolCallback<Args>;
  const tool = server.registerTool(name, { description, inputSchema, annotations: toolAnnotations(name) }, guarded);
  let tools = registrations.get(server);
  if (!tools) { tools = new Map(); registrations.set(server, tools); }
  tools.set(name, tool);
  return tool;
}
