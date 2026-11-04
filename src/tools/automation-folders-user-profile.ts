import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerAutomationFoldersUserProfileTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Automation Folders & User Profile ===

  registerAnnotatedTool(server,
    "list_automation_folders",
    "List all automation workflow folders configured in ActivePieces. Returns folder IDs, names, badge colors, and project associations.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ profile }) => {
      const client = getClient(profile);
      try {
        const folders = await client.listAutomationFolders();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(folders, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "create_automation_folder",
    "Create a new workflow organization folder in the ActivePieces automation engine to categorize and group automation flows.",
    {
      displayName: z.string().describe("Display name for the automation folder"),
      color: z
        .string()
        .optional()
        .describe("Folder color badge (e.g. 'teal', 'blue', 'purple', 'rose')"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ displayName, color, profile }) => {
      const client = getClient(profile);
      try {
        const folder = await client.createAutomationFolder(displayName, color);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(folder, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "delete_automation_folder",
    "[DESTRUCTIVE] Delete an automation workflow folder from ActivePieces. This unassigns any flows contained within the folder without deleting the flows themselves.",
    {
      folderId: z.string().describe("Automation folder ID to delete"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ folderId, profile }) => {
      const client = getClient(profile);
      try {
        await client.deleteAutomationFolder(folderId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Automation folder ${folderId} deleted successfully.`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_automation_user",
    "Get the profile and identity details of the authenticated ActivePieces automation engine user (email, name, ID, platform associations).",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ profile }) => {
      const client = getClient(profile);
      try {
        const user = await client.getAutomationUser();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(user, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
