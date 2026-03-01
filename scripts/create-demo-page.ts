/**
 * Create a comprehensive showcase page demonstrating every supported
 * block type and inline format in the FuseBase MCP server.
 *
 * Usage:
 *   npx tsx scripts/create-demo-page.ts
 *   npx tsx scripts/create-demo-page.ts --workspace <id>
 */
import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import type { ContentBlock } from "../src/content-schema.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq > 0 && !process.env[t.slice(0, eq).trim()])
      process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const WS_ID = process.argv.includes("--workspace")
  ? process.argv[process.argv.indexOf("--workspace") + 1]
  : (process.env.FUSEBASE_WORKSPACE_ID || "45h7lom5ryjak34u");
const COOKIE = process.env.FUSEBASE_COOKIE || loadEncryptedCookie()?.cookie!;

async function main() {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  const blocks: ContentBlock[] = [
    // ═══════════════════════════════════════════════
    // HEADER
    // ═══════════════════════════════════════════════
    { type: "heading", level: 1, children: [{ text: "FuseBase MCP — Content Showcase" }] },
    {
      type: "paragraph", children: [
        { text: "This page demonstrates " },
        { text: "every supported block type", bold: true },
        { text: " and " },
        { text: "inline format", italic: true },
        { text: " in the FuseBase MCP server. Generated programmatically via the Y.js WebSocket writer." },
      ]
    },
    { type: "divider" },

    // ═══════════════════════════════════════════════
    // INLINE FORMATS
    // ═══════════════════════════════════════════════
    { type: "heading", level: 2, children: [{ text: "Inline Formats" }] },
    {
      type: "paragraph", children: [
        { text: "Bold", bold: true },
        { text: " · " },
        { text: "Italic", italic: true },
        { text: " · " },
        { text: "Strikethrough", strikethrough: true },
        { text: " · " },
        { text: "Underline", underline: true },
        { text: " · " },
        { text: "Inline Code", code: true },
        { text: " · " },
        { text: "Link", link: "https://www.fusebase.com" },
        { text: " · " },
        { text: "Bold+Italic", bold: true, italic: true },
      ]
    },

    // ═══════════════════════════════════════════════
    // LISTS
    // ═══════════════════════════════════════════════
    { type: "heading", level: 2, children: [{ text: "Lists" }] },
    { type: "heading", level: 3, children: [{ text: "Bullet List" }] },
    {
      type: "list", style: "bullet", items: [
        { children: [{ text: "First bullet item" }] },
        { children: [{ text: "Second bullet with " }, { text: "bold", bold: true }] },
        { children: [{ text: "Third item" }] },
      ]
    },
    { type: "heading", level: 3, children: [{ text: "Numbered List" }] },
    {
      type: "list", style: "number", items: [
        { children: [{ text: "Step one" }] },
        { children: [{ text: "Step two" }] },
        { children: [{ text: "Step three" }] },
      ]
    },
    { type: "heading", level: 3, children: [{ text: "Checklist" }] },
    {
      type: "checklist", items: [
        { children: [{ text: "Completed task" }], checked: true },
        { children: [{ text: "Pending task" }], checked: false },
        { children: [{ text: "Another done task" }], checked: true },
      ]
    },

    // ═══════════════════════════════════════════════
    // TEXT BLOCKS
    // ═══════════════════════════════════════════════
    { type: "heading", level: 2, children: [{ text: "Text Blocks" }] },
    {
      type: "blockquote", children: [
        { text: "The best way to predict the future is to create it. — Peter Drucker" },
      ]
    },
    {
      type: "code", language: "typescript",
      code: `interface ContentBlock {\n  type: string;\n  children?: InlineSegment[];\n}\n\nconst blocks: ContentBlock[] = [\n  { type: "paragraph", children: [{ text: "Hello, FuseBase!" }] },\n];`,
    },
    { type: "divider" },

    // ═══════════════════════════════════════════════
    // PHASE 3 — INTERACTIVE BLOCKS
    // ═══════════════════════════════════════════════
    { type: "heading", level: 2, children: [{ text: "Interactive Blocks (Phase 3)" }] },

    // Toggle
    {
      type: "toggle",
      summary: [{ text: "Click to expand this toggle" }],
      children: [
        { type: "paragraph", children: [{ text: "This is hidden content inside a toggle block. Toggles support nested content including other blocks." }] },
      ],
    },

    // Hint / Callout
    {
      type: "hint",
      children: [{ text: "This is a hint/callout block — perfect for drawing attention to important information." }],
    },

    // Collapsible Heading
    {
      type: "collapsible-heading",
      level: 2,
      summary: [{ text: "Collapsible Heading (click to expand)" }],
      children: [
        { type: "paragraph", children: [{ text: "Content nested under a collapsible heading. This is great for organizing long documents." }] },
        {
          type: "list", style: "bullet", items: [
            { children: [{ text: "Nested bullet under collapsible" }] },
            { children: [{ text: "Another nested bullet" }] },
          ]
        },
      ],
    },

    // ═══════════════════════════════════════════════
    // PHASE 4 — MEDIA & EMBEDS
    // ═══════════════════════════════════════════════
    { type: "heading", level: 2, children: [{ text: "Media & Embeds (Phase 4)" }] },

    // Image
    {
      type: "image",
      src: "https://via.placeholder.com/600x200/4A90D9/FFFFFF?text=FuseBase+MCP+Showcase",
      width: 600,
    },

    // Bookmark
    { type: "bookmark", url: "https://github.com/ryan-haver/fusebase-mcp" },

    // Outline (TOC)
    { type: "outline", bordered: true, numbered: true, expanded: true },

    // Button
    { type: "button-single", title: "Visit GitHub Repository", url: "https://github.com/ryan-haver/fusebase-mcp" },

    // Steps
    { type: "step-aggregator" },
    { type: "step", children: [{ type: "paragraph", children: [{ text: "Install the MCP server: npm install" }] }] },
    { type: "step", children: [{ type: "paragraph", children: [{ text: "Configure .env with your Fusebase credentials" }] }] },
    { type: "step", children: [{ type: "paragraph", children: [{ text: "Run auth: npx tsx scripts/auth.ts" }] }] },

    { type: "divider" },

    // ═══════════════════════════════════════════════
    // PHASE 6 — LAYOUT
    // ═══════════════════════════════════════════════
    { type: "heading", level: 2, children: [{ text: "Grid Layout (Phase 6)" }] },
    {
      type: "grid",
      columns: [
        {
          type: "gridCol", width: "auto", children: [
            { type: "heading", level: 3, children: [{ text: "Left Column" }] },
            { type: "paragraph", children: [{ text: "This is a 2-column grid layout. Each column can contain any block types." }] },
            {
              type: "list", style: "bullet", items: [
                { children: [{ text: "Nested bullet 1" }] },
                { children: [{ text: "Nested bullet 2" }] },
              ]
            },
          ]
        },
        {
          type: "gridCol", width: "auto", children: [
            { type: "heading", level: 3, children: [{ text: "Right Column" }] },
            { type: "paragraph", children: [{ text: "Columns support independent content. Great for side-by-side comparisons." }] },
            { type: "hint", children: [{ text: "Even hints work inside grid columns!" }] },
          ]
        },
      ],
    },

    // ═══════════════════════════════════════════════
    // TABLE
    // ═══════════════════════════════════════════════
    { type: "heading", level: 2, children: [{ text: "Table" }] },
    {
      type: "table",
      columns: [
        { text: "Feature", type: "text" },
        { text: "Phase", type: "text" },
        { text: "Status", type: "text" },
      ],
      rows: [
        { cells: [{ cellType: "text", children: [{ text: "Headings & Inline Formats" }] }, { cellType: "text", children: [{ text: "Phase 1" }] }, { cellType: "text", children: [{ text: "✅ Complete" }] }] },
        { cells: [{ cellType: "text", children: [{ text: "Y.js HTML Decoder" }] }, { cellType: "text", children: [{ text: "Phase 2" }] }, { cellType: "text", children: [{ text: "✅ Complete" }] }] },
        { cells: [{ cellType: "text", children: [{ text: "Toggle, Hint, Collapsible" }] }, { cellType: "text", children: [{ text: "Phase 3" }] }, { cellType: "text", children: [{ text: "✅ Complete" }] }] },
        { cells: [{ cellType: "text", children: [{ text: "Image, Bookmark, Button" }] }, { cellType: "text", children: [{ text: "Phase 4" }] }, { cellType: "text", children: [{ text: "✅ Complete" }] }] },
        { cells: [{ cellType: "text", children: [{ text: "Tool Schemas & Docs" }] }, { cellType: "text", children: [{ text: "Phase 5" }] }, { cellType: "text", children: [{ text: "✅ Complete" }] }] },
        { cells: [{ cellType: "text", children: [{ text: "Grid Layout & Showcase" }] }, { cellType: "text", children: [{ text: "Phase 6" }] }, { cellType: "text", children: [{ text: "✅ Complete" }] }] },
      ],
    },

    // ═══════════════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════════════
    { type: "divider" },
    {
      type: "paragraph", children: [
        { text: `Generated by FuseBase MCP v1.0 · ${now} · `, italic: true },
        { text: "49 tools", bold: true, italic: true },
        { text: " across content, tasks, members, guides, and more.", italic: true },
      ]
    },
  ];

  // Create the page
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let noteId = "";
  for (let i = 0; i < 16; i++) noteId += chars.charAt(Math.floor(Math.random() * chars.length));

  console.log("Creating showcase page...");
  const createResp = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: WS_ID,
      noteId,
      note: {
        textVersion: 2,
        title: "FuseBase MCP — Content Showcase",
        parentId: "default",
        is_portal_share: false,
      },
    }),
  });

  if (!createResp.ok) {
    console.error(`❌ Failed to create page: ${createResp.status}`);
    process.exit(1);
  }

  console.log(`Writing ${blocks.length} blocks...`);
  const result = await writeContentViaWebSocket(HOST, WS_ID, noteId, COOKIE, blocks, {
    replace: true,
    timeout: 30000,
  });

  if (result.success) {
    console.log(`\n✅ Showcase page created successfully!`);
    console.log(`   ${blocks.length} blocks written`);
    console.log(`   URL: https://${HOST}/space/${WS_ID}/page/${noteId}`);
  } else {
    console.error(`❌ Write failed: ${result.error}`);
    process.exit(1);
  }
}

main().catch(console.error);
