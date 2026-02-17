/**
 * Progressive token format test: start simple, add complexity.
 * Each test overwrites the page, then checks if the dump grew.
 */

import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";

const WS = "45h7lom5ryjak34u";
const PAGE = "0ylYPzWyJEE9GHQN";

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored?.cookie) { console.error("No cookie"); process.exit(1); }

  const client = new FusebaseClient({
    host: "inkabeam.nimbusweb.me",
    orgId: "u268r1",
    cookie: stored.cookie,
    autoRefresh: false,
  });

  async function checkDump(): Promise<number> {
    const res = await fetch(`https://inkabeam.nimbusweb.me/dump/${WS}/${PAGE}`, {
      headers: { cookie: stored!.cookie },
    });
    const buf = await res.arrayBuffer();
    return buf.byteLength;
  }

  const tests = [
    {
      name: "1. Simple text, no formatting",
      tokens: [{ insert: "Hello World\n" }],
    },
    {
      name: "2. Two lines",
      tokens: [
        { insert: "Line one\n" },
        { insert: "Line two\n" },
      ],
    },
    {
      name: "3. Bold text",
      tokens: [
        { insert: "Normal " },
        { insert: "BOLD", attributes: { bold: true } },
        { insert: " normal\n" },
      ],
    },
    {
      name: "4. Heading (header attribute on newline)",
      tokens: [
        { insert: "My Heading" },
        { insert: "\n", attributes: { header: 1 } },
      ],
    },
    {
      name: "5. Bullet list",
      tokens: [
        { insert: "Item A" },
        { insert: "\n", attributes: { list: "bullet" } },
        { insert: "Item B" },
        { insert: "\n", attributes: { list: "bullet" } },
      ],
    },
    {
      name: "6. Heading + paragraph + bold",
      tokens: [
        { insert: "Title" },
        { insert: "\n", attributes: { header: 1 } },
        { insert: "Hello " },
        { insert: "world", attributes: { bold: true } },
        { insert: "!\n" },
      ],
    },
    {
      name: "7. Blockquote",
      tokens: [
        { insert: "Quoted text" },
        { insert: "\n", attributes: { blockquote: true } },
      ],
    },
  ];

  for (const test of tests) {
    console.log(`\n━━━ ${test.name} ━━━`);
    try {
      await client.updatePageContent(WS, PAGE, test.tokens);
      await new Promise((r) => setTimeout(r, 1500));
      const size = await checkDump();
      const hasContent = size > 200;
      console.log(`   Dump: ${size} bytes → ${hasContent ? "✅ HAS CONTENT" : "❌ EMPTY/MINIMAL"}`);
      
      if (size > 100) {
        // Fetch and show the content structure
        const res = await fetch(`https://inkabeam.nimbusweb.me/dump/${WS}/${PAGE}`, {
          headers: { cookie: stored!.cookie },
        });
        const buf = await res.arrayBuffer();
        const text = Buffer.from(buf).toString("utf-8").replace(/[^\x20-\x7E\n]/g, "·");
        // Find readable text
        const matches = text.match(/[A-Za-z ]{3,}/g);
        console.log(`   Text found: ${matches?.join(", ") || "none"}`);
      }
    } catch (err: unknown) {
      console.log(`   ❌ Error: ${(err as Error).message.slice(0, 150)}`);
    }
  }
}

main().catch(console.error);
