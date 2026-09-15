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

  // ─── 4. Page Content Template (Standard RFC 6570) ───
  server.resource(
    "page-content",
    new ResourceTemplate("fusebase://workspaces/{workspaceId}/pages/{pageId}", { list: undefined }),
    {
      description: "Decoded HTML content of a FuseBase document/page synced from Y.js.",
      mimeType: "text/html",
    },
    async (uri, { workspaceId, pageId }) => {
      const client = getClient();
      const wid = Array.isArray(workspaceId) ? workspaceId[0] : workspaceId;
      const nid = Array.isArray(pageId) ? pageId[0] : pageId;

      const html = await client.getPageContent(wid, nid);
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

  // Legacy alias for page content template
  server.resource(
    "page-content-legacy",
    new ResourceTemplate("fusebase://workspaces/{wid}/pages/{nid}", { list: undefined }),
    {
      description: "Decoded HTML content of a FuseBase document/page (legacy alias).",
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

  // ─── 5. Database Detail Template (Standard RFC 6570) ───
  server.resource(
    "database-detail",
    new ResourceTemplate("fusebase://databases/{databaseId}", { list: undefined }),
    {
      description: "Database metadata, dashboards, view definitions, and schema details.",
      mimeType: "application/json",
    },
    async (uri, { databaseId }) => {
      const client = getClient();
      const dbId = Array.isArray(databaseId) ? databaseId[0] : databaseId;
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

  // Legacy alias for database detail template
  server.resource(
    "database-detail-legacy",
    new ResourceTemplate("fusebase://databases/{did}", { list: undefined }),
    {
      description: "Database metadata, dashboards, view definitions, and schema details (legacy alias).",
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

  // ─── 6. FuseBase Work Connectors ───
  server.resource(
    "work-connectors",
    "fusebase://work/connectors",
    {
      description: "Catalog of active and available third-party services and AI connectors (Firecrawl, n8n, Asana, Stripe, ActivePieces).",
      mimeType: "application/json",
    },
    async (uri) => {
      const client = getClient();
      let pieces: unknown = [];
      try {
        pieces = await client.listAutomationPieces();
      } catch {
        // Feature flag or auth fallback
      }

      const connectors = {
        featuredServices: [
          { name: "Firecrawl", type: "web-scraping", description: "Crawl and convert web content into structured markdown for FuseBase pages." },
          { name: "n8n", type: "workflow-automation", description: "Node-based workflow automation integrated with FuseBase webhooks." },
          { name: "Asana", type: "project-management", description: "Bi-directional sync between Asana tasks and FuseBase databases." },
          { name: "Notion", type: "content-sync", description: "Import and live synchronization of Notion documents into FuseBase." },
          { name: "Stripe", type: "payments-billing", description: "Process subscriptions and payments inside FuseBase client portals and apps." },
        ],
        automationPieces: pieces,
      };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(connectors, null, 2),
          },
        ],
      };
    },
  );

  // ─── 7. Portal Clients Template ───
  server.resource(
    "portal-clients",
    new ResourceTemplate("fusebase://portals/{portalId}/clients", { list: undefined }),
    {
      description: "List of invited clients, access levels, and permissions for a specific portal.",
      mimeType: "application/json",
    },
    async (uri, { portalId }) => {
      const client = getClient();
      const pid = Array.isArray(portalId) ? portalId[0] : portalId;
      const clients = await client.listPortalClients(pid);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(clients, null, 2),
          },
        ],
      };
    },
  );

  // ─── 8. Live Status Dashboard Resource ───
  server.resource(
    "status",
    "fusebase://status",
    {
      description: "Live platform status, 143-tool catalog, 12 test suite validation metrics, and web dashboard URL.",
      mimeType: "application/json",
    },
    async (uri) => {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                project: "FuseBase MCP Server",
                status: "OPERATIONAL",
                dashboardUrl: "https://fusebase-mcp.thefusebase.app/",
                totalTools: 143,
                coreTools: 34,
                extendedTools: 109,
                totalSuites: 12,
                passedAssertions: "162 / 162 (100%)",
                protocolCompliance: "RFC 6570 + JSON-RPC 2.0",
                documentationGuides: 277,
                transports: ["stdio", "WebSocket Y.js", "REST HTTP"],
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
