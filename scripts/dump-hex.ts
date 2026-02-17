/**
 * Quick dump check for the verbose test page
 */
import { loadEncryptedCookie } from "../src/crypto.js";

const WS_ID = "45h7lom5ryjak34u";
const HOST = "inkabeam.nimbusweb.me";
const PAGE_ID = "dZs9ktlHlQrGQ6Tu";

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored) throw new Error("No cookie");

  const resp = await fetch(`https://${HOST}/dump/${WS_ID}/${PAGE_ID}`, {
    headers: { cookie: stored.cookie },
  });
  const binary = new Uint8Array(await resp.arrayBuffer());
  console.log(`Size: ${binary.length} bytes`);
  console.log(`Hex: ${Array.from(binary).map(b => b.toString(16).padStart(2, "0")).join(" ")}`);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(binary);
  const readable = text.replace(/[^\x20-\x7E]/g, "·");
  console.log(`\nReadable:\n${readable}`);
}

main().catch(e => { console.error(e); process.exit(1); });
