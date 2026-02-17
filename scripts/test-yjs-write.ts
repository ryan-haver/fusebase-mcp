/**
 * Test Y.js binary update directly to the /tokens endpoint.
 * Run: npx tsx scripts/test-yjs-write.ts
 */

import * as Y from "yjs";
import { buildYDoc } from "../src/yjs-writer.js";
import { markdownToSchema } from "../src/markdown-parser.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import type { ContentBlock } from "../src/content-schema.js";

const HOST = "inkabeam.nimbusweb.me";
const WS = "45h7lom5ryjak34u";
const PAGE = "0ylYPzWyJEE9GHQN";

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored?.cookie) { console.error("No cookie"); process.exit(1); }

  // Test 1: Simple paragraph
  const simpleBlocks: ContentBlock[] = [
    {
      type: "paragraph",
      children: [{ text: "Hello from Y.js binary update!" }],
    },
  ];

  const { update: simpleUpdate } = buildYDoc(simpleBlocks);
  console.log(`📝 Y.js update size: ${simpleUpdate.byteLength} bytes`);
  console.log(`   Base64: ${Buffer.from(simpleUpdate).toString("base64").slice(0, 100)}...`);

  // Try different POST strategies

  // Strategy 1: POST the Y.js binary directly as application/octet-stream
  console.log("\n━━━ Strategy 1: Binary POST to /tokens ━━━");
  try {
    const res1 = await fetch(
      `https://${HOST}/v4/api/workspaces/${WS}/texts/${PAGE}/tokens`,
      {
        method: "POST",
        headers: {
          cookie: stored.cookie,
          "content-type": "application/octet-stream",
        },
        body: simpleUpdate,
      }
    );
    console.log(`   Status: ${res1.status}`);
    const text1 = await res1.text();
    console.log(`   Response: ${text1.slice(0, 500)}`);
  } catch (e: unknown) {
    console.log(`   Error: ${(e as Error).message}`);
  }

  await new Promise(r => setTimeout(r, 1000));

  // Strategy 2: POST as base64 in JSON
  console.log("\n━━━ Strategy 2: Base64 in JSON to /tokens ━━━");
  try {
    const res2 = await fetch(
      `https://${HOST}/v4/api/workspaces/${WS}/texts/${PAGE}/tokens`,
      {
        method: "POST",
        headers: {
          cookie: stored.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          update: Buffer.from(simpleUpdate).toString("base64"),
        }),
      }
    );
    console.log(`   Status: ${res2.status}`);
    const text2 = await res2.text();
    console.log(`   Response: ${text2.slice(0, 500)}`);
  } catch (e: unknown) {
    console.log(`   Error: ${(e as Error).message}`);
  }

  await new Promise(r => setTimeout(r, 1000));

  // Strategy 3: POST as "update" field with Y.js state vector
  console.log("\n━━━ Strategy 3: Y.js update + state vector in JSON ━━━");
  try {
    const doc = new Y.Doc();
    const stateVector = Y.encodeStateVector(doc);
    const res3 = await fetch(
      `https://${HOST}/v4/api/workspaces/${WS}/texts/${PAGE}/tokens`,
      {
        method: "POST",
        headers: {
          cookie: stored.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          stateVector: Buffer.from(stateVector).toString("base64"),
          update: Buffer.from(simpleUpdate).toString("base64"),
        }),
      }
    );
    console.log(`   Status: ${res3.status}`);
    const text3 = await res3.text();
    console.log(`   Response: ${text3.slice(0, 500)}`);
  } catch (e: unknown) {
    console.log(`   Error: ${(e as Error).message}`);
  }

  await new Promise(r => setTimeout(r, 1000));

  // Strategy 4: PUT instead of POST
  console.log("\n━━━ Strategy 4: PUT binary to /tokens ━━━");
  try {
    const res4 = await fetch(
      `https://${HOST}/v4/api/workspaces/${WS}/texts/${PAGE}/tokens`,
      {
        method: "PUT",
        headers: {
          cookie: stored.cookie,
          "content-type": "application/octet-stream",
        },
        body: simpleUpdate,
      }
    );
    console.log(`   Status: ${res4.status}`);
    const text4 = await res4.text();
    console.log(`   Response: ${text4.slice(0, 500)}`);
  } catch (e: unknown) {
    console.log(`   Error: ${(e as Error).message}`);
  }

  await new Promise(r => setTimeout(r, 1000));

  // Strategy 5: POST the full state Y-Doc update to /dump endpoint (overwrite)
  console.log("\n━━━ Strategy 5: POST/PUT binary to /dump ━━━");
  try {
    const res5 = await fetch(
      `https://${HOST}/dump/${WS}/${PAGE}`,
      {
        method: "POST",
        headers: {
          cookie: stored.cookie,
          "content-type": "application/octet-stream",
        },
        body: simpleUpdate,
      }
    );
    console.log(`   Status: ${res5.status}`);
    const text5 = await res5.text();
    console.log(`   Response: ${text5.slice(0, 500)}`);
  } catch (e: unknown) {
    console.log(`   Error: ${(e as Error).message}`);
  }

  await new Promise(r => setTimeout(r, 1000));

  // Strategy 6: PUT to /dump
  console.log("\n━━━ Strategy 6: PUT to /dump ━━━");
  try {
    const res6 = await fetch(
      `https://${HOST}/dump/${WS}/${PAGE}`,
      {
        method: "PUT",
        headers: {
          cookie: stored.cookie,
          "content-type": "application/octet-stream",
        },
        body: simpleUpdate,
      }
    );
    console.log(`   Status: ${res6.status}`);
    const text6 = await res6.text();
    console.log(`   Response: ${text6.slice(0, 500)}`);
  } catch (e: unknown) {
    console.log(`   Error: ${(e as Error).message}`);
  }

  await new Promise(r => setTimeout(r, 1000));

  // Check dump after all attempts
  console.log("\n━━━ Final dump check ━━━");
  const dumpRes = await fetch(`https://${HOST}/dump/${WS}/${PAGE}`, {
    headers: { cookie: stored.cookie },
  });
  const dumpBuf = await dumpRes.arrayBuffer();
  console.log(`   Dump size: ${dumpBuf.byteLength} bytes`);
  const readable = Buffer.from(dumpBuf).toString("utf-8").replace(/[^\x20-\x7E\n]/g, "·");
  console.log(`   Content: ${readable.slice(0, 500)}`);
}

main().catch(console.error);
