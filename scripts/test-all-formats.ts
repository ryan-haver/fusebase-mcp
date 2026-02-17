/**
 * Test All Formats: Creates a new page and writes every supported content type.
 */
import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import type { ContentBlock } from "../src/content-schema.js";

const host = "inkabeam.nimbusweb.me";
const stored = loadEncryptedCookie();
const cookie = stored?.cookie || "";
const wsId = "45h7lom5ryjak34u";

// Step 1: Create the page via REST API
console.log("📄 Creating page 'Test All Formats'...");
const noteId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
const createResp = await fetch(`https://${host}/v2/api/web-editor/notes/create`, {
  method: "POST",
  headers: { Cookie: cookie, "Content-Type": "application/json", Origin: `https://${host}` },
  body: JSON.stringify({
    workspaceId: wsId,
    noteId,
    note: { textVersion: 2, title: "Test All Formats", parentId: "default", is_portal_share: false },
  }),
});

if (!createResp.ok) {
  console.log(`❌ Create failed: ${createResp.status} ${await createResp.text()}`);
  process.exit(1);
}

const pageData = await createResp.json() as any;
const pageId = pageData.globalId || pageData.id || noteId;
console.log(`✅ Page created: ${pageId}`);
console.log(`   URL: https://${host}/note/${pageId}`);

// Step 2: Build content blocks testing every type
const blocks: ContentBlock[] = [
  // --- Heading H1 ---
  { type: "heading", level: 1, children: [{ text: "Test All Formats" }] },

  // --- Paragraph (plain) ---
  { type: "paragraph", children: [{ text: "This page tests every content block type supported by the Y.js WebSocket writer." }] },

  // --- Divider ---
  { type: "divider" },

  // --- Heading H2 ---
  { type: "heading", level: 2, children: [{ text: "Inline Formatting" }] },

  // --- Paragraph with bold ---
  { type: "paragraph", children: [
    { text: "This paragraph has " },
    { text: "bold text", bold: true },
    { text: " in the middle." },
  ]},

  // --- Paragraph with italic ---
  { type: "paragraph", children: [
    { text: "This paragraph has " },
    { text: "italic text", italic: true },
    { text: " in the middle." },
  ]},

  // --- Paragraph with both bold and italic ---
  { type: "paragraph", children: [
    { text: "This has " },
    { text: "bold and italic", bold: true, italic: true },
    { text: " combined." },
  ]},

  // --- Divider ---
  { type: "divider" },

  // --- Heading H2 ---
  { type: "heading", level: 2, children: [{ text: "Bullet List" }] },

  // --- Bullet list ---
  { type: "list", style: "bullet", items: [
    { children: [{ text: "First bullet item" }] },
    { children: [{ text: "Second bullet with " }, { text: "bold", bold: true }] },
    { children: [{ text: "Third bullet item" }] },
    { children: [{ text: "Indented bullet" }], indent: 1 },
    { children: [{ text: "Double indented bullet" }], indent: 2 },
  ]},

  // --- Divider ---
  { type: "divider" },

  // --- Heading H2 ---
  { type: "heading", level: 2, children: [{ text: "Numbered List" }] },

  // --- Numbered list ---
  { type: "list", style: "number", items: [
    { children: [{ text: "First numbered item" }] },
    { children: [{ text: "Second numbered item" }] },
    { children: [{ text: "Third numbered item" }] },
  ]},

  // --- Divider ---
  { type: "divider" },

  // --- Heading H2 ---
  { type: "heading", level: 2, children: [{ text: "Checklist" }] },

  // --- Checklist ---
  { type: "checklist", items: [
    { children: [{ text: "Unchecked item" }], checked: false },
    { children: [{ text: "Checked item" }], checked: true },
    { children: [{ text: "Another unchecked item" }] },
  ]},

  // --- Divider ---
  { type: "divider" },

  // --- Heading H2 ---
  { type: "heading", level: 2, children: [{ text: "Blockquote" }] },

  // --- Blockquote ---
  { type: "blockquote", children: [
    { text: "This is a blockquote. It should appear with a left border indicator." },
  ]},

  // --- Divider ---
  { type: "divider" },

  // --- Heading H2 ---
  { type: "heading", level: 2, children: [{ text: "Code Block" }] },

  // --- Code block ---
  { type: "code", language: "javascript", code: "function hello() {\n  console.log('Hello from Y.js!');\n  return true;\n}" },

  // --- Divider ---
  { type: "divider" },

  // --- Heading H2 ---
  { type: "heading", level: 2, children: [{ text: "Paragraph Alignment & Color" }] },

  // --- Centered paragraph ---
  { type: "paragraph", align: "center", children: [{ text: "This paragraph is center-aligned." }] },

  // --- Right-aligned paragraph ---
  { type: "paragraph", align: "right", children: [{ text: "This paragraph is right-aligned." }] },

  // --- Divider ---
  { type: "divider" },

  // --- Final paragraph ---
  { type: "paragraph", children: [
    { text: "✅ All format types tested successfully!" },
  ]},
];

// Step 3: Write content via Y.js WebSocket
console.log(`\n🚀 Writing ${blocks.length} blocks via Y.js WebSocket...`);
const t0 = Date.now();
const result = await writeContentViaWebSocket(host, wsId, pageId, cookie, blocks, {
  replace: true,
  timeout: 20000,
});

console.log(`   Completed in ${Date.now() - t0}ms`);
console.log(`   Result: ${JSON.stringify(result)}`);

if (result.success) {
  console.log(`\n✅ SUCCESS! All formats written.`);
  console.log(`   Open: https://${host}/note/${pageId}`);
} else {
  console.log(`\n❌ FAILED: ${result.error}`);
}
