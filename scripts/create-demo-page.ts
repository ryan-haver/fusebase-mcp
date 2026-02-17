/**
 * Create a new page in Ryan's workspace and write rich content to it.
 */
import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
import { loadEncryptedCookie } from "../src/crypto.js";

const WS_ID = "45h7lom5ryjak34u";  // Ryan workspace
const HOST = "inkabeam.nimbusweb.me";

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored) throw new Error("No cookie found");
  const cookie = stored.cookie;

  // Generate page ID
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let noteId = "";
  for (let i = 0; i < 16; i++) noteId += chars.charAt(Math.floor(Math.random() * chars.length));

  const title = "MCP Demo Page";

  // 1. Create the page
  console.log(`Creating page "${title}" (id: ${noteId})...`);
  const createResp = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: WS_ID,
      noteId,
      note: {
        textVersion: 2,
        title,
        parentId: "default",
        is_portal_share: false,
      },
    }),
  });

  if (!createResp.ok) {
    console.error(`Create failed: ${createResp.status} ${await createResp.text()}`);
    return;
  }
  const createData = await createResp.json() as any;
  const pageId = createData.globalId || noteId;
  console.log(`✓ Created page: ${pageId}`);

  // 2. Write rich content via WebSocket
  const blocks: any[] = [
    {
      type: "heading", level: 1,
      children: [{ text: "Welcome to the MCP Demo Page 🚀" }],
    },
    {
      type: "paragraph",
      children: [
        { text: "This page was created and populated entirely via the " },
        { text: "Fusebase MCP server", bold: true },
        { text: " — no browser interaction needed!" },
      ],
    },
    { type: "divider" },
    {
      type: "heading", level: 2,
      children: [{ text: "What Can the MCP Server Do?" }],
    },
    {
      type: "list", style: "bullet",
      items: [
        { children: [{ text: "Create, list, and manage pages" }] },
        { children: [{ text: "Read page content as clean HTML" }] },
        { children: [{ text: "Write rich text with formatting" }] },
        { children: [{ text: "Manage folders, tags, and tasks" }] },
        { children: [{ text: "Search across your workspace" }] },
      ],
    },
    {
      type: "heading", level: 2,
      children: [{ text: "Status Checklist" }],
    },
    {
      type: "checklist",
      items: [
        { checked: true, children: [{ text: "Page creation via API" }] },
        { checked: true, children: [{ text: "Content writing via WebSocket" }] },
        { checked: true, children: [{ text: "Y.js binary decoding to HTML" }] },
        { checked: false, children: [{ text: "Full WYSIWYG editing support" }] },
      ],
    },
    { type: "divider" },
    {
      type: "blockquote",
      children: [{ text: "The best tool is the one that gets out of your way." }],
    },
    {
      type: "heading", level: 3,
      children: [{ text: "Example Code" }],
    },
    {
      type: "code", language: "typescript",
      code: `// Create a page via MCP\nconst page = await client.createPage(workspaceId, "My Page");\nconsole.log("Created:", page.globalId);`,
    },
    {
      type: "paragraph",
      children: [
        { text: "Created on: " },
        { text: new Date().toLocaleString(), italic: true },
      ],
    },
  ];

  console.log("Writing content via WebSocket...");
  const writeResult = await writeContentViaWebSocket(HOST, WS_ID, pageId, cookie, blocks);
  console.log(`Write result: ${JSON.stringify(writeResult)}`);

  if (writeResult.success) {
    console.log(`\n✓ Page ready! Open in Fusebase to see it.`);
    console.log(`  Page ID: ${pageId}`);
  } else {
    console.error(`✗ Write failed: ${writeResult.error}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
