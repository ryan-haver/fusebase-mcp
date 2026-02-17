/**
 * Fusebase Y.js WebSocket Content Writer
 *
 * Writes rich content to Fusebase pages using the native Y.js WebSocket connection.
 *
 * Protocol (reverse-engineered from browser CDP capture + Fusebase client):
 *
 *   1. Get JWT via POST /v4/api/workspaces/{wsId}/texts/{pageId}/tokens
 *   2. Build initial Y.Doc with empty paragraph (this is what the browser does)
 *   3. Encode SyncStep1 from initial doc state, embed in URL as base64
 *   4. Open WebSocket to wss://text.nimbusweb.me/socket.io.editor/{ws}/{page}
 *      with ?token=JWT&cid=...&encv2=true&syncStep1=...
 *   5. IMMEDIATELY send AWARENESS message (before any sync)
 *   6. Server sends SyncStep1 → respond with SyncStep2 (our state)
 *   7. Server sends SyncStep2 → apply update to our doc (try V2 then V1)
 *   8. Write content blocks → send incremental V1 updates
 *   9. Wait for processing, then close
 *
 * Message types (raw binary ArrayBuffer):
 *   0x00 = sync: sub 0x00=step1, 0x01=step2, 0x02=update
 *   0x01 = awareness
 *   0x11 = ping → respond with 0x12 (pong)
 *
 * Critical: Despite encv2=true in URL, the server expects V1-encoded
 * outbound updates (encodeStateAsUpdate). The server may send V2 inbound.
 *
 * @module yjs-ws-writer
 */

import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { WebSocket } from "ws";
import type { ContentBlock } from "./content-schema.js";

// ─── Encoding helpers ───

function writeVarUint(buf: number[], num: number): void {
  while (num > 0x7f) {
    buf.push(0x80 | (num & 0x7f));
    num >>>= 7;
  }
  buf.push(num & 0x7f);
}

function readVarUint(data: Uint8Array, offset: number): [number, number] {
  let result = 0, shift = 0, byte: number;
  do {
    byte = data[offset++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  return [result, offset];
}

function randomAlphaNum(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ─── Y.js message builders ───

/**
 * Encode a sync protocol message in the exact format Fusebase expects.
 * Format: [0x00, subType, varUint(data.length), ...data]
 */
function encodeSyncMessage(subType: number, data: Uint8Array): Uint8Array {
  const header: number[] = [0x00, subType];
  writeVarUint(header, data.length);
  const msg = new Uint8Array(header.length + data.length);
  msg.set(header);
  msg.set(data, header.length);
  return msg;
}

/**
 * Encode an awareness message in the exact format the browser sends.
 * Format: [0x01, varUint(1), varUint(clientId), varUint(clock), varUint(stateLen), ...stateBytes]
 */
function encodeAwarenessMessage(clientId: number, clock: number, state: string): Uint8Array {
  const buf: number[] = [0x01]; // awareness type
  writeVarUint(buf, 1); // count = 1
  writeVarUint(buf, clientId);
  writeVarUint(buf, clock);
  const stateBytes = new TextEncoder().encode(state);
  writeVarUint(buf, stateBytes.length);
  const result = new Uint8Array(buf.length + stateBytes.length);
  result.set(buf);
  result.set(stateBytes, buf.length);
  return result;
}

// ─── Block ID generator ───

let blockCounter = 0;
function genBlockId(): string {
  return `b${Date.now()}_${blockCounter++}`;
}

/**
 * Build Y.Doc content blocks matching Fusebase's schema.
 *
 * Y.Doc structure (TOP-LEVEL shared types, not nested under root):
 *   doc.getMap("blocks")          — Y.Map<string, Y.Map> — block data keyed by ID
 *   doc.getArray("children")      — Y.Array<string> — ordered block IDs
 *   doc.getArray("rootChildren")  — Y.Array<string> — same as children (top-level blocks)
 *
 * Each block (Y.Map):
 *   id, type, number, indent, selectorId, capsule, contentId, mode, parent
 *   characters (Y.Array) — individual chars + format toggles
 */
function addBlocksToDoc(doc: Y.Doc, blocks: ContentBlock[]): void {
  // CRITICAL: Use top-level shared types, NOT nested under doc.getMap("root")
  // The browser editor reads from doc.getMap("blocks"), doc.getArray("children"), etc.
  const blocksMap = doc.getMap("blocks");
  const children = doc.getArray<string>("children");
  const rootChildren = doc.getArray<string>("rootChildren");

  function addInlineChars(chars: Y.Array<unknown>, segments: { text: string; bold?: boolean; italic?: boolean }[]) {
    for (const seg of segments) {
      if (seg.bold) chars.push([{ bold: "true" }]);
      if (seg.italic) chars.push([{ italic: "true" }]);
      for (const ch of seg.text) chars.push([ch]);
      if (seg.italic) chars.push([{ italic: "null" }]);
      if (seg.bold) chars.push([{ bold: "null" }]);
    }
  }

  function addBlock(type: string, props: Record<string, unknown> = {}) {
    const id = genBlockId();
    const bm = new Y.Map();
    // Exact 10-field structure matching browser capture — no extra fields
    bm.set("id", id);
    bm.set("type", type);
    bm.set("number", "0");
    bm.set("indent", (props.indent as number) || 0);
    bm.set("selectorId", "0");
    bm.set("capsule", false);
    bm.set("contentId", "");
    bm.set("mode", "none");
    bm.set("parent", "");
    if (props.language) bm.set("language", props.language);
    if (props.characters) bm.set("characters", props.characters);
    else bm.set("characters", new Y.Array());
    blocksMap!.set(id, bm);
    children!.push([id]);
    rootChildren!.push([id]);
    return bm;
  }

  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        const type = block.level === 1 ? "hLarge" : block.level === 2 ? "hMedium" : "hSmall";
        const chars = new Y.Array();
        addInlineChars(chars, block.children);
        addBlock(type, { characters: chars });
        break;
      }
      case "paragraph": {
        const chars = new Y.Array();
        addInlineChars(chars, block.children);
        addBlock("paragraph", { indent: block.indent, color: block.color, align: block.align, characters: chars });
        break;
      }
      case "list": {
        const listType = block.style === "bullet" ? "listItemBullet" : "listItemNumber";
        for (const item of block.items) {
          const chars = new Y.Array();
          addInlineChars(chars, item.children);
          addBlock(listType, { indent: item.indent, characters: chars });
        }
        break;
      }
      case "checklist": {
        for (const item of block.items) {
          const chars = new Y.Array();
          addInlineChars(chars, item.children);
          addBlock(item.checked ? "listItemChecked" : "listItemUnchecked", { characters: chars });
        }
        break;
      }
      case "divider":
        addBlock("divider");
        break;
      case "blockquote": {
        const chars = new Y.Array();
        addInlineChars(chars, block.children);
        addBlock("blockQuote", { characters: chars });
        break;
      }
      case "code": {
        const chars = new Y.Array();
        for (const ch of block.code) chars.push([ch]);
        addBlock("code", { language: block.language, characters: chars });
        break;
      }
    }
  }
}

// ─── JWT ───

async function getAuthToken(host: string, workspaceId: string, pageId: string, cookie: string): Promise<string> {
  const res = await fetch(
    `https://${host}/v4/api/workspaces/${workspaceId}/texts/${pageId}/tokens`,
    { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ tokens: [] }) },
  );
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  const data = (await res.json()) as { token: string };
  return data.token;
}

// ─── Main writer ───

/**
 * Write content to a Fusebase page using the native Y.js WebSocket protocol.
 *
 * @param host - Fusebase host (e.g., "inkabeam.nimbusweb.me")
 * @param workspaceId - Workspace ID
 * @param pageId - Page/note ID
 * @param cookie - Auth cookie string
 * @param blocks - Content blocks to write
 * @param options - Options
 */
export async function writeContentViaWebSocket(
  host: string,
  workspaceId: string,
  pageId: string,
  cookie: string,
  blocks: ContentBlock[],
  options: {
    /** Replace existing content (default: true) */
    replace?: boolean;
    /** Timeout in ms (default: 20000) */
    timeout?: number;
  } = {},
): Promise<{ success: boolean; error?: string }> {
  const { replace = true, timeout = 20000 } = options;

  // Step 1: Get JWT
  let jwt: string;
  try {
    jwt = await getAuthToken(host, workspaceId, pageId, cookie);
  } catch (e) {
    return { success: false, error: `JWT auth failed: ${(e as Error).message}` };
  }

  // Step 2: Prepare initial Y.Doc
  // The browser creates its doc with the initial content BEFORE connecting.
  // The SyncStep1 in the URL is encoded from this initial state.
  const ydoc = new Y.Doc();

  // Build the SyncStep1 for the URL parameter
  // This is the state vector of our (empty) doc
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0); // sync message type
  encoding.writeVarUint(encoder, 0); // sub-type: step1
  const sv = Y.encodeStateVector(ydoc);
  encoding.writeVarUint8Array(encoder, sv);
  const syncStep1Bytes = encoding.toUint8Array(encoder);
  const syncStep1B64 = Buffer.from(syncStep1Bytes).toString("base64");

  // Step 3: Build WebSocket URL — MUST include encv2=true
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const textHost = "text.nimbusweb.me";
  const wsUrl = [
    `wss://${textHost}/socket.io.editor/${workspaceId}/${pageId}`,
    `?token=${jwt}`,
    `&cid=${ydoc.clientID}`,
    `&app=web&reason=editor&web-editor=1.1.10`,
    `&frame_id=${randomAlphaNum(7)}`,
    `&ratempt=0&widx=0`,
    `&encv2=true`,  // CRITICAL: enables V2 encoding on server
    `&timezone=${encodeURIComponent(tz)}`,
    `&syncStep1=${encodeURIComponent(syncStep1B64)}`,
  ].join("");

  // Step 4: Connect and sync
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl, {
      headers: { origin: `https://${host}`, cookie },
    });

    let resolved = false;
    const done = (result: { success: boolean; error?: string }) => {
      if (!resolved) { resolved = true; clearTimeout(timeoutId); resolve(result); }
      try { ws.close(); } catch {}
    };

    const timeoutId = setTimeout(() => done({ success: false, error: "Timeout" }), timeout);

    ws.on("error", (e: Error) => done({ success: false, error: `WebSocket error: ${e.message}` }));
    ws.on("close", () => { if (!resolved) done({ success: false, error: "Connection closed before sync" }); });
    (ws as any).on("unexpected-response", (_req: unknown, res: { statusCode: number }) => {
      done({ success: false, error: `WebSocket upgrade failed: HTTP ${res.statusCode} (text sync server may be down)` });
    });

    ws.on("open", () => {
      // CRITICAL: Send awareness IMMEDIATELY upon connection, BEFORE any sync
      // This is what the browser does — awareness is the FIRST message sent
      const awarenessMsg = encodeAwarenessMessage(ydoc.clientID, 0, "{}");
      ws.send(Buffer.from(awarenessMsg));
    });

    let syncStep2Received = false;

    ws.on("message", (raw: Buffer, isBinary: boolean) => {
      if (!isBinary) return;
      const data = new Uint8Array(raw);
      if (data.length === 0) return;

      const msgType = data[0];

      // Ping → Pong
      if (msgType === 0x11) { ws.send(Buffer.from(new Uint8Array([0x12]))); return; }
      if (msgType === 0x12 || msgType === 0x01) return; // Pong, awareness

      // Sync (type 0)
      if (msgType !== 0x00) return;
      const [subType, subOff] = readVarUint(data, 1);

      if (subType === 0) {
        // Server SyncStep1: server sends its state vector, wants our state
        // We respond with SyncStep2 containing our complete document state
        // CRITICAL: Use V1 encoding — server expects V1 despite encv2=true in URL
        const [svLen, svStart] = readVarUint(data, subOff);
        const serverSv = data.slice(svStart, svStart + svLen);
        const update = Y.encodeStateAsUpdate(ydoc, serverSv);
        ws.send(Buffer.from(encodeSyncMessage(0x01, update)));
      }

      else if (subType === 1) {
        // Server SyncStep2: server sends its document state
        // With encv2=true, the data is V2-encoded
        syncStep2Received = true;
        const [uLen, uStart] = readVarUint(data, subOff);
        const updateData = data.slice(uStart, uStart + uLen);

        // Apply server state using V2 encoding (encv2=true mode)
        let applied = false;
        try { Y.applyUpdateV2(ydoc, updateData); applied = true; } catch {}
        if (!applied) {
          // Fallback to V1 just in case
          try { Y.applyUpdate(ydoc, updateData); applied = true; } catch {}
        }

        if (!applied) {
          done({ success: false, error: "Failed to apply server document state" });
          return;
        }

        // Now write our content and send the update
        try {
          const beforeSv = Y.encodeStateVector(ydoc);

          ydoc.transact(() => {
            if (replace) {
              // Clear existing top-level shared types
              const ch = ydoc.getArray<string>("children");
              const rch = ydoc.getArray<string>("rootChildren");
              const blk = ydoc.getMap("blocks");
              if (ch.length > 0) ch.delete(0, ch.length);
              if (rch.length > 0) rch.delete(0, rch.length);
              for (const k of Array.from(blk.keys())) blk.delete(k);
            }
            addBlocksToDoc(ydoc, blocks);
          });

          // Encode diff as V1 — server expects V1 despite encv2=true in URL
          const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
          ws.send(Buffer.from(encodeSyncMessage(0x02, diff)));

          // Wait for server to process the update before closing
          setTimeout(() => done({ success: true }), 3000);
        } catch (e) {
          done({ success: false, error: `Write failed: ${(e as Error).message}` });
        }
      }

      else if (subType === 2) {
        // Incremental update from server or another client
        const [uLen, uStart] = readVarUint(data, subOff);
        const updateData = data.slice(uStart, uStart + uLen);
        try { Y.applyUpdateV2(ydoc, updateData); } catch {
          try { Y.applyUpdate(ydoc, updateData); } catch {}
        }
      }
    });
  });
}
