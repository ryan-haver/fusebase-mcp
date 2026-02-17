/**
 * Live write test: push markdown content to a real Fusebase page.
 * Loads fresh cookies from data/cookie.enc (encrypted store).
 * Run: npx tsx scripts/test-live-write.ts
 */

import { markdownToSchema } from "../src/markdown-parser.js";
import { schemaToTokens } from "../src/token-builder.js";
import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";

const WORKSPACE_ID = "45h7lom5ryjak34u";
const TEST_PAGE_ID = "0ylYPzWyJEE9GHQN";

const testMarkdown = `# MCP Content System Test

This page was **automatically generated** by the Fusebase MCP content writing system.

## Formatting Demo

- **Bold text** in a bullet point
- *Italic text* for emphasis
- Plain text without formatting

---

## Numbered List

1. First ordered item
2. Second with **bold emphasis**
3. Third with *italic emphasis*

## Blockquote

> This is a blockquote demonstrating indented text.

## Closing

Content converted from **markdown** to Fusebase tokens automatically.
`;

async function main() {
  const host = "inkabeam.nimbusweb.me";
  const orgId = "u268r1";

  // Load from encrypted store (populated by auth.ts)
  const stored = loadEncryptedCookie();
  if (!stored?.cookie) {
    console.error("❌ No encrypted cookie — run: npx tsx scripts/auth.ts --host inkabeam.nimbusweb.me");
    process.exit(1);
  }

  console.log(`🔐 Loaded encrypted cookie (saved ${stored.savedAt})`);

  const client = new FusebaseClient({ host, orgId, cookie: stored.cookie, autoRefresh: false });

  console.log("📝 Parsing markdown...");
  const schema = markdownToSchema(testMarkdown);
  console.log(`   → ${schema.length} content blocks`);

  console.log("🔧 Converting to tokens...");
  const tokens = schemaToTokens(schema);
  console.log(`   → ${tokens.length} Fusebase tokens`);

  console.log(`\n📤 Writing to page ${TEST_PAGE_ID}...`);
  try {
    const result = await client.updatePageContent(WORKSPACE_ID, TEST_PAGE_ID, tokens);
    console.log("✅ Write successful!");
    console.log("   Response:", JSON.stringify(result, null, 2));
  } catch (err: unknown) {
    const e = err as Error;
    console.error("❌ Write failed:", e.message);
    process.exit(1);
  }
}

main();
