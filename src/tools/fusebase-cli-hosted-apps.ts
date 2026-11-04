import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";
import { FusebaseCliManager } from "../cli-manager.js";

export function registerFusebaseCliHostedAppsTools(server: McpServer, _getClient: (profile?: string) => FusebaseClient): void {
  // === FuseBase CLI & Hosted Apps ===

  registerAnnotatedTool(server,
    "fusebase_cli_status",
    "Check if the official FuseBase developer CLI (`fusebase`) is installed, detect its version, binary path, and authentication state.",
    {},
    async () => {
      try {
        const status = await FusebaseCliManager.getStatus();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(status, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_cli_update",
    "Preview or apply official FuseBase CLI updates. Defaults to a dry run and CLI-only update; includeProduct also refreshes the product's managed agent assets, MCP configuration and dependencies. Does not create Git commits.",
    {
      cwd: z.string().optional().describe("Product directory for an optional managed product update"),
      dryRun: z.boolean().default(true).describe("Print the update plan without changing files; false applies it"),
      includeProduct: z.boolean().default(false).describe("Also update the managed product in cwd, including assets, MCP tokens/configuration and dependencies"),
      environment: z.string().optional().describe("Named app environment from environments/<name>.json"),
    },
    async (options) => {
      try {
        const result = await FusebaseCliManager.update(options);
        return { isError: !result.success, content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) { return errorResult(error); }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_cli_init",
    "Initialize a new FuseBase hosted app product using the official CLI in noninteractive mode. Git initialization/synchronization is skipped. Creates a remote product and local project files.",
    {
      name: z.string().describe("Name of the product/app to create"),
      orgId: z.string().optional().describe("Organization ID to link the product to"),
      cwd: z.string().optional().describe("Target directory path (defaults to current working directory)"),
      forceDirty: z.boolean().optional().describe("Force initialization even if directory is not empty"),
    },
    async ({ name, orgId, cwd, forceDirty }) => {
      try {
        // Pass the name as-is: spawn already delivers it as one argument.
        const args = ["--name", name, "--yes", "--skip-git"];
        if (orgId) args.push("--org", orgId);
        if (forceDirty) args.push("--force-dirty");
        const res = await FusebaseCliManager.executeCommand("init", args, cwd, 300000);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(res, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_cli_list_apps",
    "List configured FuseBase hosted web applications and their URLs.",
    {
      cwd: z.string().optional().describe("Project directory to inspect"),
      environment: z.string().optional().describe("Named app environment from environments/<name>.json"),
    },
    async ({ cwd, environment }) => {
      try {
        const args = ["list"];
        if (environment) args.push("--env", environment);
        const res = await FusebaseCliManager.executeCommand("app", args, cwd);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(res, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_cli_deploy",
    "Deploy a FuseBase web application to production hosting via the FuseBase CLI.",
    {
      cwd: z.string().optional().describe("Project directory to deploy"),
      environment: z.string().optional().describe("Named app environment from environments/<name>.json"),
    },
    async ({ cwd, environment }) => {
      try {
        const res = await FusebaseCliManager.executeCommand("deploy", environment ? ["--env", environment] : [], cwd, 300000);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(res, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_cli_sidecar_add",
    "Add an auxiliary Docker sidecar container (e.g. headless Chromium, Redis cache, Lightpanda) to an app backend via the FuseBase CLI.",
    {
      appPath: z.string().describe("Relative path or ID of the app (e.g. 'apps/my-app')"),
      name: z.string().describe("Name of the sidecar container (e.g. 'chromium', 'redis')"),
      image: z.string().describe("Docker image (e.g. 'browserless/chrome:latest', 'redis:7-alpine')"),
      port: z.number().optional().describe("Local port number exposed by the container (e.g. 9222, 6379)"),
      tier: z.enum(["small", "medium", "large"]).optional().describe("Resource tier for the sidecar (default small)"),
      env: z.record(z.string(), z.string()).optional().describe("Static environment variables as key-value pairs"),
      secrets: z.array(z.string()).optional().describe("Secret keys allowlisted for this sidecar (e.g. ['DB_PASSWORD', 'REDIS_TOKEN:AUTH'])"),
      cwd: z.string().optional().describe("Project directory path"),
    },
    async ({ appPath, name, image, port, tier, env, secrets, cwd }) => {
      try {
        const res = await FusebaseCliManager.addSidecar(appPath, name, image, { port, tier, env, secrets, cwd });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(res, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_cli_sidecar_list",
    "List configured Docker sidecar containers for an app via the FuseBase CLI.",
    {
      appPath: z.string().describe("Relative path or ID of the app (e.g. 'apps/my-app')"),
      cwd: z.string().optional().describe("Project directory path"),
    },
    async ({ appPath, cwd }) => {
      try {
        const res = await FusebaseCliManager.listSidecars(appPath, cwd);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(res, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_cli_sidecar_remove",
    "Remove a Docker sidecar container from an app via the FuseBase CLI.",
    {
      appPath: z.string().describe("Relative path or ID of the app (e.g. 'apps/my-app')"),
      name: z.string().describe("Name of the sidecar container to remove"),
      cwd: z.string().optional().describe("Project directory path"),
    },
    async ({ appPath, name, cwd }) => {
      try {
        const res = await FusebaseCliManager.removeSidecar(appPath, name, cwd);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(res, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_cli_secret_create",
    "Declare an app secret key in local fusebase.json via the CLI. Deploy/dev start registers the key on the platform; secret values are set in the FuseBase UI.",
    {
      appPath: z.string().describe("Relative path or ID of the app (e.g. 'apps/my-app')"),
      key: z.string().describe("Secret key name (e.g. 'STRIPE_API_KEY', 'DB_PASSWORD')"),
      description: z.string().optional().describe("Optional human-readable description for the secret"),
      cwd: z.string().optional().describe("Project directory path"),
    },
    async ({ appPath, key, description, cwd }) => {
      try {
        const res = await FusebaseCliManager.createSecret(appPath, key, description, cwd);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(res, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_cli_secret_list",
    "List secret key declarations from local fusebase.json. The current CLI has no secret list command. Returns keys/descriptions only, not values or remote provisioning status.",
    {
      appPath: z.string().describe("Relative path or ID of the app (e.g. 'apps/my-app')"),
      cwd: z.string().optional().describe("Project directory path"),
    },
    async ({ appPath, cwd }) => {
      try {
        const res = await FusebaseCliManager.listSecrets(appPath, cwd);
        return {
          isError: !res.success,
          content: [
            { type: "text" as const, text: JSON.stringify(res, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_cli_logs",
    "Retrieve runtime or build logs for a deployed FuseBase app (fusebase remote-logs).",
    {
      appPath: z.string().optional().describe("App (feature) ID of the deployed app; required for 'remote' and 'build'"),
      lines: z.number().optional().describe("Number of runtime log entries to retrieve (1-1000; CLI default 100)"),
      type: z.enum(["remote", "build", "dev"]).optional().describe("Log source: 'remote' runtime logs (default), 'build' build logs. 'dev' is not available from the CLI (local dev output is printed by `fusebase dev start`)"),
      cwd: z.string().optional().describe("Project directory path"),
    },
    async ({ appPath, lines, type, cwd }) => {
      try {
        const res = await FusebaseCliManager.getLogs(appPath, { lines, type, cwd });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(res, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_cli_app_update",
    "Update app access and permissions via the FuseBase CLI. Access replaces the entire principal list; inspect the app first. Build/dev/output settings belong in fusebase.json.",
    {
      appIdOrPath: z.string().describe("App ID or directory path to update"),
      permissions: z.string().optional().describe("Dashboard view permissions (e.g. 'dashboardView.dashId:viewId.read,write')"),
      access: z.string().optional().describe("Replacement access principals, e.g. 'visitor,orgRole:member'; read current app access before replacing"),
      syncGatePermissions: z.boolean().optional().describe("Analyze app code and merge required Gate permissions without pruning existing grants"),
      environment: z.string().optional().describe("Named app environment from environments/<name>.json"),
      devCommand: z.string().optional().describe("Deprecated: rejected with guidance to edit fusebase.json"),
      buildCommand: z.string().optional().describe("Deprecated: rejected with guidance to edit fusebase.json"),
      outputDir: z.string().optional().describe("Deprecated: rejected with guidance to edit fusebase.json"),
      cwd: z.string().optional().describe("Project directory path"),
    },
    async ({ appIdOrPath, ...options }) => {
      try {
        const res = await FusebaseCliManager.updateApp(appIdOrPath, options);
        return {
          isError: !res.success,
          content: [
            { type: "text" as const, text: JSON.stringify(res, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
