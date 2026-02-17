/**
 * Test different token formats to find what the /tokens API actually accepts.
 * Tests Quill Delta, individual chars, and other potential formats.
 * Run: npx tsx scripts/test-token-formats.ts
 */

import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";

const WORKSPACE_ID = "45h7lom5ryjak34u";
const TEST_PAGE_ID = "0ylYPzWyJEE9GHQN";

async function main() {
  const host = "inkabeam.nimbusweb.me";
  const orgId = "u268r1";

  const stored = loadEncryptedCookie();
  if (!stored?.cookie) {
    console.error("No cookie — run auth first");
    process.exit(1);
  }

  const client = new FusebaseClient({ host, orgId, cookie: stored.cookie, autoRefresh: false });

  // === FORMAT TESTS ===
  // Each test sends a different token format structure to see which one actually produces content

  const formats: { name: string; tokens: unknown[] }[] = [
    // Test 1: Quill Delta format (insert operations)
    {
      name: "Quill Delta (insert ops)",
      tokens: [
        { insert: "Hello World\n" },
      ],
    },
    // Test 2: Quill Delta with attributes
    {
      name: "Quill Delta with bold",
      tokens: [
        { insert: "Bold Text", attributes: { bold: true } },
        { insert: "\n" },
      ],
    },
    // Test 3: Quill Delta with heading
    {
      name: "Quill Delta with heading",
      tokens: [
        { insert: "My Heading" },
        { insert: "\n", attributes: { header: 1 } },
        { insert: "Normal paragraph text\n" },
      ],
    },
    // Test 4: Array of strings (simplest possible)
    {
      name: "Array of strings",
      tokens: ["Hello", " ", "World", "\n"],
    },
    // Test 5: Single characters (like "tokens" = characters)  
    {
      name: "Characters with formatting toggles (Y-Doc style)",
      tokens: [
        "H", "e", "l", "l", "o", " ", "W", "o", "r", "l", "d"
      ],
    },
    // Test 6: Nested block structure from Y-Doc
    {
      name: "Y-Doc block structure",
      tokens: [
        {
          id: "test_block_1",
          type: "paragraph",
          indent: 0,
          color: "transparent",
          align: "left",
          characters: ["Hello from Y-Doc format"],
        },
      ],
    },
    // Test 7: Quill Delta with list
    {
      name: "Full Quill Delta document",
      tokens: [
        { insert: "Test Heading" },
        { insert: "\n", attributes: { header: 1 } },
        { insert: "This is a paragraph with " },
        { insert: "bold text", attributes: { bold: true } },
        { insert: " and " },
        { insert: "italic text", attributes: { italic: true } },
        { insert: ".\n" },
        { insert: "Bullet item 1" },
        { insert: "\n", attributes: { list: "bullet" } },
        { insert: "Bullet item 2" },
        { insert: "\n", attributes: { list: "bullet" } },
      ],
    },
  ];

  for (const fmt of formats) {
    console.log(`\n━━━ Testing: ${fmt.name} ━━━`);
    console.log(`Payload: ${JSON.stringify(fmt.tokens).slice(0, 200)}`);
    try {
      const result = await client.updatePageContent(WORKSPACE_ID, TEST_PAGE_ID, fmt.tokens);
      console.log(`✅ Accepted (200)`);
      
      // Wait a moment, then check if content appeared
      await new Promise((r) => setTimeout(r, 1000));
      
      // Fetch page dump to see if content was actually written
      const dumpUrl = `https://${host}/dump/${WORKSPACE_ID}/${TEST_PAGE_ID}`;
      const dumpRes = await fetch(dumpUrl, {
        headers: { cookie: stored.cookie },
      });
      const dumpBytes = await dumpRes.arrayBuffer();
      console.log(`   Dump size: ${dumpBytes.byteLength} bytes (>4 = has content)`);
      
      if (dumpBytes.byteLength > 100) {
        console.log(`\n🎉 FORMAT "${fmt.name}" PRODUCED CONTENT!`);
        console.log(`   Dump preview (hex): ${Buffer.from(dumpBytes.slice(0, 100)).toString("hex")}`);
        
        // Try to decode as UTF-8 for readable parts
        const text = Buffer.from(dumpBytes).toString("utf-8");
        // Extract readable strings
        const readable = text.replace(/[^\x20-\x7E\n]/g, "·");
        console.log(`   Readable: ${readable.slice(0, 500)}`);
        
        // Found the format! No need to test further
        break;
      }
    } catch (err: unknown) {
      const e = err as Error;
      console.log(`❌ Error: ${e.message.slice(0, 200)}`);
    }
  }

  console.log("\n✅ Token format discovery complete.");
}

main().catch(console.error);
