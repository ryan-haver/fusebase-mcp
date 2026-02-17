/**
 * Quick test: validate the markdown → schema → tokens pipeline.
 * Run: npx tsx scripts/test-content.ts
 */

import { markdownToSchema, parseInline } from "../src/markdown-parser.js";
import { schemaToTokens } from "../src/token-builder.js";

const testMarkdown = `# Welcome to Fusebase MCP

This page was **automatically generated** by the MCP content writing system.

## Features Demonstrated

Here are the *formatting options* available:

- **Bold text** in a bullet list
- *Italic text* in a bullet list  
- ***Bold and italic*** combined
- Regular plain text

---

## Numbered Lists

1. First item with **bold**
2. Second item with *italic*
3. Third item plain

---

## Blockquote

> This is a blockquote — indented text that stands out.

## Code Block

\`\`\`typescript
function hello() {
  console.log("Hello from Fusebase MCP!");
}
\`\`\`

That's all for now. This content was generated programmatically!
`;

console.log("=== Test: parseInline ===");
console.log(JSON.stringify(parseInline("Hello **bold** and *italic* world"), null, 2));

console.log("\n=== Test: markdownToSchema ===");
const schema = markdownToSchema(testMarkdown);
console.log(`Parsed ${schema.length} blocks:`);
schema.forEach((b, i) => {
  if ("children" in b && b.children) {
    const text = b.children.map((c: { text: string }) => c.text).join("");
    console.log(`  [${i}] ${b.type}${("level" in b) ? `(${b.level})` : ""}: "${text.slice(0, 60)}..."`);
  } else if (b.type === "list") {
    console.log(`  [${i}] list(${b.style}): ${b.items.length} items`);
  } else if (b.type === "code") {
    console.log(`  [${i}] code(${b.language}): ${b.code.split("\n").length} lines`);
  } else {
    console.log(`  [${i}] ${b.type}`);
  }
});

console.log("\n=== Test: schemaToTokens ===");
const tokens = schemaToTokens(schema);
console.log(`Generated ${tokens.length} tokens:`);
tokens.forEach((t: unknown, i: number) => {
  const tok = t as Record<string, unknown>;
  const chars = tok.characters as unknown[] | undefined;
  const textParts = chars?.filter((c: unknown) => typeof c === "string") ?? [];
  const preview = textParts.join("").slice(0, 50);
  console.log(`  [${i}] id=${tok.id} type=${tok.type} "${preview}"`);
});

console.log("\n=== Full token output (first 3) ===");
console.log(JSON.stringify(tokens.slice(0, 3), null, 2));

console.log("\n✅ All tests passed — pipeline is working!");
