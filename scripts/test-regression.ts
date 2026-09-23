/**
 * Live regression test: writes every block type and inline format to a new page in the
 * sandbox workspace over the Y.js WebSocket, reads it back through the decoder, and checks
 * the content survived. The page is deleted afterwards.
 *
 * Offline markdown-parser checks live in tests/unit/markdown-parser.test.ts.
 * Requires a valid session cookie and FUSEBASE_WORKSPACE_ID.
 */
import { writeContentViaWebSocket, readContentViaWebSocket } from "../src/yjs-ws-writer.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import { FusebaseClient } from "../src/client.js";
import type { ContentBlock } from "../src/content-schema.js";
import { assert, assertIncludes, knownGap, requireSandboxWorkspace, runSuite } from "./lib/live-harness.js";

const BLOCKS: ContentBlock[] = [
  { type: "heading", level: 1, children: [{ text: "Full Regression Test" }] },
  { type: "heading", level: 2, children: [{ text: "Heading H2" }] },
  { type: "heading", level: 3, children: [{ text: "Heading H3" }] },
  {
    type: "paragraph", children: [
      { text: "Normal " },
      { text: "bold", bold: true },
      { text: " " },
      { text: "italic", italic: true },
      { text: " " },
      { text: "struck", strikethrough: true },
      { text: " " },
      { text: "underlined", underline: true },
      { text: " " },
      { text: "code", code: true },
      { text: " " },
      { text: "link", link: "https://example.com" },
      { text: " trailing plain text" },
    ],
  },
  { type: "divider" },
  { type: "list", style: "bullet", items: [{ children: [{ text: "Bullet 1" }] }, { children: [{ text: "Bullet 2" }] }] },
  { type: "list", style: "number", items: [{ children: [{ text: "Number 1" }] }, { children: [{ text: "Number 2" }] }] },
  { type: "checklist", items: [{ children: [{ text: "Unchecked item" }], checked: false }, { children: [{ text: "Checked item" }], checked: true }] },
  { type: "blockquote", children: [{ text: "A wise quote" }] },
  { type: "code", language: "typescript", code: "const answer: number = 4242;" },
  { type: "toggle", summary: [{ text: "Toggle Summary" }], children: [{ type: "paragraph", children: [{ text: "Hidden toggle content" }] }] },
  { type: "hint", children: [{ text: "Important callout" }] },
  { type: "collapsible-heading", level: 2, summary: [{ text: "Collapsible Section" }], children: [{ type: "paragraph", children: [{ text: "Collapsible body" }] }] },
  { type: "image", src: "https://via.placeholder.com/400x200.png?text=Regression+Test", width: 400 },
  { type: "bookmark", url: "https://github.com" },
  { type: "outline", bordered: true, numbered: true, expanded: true },
  { type: "button-single", title: "Test Button", url: "https://example.com/button" },
  { type: "step-aggregator" },
  { type: "step", children: [{ type: "paragraph", children: [{ text: "Step one body" }] }] },
  { type: "step", children: [{ type: "paragraph", children: [{ text: "Step two body" }] }] },
  {
    type: "table",
    columns: [{ text: "Name", type: "text" }, { text: "Value", type: "number" }],
    rows: [
      { cells: [{ cellType: "text", children: [{ text: "Alpha" }] }, { cellType: "number", value: 42 }] },
      { cells: [{ cellType: "text", children: [{ text: "Beta" }] }, { cellType: "number", value: 99 }] },
    ],
  },
  {
    type: "grid",
    columns: [
      { type: "gridCol", width: "auto", children: [{ type: "paragraph", children: [{ text: "Left column" }] }] },
      { type: "gridCol", width: "auto", children: [{ type: "paragraph", children: [{ text: "Right column" }] }] },
    ],
  },
  { type: "paragraph", children: [{ text: "End of regression test" }] },
];

async function main() {
  const workspaceId = requireSandboxWorkspace();
  const host = process.env.FUSEBASE_HOST;
  const orgId = process.env.FUSEBASE_ORG_ID;
  const cookie = process.env.FUSEBASE_COOKIE || loadEncryptedCookie()?.cookie;
  if (!host || !orgId) throw new Error("FUSEBASE_HOST and FUSEBASE_ORG_ID must be set.");
  if (!cookie) throw new Error("A session cookie is required (run: npx tsx scripts/auth.ts).");

  const client = new FusebaseClient({ host, orgId, cookie, autoRefresh: false });
  const page = await client.createPage(workspaceId, `[regression-test] ${new Date().toISOString()}`);
  assert(Boolean(page?.globalId), "createPage should return a globalId");
  const noteId = page.globalId;

  try {
    const write = await writeContentViaWebSocket(host, workspaceId, noteId, cookie, BLOCKS, { replace: true, timeout: 20000 });
    assert(write.success, `WebSocket write failed: ${write.error}`);

    await new Promise((r) => setTimeout(r, 2000));
    const read = await readContentViaWebSocket(host, workspaceId, noteId, cookie);
    assert(read.success, `WebSocket read failed: ${read.error}`);
    const html = read.html || "";
    console.log(`Read back ${html.length} chars of HTML`);

    // Headings & inline formats
    assertIncludes(html, "Full Regression Test", "H1");
    assertIncludes(html, "Heading H2", "H2");
    assertIncludes(html, "Heading H3", "H3");
    assertIncludes(html, "<strong>bold</strong> ", "bold");
    assertIncludes(html, "<em>italic</em> ", "italic");
    assertIncludes(html, "<del>struck</del> ", "strikethrough");
    assertIncludes(html, "<u>underlined</u> ", "underline");
    assertIncludes(html, "<code>code</code> ", "inline code");
    // CON-1: formatting must not bleed into the following plain text
    assertIncludes(html, '<a href="https://example.com">link</a> trailing plain text', "link without bleed");

    // Simple blocks
    assertIncludes(html, "<hr>", "divider");
    assertIncludes(html, "Bullet 2", "bullet list");
    assertIncludes(html, "Number 2", "numbered list");
    assertIncludes(html, "Checked item", "checklist");
    assertIncludes(html, "A wise quote", "blockquote");
    assertIncludes(html, "4242", "code block");
    assertIncludes(html, "Toggle Summary", "toggle summary");
    assertIncludes(html, "Important callout", "hint");
    assertIncludes(html, "Collapsible Section", "collapsible heading");
    assertIncludes(html, "<img", "image");
    assertIncludes(html, "github.com", "bookmark");
    assertIncludes(html, 'class="outline"', "outline");
    assertIncludes(html, "https://example.com/button", "button");
    assertIncludes(html, "Left column", "grid left");
    assertIncludes(html, "Right column", "grid right");
    assertIncludes(html, "End of regression test", "final paragraph");

    // Nested content & tables (tracked remediation findings)
    // Paragraph children survive; CON-3 is about non-paragraph children and heading bodies.
    assertIncludes(html, "Hidden toggle content", "toggle body");
    assertIncludes(html, "Step one body", "step 1 body");
    assertIncludes(html, "Step two body", "step 2 body");
    knownGap("CON-3", "collapsible heading body survives round-trip", html.includes("Collapsible body"));
    knownGap("CON-2", "table cells survive round-trip", html.includes("Alpha") && html.includes("99"));
  } finally {
    try {
      await client.deletePage(workspaceId, noteId);
    } catch (err) {
      console.error(`⚠️ failed to delete regression page ${noteId}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

runSuite("Block model regression", main);
