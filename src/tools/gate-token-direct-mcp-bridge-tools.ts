import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerGateTokenDirectMcpBridgeToolsTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Gate Token & Direct MCP Bridge Tools ===

  registerAnnotatedTool(server,
    "fusebase_token_list",
    "List all FuseBase API tokens belonging to the organization / user with scopes, provisioning source, and expiry via FuseBase Gate.",
    {
      tokenSource: z.enum(["manual", "app"]).optional().describe("Filter by provisioning source ('manual' for user-created, 'app' for app-provisioned)"),
      includeExpired: z.boolean().optional().describe("When true, returns expired tokens (hidden by default)"),
      page: z.number().min(1).optional().describe("Pagination page number (default 1)"),
      limit: z.number().min(1).max(100).optional().describe("Page size limit (default 20, max 100)"),
      profile: z.string().optional().describe("Named authentication profile"),
    },
    async ({ tokenSource, includeExpired, page, limit, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.listTokens({
          token_source: tokenSource,
          include_expired: includeExpired,
          page,
          limit,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_token_create",
    "Create a new FuseBase API token with specified scopes and permissions (secret token returned only once) via FuseBase Gate.",
    {
      name: z.string().describe("Human-readable name or purpose for the token"),
      scopes: z.array(z.object({
        scope_type: z.string().describe("Scope type (e.g. 'org' or 'client')"),
        scope_id: z.string().describe("Scope target ID (e.g. organization ID or app client ID)"),
      })).describe("Resource scopes to bind the token to"),
      permissions: z.array(z.string()).describe("Permission strings (e.g. ['health.read', 'notes.read', 'isolated_store.read'])"),
      expiresAt: z.string().optional().describe("Optional ISO 8601 expiration timestamp"),
      profile: z.string().optional().describe("Named authentication profile"),
    },
    async ({ name, scopes, permissions, expiresAt, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.createToken({
          name,
          scopes,
          permissions,
          expires_at: expiresAt || null,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_token_get",
    "Retrieve details of a specific FuseBase API token by its global ID via FuseBase Gate.",
    {
      tokenId: z.string().describe("Global ID of the token to retrieve"),
      profile: z.string().optional().describe("Named authentication profile"),
    },
    async ({ tokenId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.getToken(tokenId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_token_revoke",
    "Permanently revoke (soft delete) a FuseBase API token so it can no longer be used for authentication.",
    {
      tokenId: z.string().describe("Global ID of the token to revoke"),
      profile: z.string().optional().describe("Named authentication profile"),
    },
    async ({ tokenId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.revokeToken(tokenId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_token_permission_catalog",
    "List all platform base permissions and service-owned permissions registered on the FuseBase Gate platform.",
    {
      profile: z.string().optional().describe("Named authentication profile"),
    },
    async ({ profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.listPermissionCatalog();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_gate_whoami",
    "Query the authenticated token identity, tenant organization ID, custom domain, default workspace, and granted scopes/permissions from FuseBase Gate or Dashboards MCP.",
    {
      target: z.enum(["gate", "dashboards"]).optional().describe("Upstream target gateway (defaults to 'gate')"),
      profile: z.string().optional().describe("Named authentication profile"),
    },
    async ({ target, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.gateWhoami(target);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_discover_operations",
    "Discover current Gate or Dashboards API operations without registering their schemas as local tools. Omit opId to list/search compact summaries; provide opId for its schema. Pass promptGroups from requiredPrompts to load domain guidance before fusebase_direct_tool_call.",
    {
      opId: z.string().optional().describe("Operation name to describe; omit to list/search operations"),
      schemaMode: z.enum(["input", "output", "both", "summary", "full"]).default("input").describe("Schema detail for opId; input is compact, both includes output, full can be large"),
      promptGroups: z.array(z.string().min(1)).min(1).max(20).optional().describe("Fetch domain guidance for these requiredPrompts groups, e.g. ['authz','notes']; may accompany opId"),
      query: z.string().optional().describe("Case-insensitive substring filter over operation names and descriptions"),
      limit: z.number().int().min(1).max(200).default(30).describe("Maximum operation summaries returned per page"),
      offset: z.number().int().min(0).default(0).describe("Offset into filtered operation summaries"),
      target: z.enum(["gate", "dashboards"]).optional().describe("Upstream gateway; defaults to Gate if configured, otherwise Dashboards"),
      profile: z.string().optional().describe("Named authentication profile"),
    },
    async ({ opId, schemaMode, promptGroups, query, limit, offset, target, profile }) => {
      try {
        const bridge = getClient(profile).gateBridge;
        if (!bridge) throw new Error("Operation discovery requires a Gate or Dashboards MCP token.");
        let result: unknown;
        if (opId) result = await bridge.toolsDescribe(opId, target, schemaMode);
        else if (promptGroups) result = undefined;
        else {
          const terms = (query ?? "").toLowerCase();
          const all = (await bridge.toolsList(target)).filter((tool) => `${tool.name} ${tool.description ?? ""}`.toLowerCase().includes(terms));
          const page = all.slice(offset, offset + limit);
          result = { total: all.length, offset, nextOffset: offset + limit < all.length ? offset + limit : null,
            operations: page.map(({ name, title, description, schemaVersion, dangerous }) => ({ name, title, description, schemaVersion, dangerous })) };
        }
        if (promptGroups) result = { operation: result, guidance: await bridge.promptsSearch(promptGroups, target) };
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) { return errorResult(error); }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_direct_tool_call",
    "Execute an official Gate or Dashboards operation. Discover its schema with fusebase_discover_operations first; set applyDefaults=false to send exactly the supplied arguments for strict or newly added operations.",
    {
      opId: z.string().describe("Operation identifier (e.g. 'listIsolatedStores', 'listTokens', 'sendOrgEmail', 'listPortals')"),
      args: z.record(z.string(), z.unknown()).optional().describe("Operation argument payload object"),
      applyDefaults: z.boolean().optional().describe("Inject legacy org/workspace defaults (default true); false preserves the exact discovered argument contract"),
      target: z.enum(["gate", "dashboards"]).optional().describe("Upstream target gateway ('gate' or 'dashboards', default 'gate')"),
      profile: z.string().optional().describe("Named authentication profile"),
    },
    async ({ opId, args, applyDefaults, target, profile }) => {
      const client = getClient(profile);
      try {
        if (!client.gateBridge) {
          throw new Error("Direct tool call requires Gate MCP bridge. Configure FUSEBASE_GATE_TOKEN or FUSEBASE_TOKEN.");
        }
        const result = await client.gateBridge.toolCall(opId, args || {}, target, { applyDefaults });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
