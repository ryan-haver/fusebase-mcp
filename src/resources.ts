/**
 * MCP Resources for FuseBase
 *
 * Provides direct URI access to FuseBase entities (workspaces, pages, guides, databases)
 * allowing LLMs to load context passively without requiring a tool-call round trip.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FusebaseClient } from "./client.js";
import { loadGuideIndex, listGuideSections, getGuideContent } from "./guide-loader.js";

export function registerResources(
  server: McpServer,
  getClient: (profile?: string) => FusebaseClient,
): void {
  // ─── 1. Workspaces List ───
  server.resource(
    "workspaces",
    "fusebase://workspaces",
    {
      description: "List of all accessible FuseBase workspaces in the organization with IDs, titles, and metadata.",
      mimeType: "application/json",
    },
    async (uri) => {
      const client = getClient();
      const workspaces = await client.listWorkspaces();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(workspaces, null, 2),
          },
        ],
      };
    },
  );

  // ─── 2. Guide Index ───
  server.resource(
    "guides-index",
    "fusebase://guides/index",
    {
      description: "Comprehensive index of all FuseBase documentation guides categorized by section.",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const sections = listGuideSections();
      const allGuides = loadGuideIndex();

      let markdown = "# FuseBase Documentation Guides Index\n\n";
      for (const section of sections) {
        markdown += `## ${section.name} (${section.count} guides)\n\n`;
        const sectionGuides = allGuides.filter((g) => g.section === section.name);
        for (const guide of sectionGuides) {
          markdown += `- **${guide.title}**: \`fusebase://guides/${guide.section}/${guide.slug}\`\n`;
        }
        markdown += "\n";
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: markdown,
          },
        ],
      };
    },
  );

  // ─── 3. Guide Document Template ───
  server.resource(
    "guide-content",
    new ResourceTemplate("fusebase://guides/{section}/{slug}", { list: undefined }),
    {
      description: "Full markdown text of a specific FuseBase guide by section and slug.",
      mimeType: "text/markdown",
    },
    async (uri, { section, slug }) => {
      const guideSection = Array.isArray(section) ? section[0] : section;
      const guideSlug = Array.isArray(slug) ? slug[0] : slug;
      const content = getGuideContent(guideSection, guideSlug);
      if (!content) {
        throw new Error(`Guide with slug '${guideSlug}' in section '${guideSection}' not found.`);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: content,
          },
        ],
      };
    },
  );

  // ─── 4. Page Content Template ───
  server.resource(
    "page-content",
    new ResourceTemplate("fusebase://workspaces/{wid}/pages/{nid}", { list: undefined }),
    {
      description: "Decoded HTML content of a FuseBase document/page synced from Y.js.",
      mimeType: "text/html",
    },
    async (uri, { wid, nid }) => {
      const client = getClient();
      const workspaceId = Array.isArray(wid) ? wid[0] : wid;
      const noteId = Array.isArray(nid) ? nid[0] : nid;

      const html = await client.getPageContent(workspaceId, noteId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/html",
            text: html,
          },
        ],
      };
    },
  );

  // ─── 5. Database Detail Template ───
  server.resource(
    "database-detail",
    new ResourceTemplate("fusebase://databases/{did}", { list: undefined }),
    {
      description: "Database metadata, dashboards, view definitions, and schema details.",
      mimeType: "application/json",
    },
    async (uri, { did }) => {
      const client = getClient();
      const dbId = Array.isArray(did) ? did[0] : did;
      const detail = await client.getDatabaseDetail(dbId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(detail, null, 2),
          },
        ],
      };
    },
  );
}
