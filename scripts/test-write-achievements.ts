/**
 * Test: Write achievements page using the production writeContentViaWebSocket
 */
import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
import { markdownToSchema } from "../src/markdown-parser.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = fs.readFileSync(path.resolve(__dirname, "..", ".env"), "utf-8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const host = process.env.FUSEBASE_HOST!;
// Prefer encrypted cookie store, fall back to env
const stored = loadEncryptedCookie();
const cookie = stored?.cookie || process.env.FUSEBASE_COOKIE!;
console.log(`🔑 Cookie source: ${stored?.cookie ? "encrypted store" : ".env file"} (${cookie.length} chars)`);
const wsId = "45h7lom5ryjak34u";
const pageId = "FLkcqYXSj0gZ6KMQ";

const markdown = `# 🏆 Fusebase MCP — Project Achievements

## Overview

This document tracks the milestones achieved in building native Fusebase MCP integration — from initial API discovery to full Y.js WebSocket content writing.

---

## 🔬 Phase 1: API Discovery & Authentication

- **Cookie-based auth** — Reverse-engineered session cookie format from browser traffic
- **Encrypted cookie storage** — AES-256-GCM encrypted persistence in data/cookie.enc
- **Auto-refresh** — Playwright-based cookie renewal when sessions expire
- **API mapping** — Documented 40+ internal REST endpoints across workspaces, pages, folders, tasks, tags, files, and members

---

## 📦 Phase 2: MCP Server Foundation

- **18 core tools** — Full CRUD for pages, folders, tasks, tags, files, and members
- **Cached workspace/folder data** — Persistent JSON cache with TTL for fast lookups
- **API response logging** — Rotated log files for debugging API changes
- **Zod schema validation** — Type-safe parameter handling for all tools

---

## 🔍 Phase 3: Content Reading

- **HTML content extraction** — get_page_content returns rendered HTML from pages
- **Attachment listing** — Images, files, audio with MIME types and UUIDs
- **Page metadata** — Title, dates, size, sharing status, emoji

---

## ✍️ Phase 4: Content Writing (The Hard Part)

- **Markdown parser** — Converts markdown to Fusebase's ContentBlock schema
- **Block types** — Headings (H1/H2/H3), paragraphs, bullet lists, numbered lists, checklists, dividers, blockquotes, code blocks
- **Inline formatting** — Bold, italic with toggle-attribute pattern
- **Y.js WebSocket protocol** — Reverse-engineered the complete binary sync protocol

---

## 🚀 Phase 5: Native Y.js WebSocket Writer

- **7 iterations** to crack the protocol (V1 through V7b)
- **Key discovery** — Y.js uses a SEPARATE raw WebSocket on text.nimbusweb.me, not Socket.IO
- **JWT auth in URL** — Token obtained from /tokens endpoint, passed as query parameter
- **V2 binary encoding** — Server requires encv2=true for update encoding
- **Binary message protocol** — Sync Step 1/2/Update, Awareness, Ping/Pong
- **532-byte first successful write** — Content verified via dump endpoint

---

## 📊 Achievement Summary

1. **Tools Implemented** — 18 Core + Extended Set
1. **Content Types Supported** — 8 Block Types + 2 Inline Formats
1. **Protocol Iterations** — 7 Versions to Working Writer
1. **Lines of Production Code** — ~600 (writer + schema + parser)
1. **Authentication Methods** — Cookie + JWT + WebSocket Token

---

## 🎯 Technical Highlights

> The breakthrough came from capturing live WebSocket traffic via Playwright CDP — revealing that Fusebase routes Y.js sync through a dedicated text.nimbusweb.me host with JWT authentication embedded in the URL query string.

> Every content edit in Fusebase — from typing a single character to pasting an entire document — flows through this Y.js CRDT sync protocol. By speaking this protocol natively, the MCP server can write content with the same fidelity as the browser editor.
`;

async function main() {
  console.log("📝 Converting markdown to schema...");
  const blocks = markdownToSchema(markdown);
  console.log(`   ${blocks.length} blocks`);

  console.log("🚀 Writing via native Y.js WebSocket...");
  const result = await writeContentViaWebSocket(host, wsId, pageId, cookie, blocks, { replace: true });

  if (result.success) {
    console.log("✅ SUCCESS! Content written to page.");
    console.log(`   https://${host}/note/${pageId}`);
  } else {
    console.log(`❌ FAILED: ${result.error}`);
  }
}

main().catch(console.error);
