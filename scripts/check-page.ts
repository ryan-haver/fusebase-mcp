/**
 * Check what was persisted for the demo page
 */
import { decodeYjsToHtml } from "../src/yjs-html-decoder.js";
import { loadEncryptedCookie } from "../src/crypto.js";

const WS_ID = "45h7lom5ryjak34u";
const HOST = "inkabeam.nimbusweb.me";
const PAGE_ID = "BDXl3LBHNDS5QhtL";

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored) throw new Error("No cookie");
  const cookie = stored.cookie;

  console.log(`Fetching dump for page ${PAGE_ID}...`);
  const resp = await fetch(`https://${HOST}/dump/${WS_ID}/${PAGE_ID}`, {
    headers: { cookie },
  });
  console.log(`Status: ${resp.status}`);
  console.log(`Content-Type: ${resp.headers.get("content-type")}`);

  if (!resp.ok) {
    console.log(`Body: ${await resp.text()}`);
    return;
  }

  const binary = new Uint8Array(await resp.arrayBuffer());
  console.log(`Binary size: ${binary.length} bytes`);

  if (binary.length === 0) {
    console.log("EMPTY — no content was persisted!");
    return;
  }

  console.log(`First 100 bytes hex: ${Array.from(binary.slice(0, 100)).map(b => b.toString(16).padStart(2, "0")).join(" ")}`);

  // Show readable text
  const text = new TextDecoder("utf-8", { fatal: false }).decode(binary);
  const readable = text.replace(/[^\x20-\x7E\n]/g, "·");
  console.log(`\nReadable text (first 1000 chars):`);
  console.log(readable.substring(0, 1000));

  // Decode to HTML
  const html = decodeYjsToHtml(binary);
  console.log(`\nDecoded HTML (${html.length} chars):`);
  console.log(html);
}

main().catch(e => { console.error(e); process.exit(1); });
