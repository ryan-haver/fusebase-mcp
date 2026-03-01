# Brainstorm: Fix FuseBase WebSocket Connection Issue

## Goal
Restore the ability for `yjs-ws-writer.ts` to maintain a persistent WebSocket connection to `text.nimbusweb.me` long enough to write Y.js content updates to FuseBase pages. The connection currently drops with code 1006 (abnormal closure) immediately after the sync handshake completes.

## Constraints
- The FuseBase text sync server (`text.nimbusweb.me`) is a black-box — we can't change server-side code
- The Y.js sync protocol (SyncStep1/SyncStep2) is non-negotiable — it's how FuseBase stores documents
- The browser client works perfectly — so the protocol IS supported, we just need to match it exactly
- Cookie auth is confirmed working (JWT endpoint, dump endpoint, and WS upgrade all succeed)
- Git history confirms: all commits are from Feb 22 (6 days ago). The same committed code that worked then fails now — this is a **server-side protocol change**

## Known context
- **What works**: WS upgrade succeeds → `open` event fires → server sends SyncStep1 → server sends SyncStep2 (5466 bytes, 37 blocks applied successfully)
- **What fails**: Server closes connection with code 1006 (no close frame) after delivering SyncStep2 — before we can send our content update
- **Browser captures** show the browser sends three messages on open: (1) SyncStep1 `[0,0,1,0]`, (2) Awareness, (3) Token auth message (type 300 = `varuint(300), varuint(jwt_len), jwt_bytes`)
- **Token auth (type 300)** was added to our writer but didn't fix the issue
- **Both Python and Node fail identically** — ruling out a ws library bug
- **Minimal test (no response to SyncStep1)** — connection stays alive for 10s+, but we can't write without completing the sync
- The browser's captured `sent` messages also include a **48-byte SyncStep2/Update** message `[0, 1, 45, 0, 2, ...]` that we haven't replicated exactly
- The browser uses `ratempt=1&widx=1` on reconnect vs our `ratempt=0&widx=0`

## Risks
1. **Protocol keeps changing**: FuseBase may continue evolving the WS protocol, breaking us again
2. **Race condition**: The server may expect messages in a very tight timing window
3. **Missing response**: The server may expect a specific acknowledgment after SyncStep2 that we're not sending
4. **Version gating**: The `web-editor=1.1.10` version string may now be rejected or trigger different server behavior
5. **Session conflict**: Multiple connections to the same page (our test + browser) may cause the server to drop one

## Options (2–4)

### Option A: Playwright-Based Writer (Replace WS entirely)
Use Playwright to drive a headless browser, inject Y.js mutations via `page.evaluate()`, and let the browser's own client handle the WebSocket protocol.
- **Pros**: Always matches the real protocol; immune to server-side changes; we piggyback on FuseBase's own client code
- **Cons**: Heavier runtime (needs Chromium); slower startup; more complex error handling; harder to run in CI/serverless
- **Effort**: Medium (2-4 hours)

### Option B: CDP WebSocket Interception
Use Playwright's CDP (Chrome DevTools Protocol) to intercept the browser's live WebSocket frames, decode the **exact** binary message sequence, and replicate it byte-for-byte in our Node writer.
- **Pros**: Gives us the ground truth of every byte the server expects; one-time capture that can be re-captured when things break
- **Cons**: Still a manual reverse-engineering step; may break on next server update
- **Effort**: Medium (2-3 hours for capture + fix)

### Option C: Hybrid — Use browser for the WS connection, inject our Y.js via CDP
Open the page in a headless Playwright browser, wait for the native WS sync to complete, then use CDP to access the Y.Doc in memory, apply our mutations, and let the browser's own WS client send the update.
- **Pros**: The most robust long-term — the browser handles all protocol details; we only touch the Y.Doc
- **Cons**: Requires understanding FuseBase's client-side Y.Doc variable name/accessor; may need to eval into their iframe/context
- **Effort**: Medium-High (3-5 hours)

### Option D: Deep Protocol Fix — Capture and Replay Exact Browser Frames
Use Playwright CDP's `Network.webSocketFrameSent` / `Network.webSocketFrameReceived` events to capture every binary frame in both directions during a real edit session, then update our writer to match the exact sequence byte-for-byte.
- **Pros**: Keeps our lightweight Node-only writer; no browser dependency at runtime
- **Cons**: Fragile — will break again on next server protocol change; debugging is hard
- **Effort**: Low-Medium (1-2 hours for capture, 1-2 hours for implementation)

## Recommendation
**Option C (Hybrid)** is the most robust long-term solution, but **Option D (Deep Protocol Fix)** should be attempted first since it's lower effort and keeps the lightweight runtime. If Option D fails after 2 hours of effort, fall back to Option C.

**Immediate next step**: Write a Playwright CDP script that captures every WebSocket frame during a real table edit, then compare against our writer's output to find the exact delta.

## Acceptance criteria
- [ ] `test-table-simple.ts` returns `{ success: true }` and content is visible on the page
- [ ] `test-table-sort.ts` creates a pre-sorted table successfully
- [ ] `test-table-merge.ts` creates a table with merged cells successfully
- [ ] Connection stays alive for 3+ seconds after content write (no premature 1006)
- [ ] Solution works for both new page creation and updating existing pages
