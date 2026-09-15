/**
 * Comprehensive regression test: exercises ALL block types + inline formats
 * in a single page write → read round-trip.
 */
import { writeContentViaWebSocket, readContentViaWebSocket } from "../src/yjs-ws-writer.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import type { ContentBlock } from "../src/content-schema.js";
import { markdownToSchema, parseInline } from "../src/markdown-parser.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq > 0 && !process.env[t.slice(0, eq).trim()])
            process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
}

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const COOKIE = process.env.FUSEBASE_COOKIE || loadEncryptedCookie()?.cookie!;
const WS_ID = process.env.FUSEBASE_WORKSPACE_ID || "49b306wxd9oa7hyc";

async function main() {
    const blocks: ContentBlock[] = [
        // ─── Headings (Phase 1) ───
        { type: "heading", level: 1, children: [{ text: "Full Regression Test" }] },
        { type: "heading", level: 2, children: [{ text: "Heading H2" }] },
        { type: "heading", level: 3, children: [{ text: "Heading H3" }] },
        // ─── Paragraph with all inline formats (Phase 1) ───
        {
            type: "paragraph", children: [
                { text: "Normal " },
                { text: "bold", bold: true },
                { text: " " },
                { text: "italic", italic: true },
                { text: " " },
                { text: "struck", strikethrough: true },
                { text: " " },
                { text: "underlined", underline: true },
                { text: " " },
                { text: "code", code: true },
                { text: " " },
                { text: "link", link: "https://example.com" },
            ]
        },
        // ─── Divider ───
        { type: "divider" },
        // ─── Lists (existing) ───
        {
            type: "list", style: "bullet", items: [
                { children: [{ text: "Bullet 1" }] },
                { children: [{ text: "Bullet 2" }] },
            ]
        },
        {
            type: "list", style: "number", items: [
                { children: [{ text: "Number 1" }] },
                { children: [{ text: "Number 2" }] },
            ]
        },
        // ─── Checklist (existing) ───
        {
            type: "checklist", items: [
                { children: [{ text: "Unchecked" }], checked: false },
                { children: [{ text: "Checked" }], checked: true },
            ]
        },
        // ─── Blockquote (existing) ───
        { type: "blockquote", children: [{ text: "A wise quote" }] },
        // ─── Code block (existing) ───
        { type: "code", language: "typescript", code: "const x: number = 42;" },
        // ─── Toggle (Phase 3) ───
        {
            type: "toggle",
            summary: [{ text: "Toggle Summary" }],
            children: [{ type: "paragraph", children: [{ text: "Hidden content" }] }],
        },
        // ─── Hint/Callout (Phase 3) ───
        { type: "hint", children: [{ text: "Important callout" }] },
        // ─── Collapsible Heading (Phase 3) ───
        {
            type: "collapsible-heading",
            level: 2,
            summary: [{ text: "Collapsible Section" }],
            children: [{ type: "paragraph", children: [{ text: "Nested content" }] }],
        },
        // ─── Image (Phase 4) ───
        {
            type: "image",
            src: "https://via.placeholder.com/400x200.png?text=Regression+Test",
            width: 400,
        },
        // ─── Bookmark (Phase 4) ───
        { type: "bookmark", url: "https://github.com" },
        // ─── Outline (Phase 4) ───
        { type: "outline", bordered: true, numbered: true, expanded: true },
        // ─── Button (Phase 4) ───
        { type: "button-single", title: "Test Button", url: "https://example.com" },
        // ─── Steps (Phase 4) ───
        { type: "step-aggregator" },
        { type: "step", children: [{ type: "paragraph", children: [{ text: "Step 1" }] }] },
        { type: "step", children: [{ type: "paragraph", children: [{ text: "Step 2" }] }] },
        // ─── Table (existing) ───
        {
            type: "table",
            columns: [
                { text: "Name", type: "text" },
                { text: "Value", type: "number" },
            ],
            rows: [
                { cells: [{ cellType: "text", children: [{ text: "Alpha" }] }, { cellType: "number", value: 42 }] },
                { cells: [{ cellType: "text", children: [{ text: "Beta" }] }, { cellType: "number", value: 99 }] },
            ],
        },
        // ─── Grid / 2-column layout (Phase 6) ───
        {
            type: "grid",
            columns: [
                { type: "gridCol", width: "auto", children: [{ type: "paragraph", children: [{ text: "Left column" }] }] },
                { type: "gridCol", width: "auto", children: [{ type: "paragraph", children: [{ text: "Right column" }] }] },
            ],
        },
        // ─── Final paragraph ───
        { type: "paragraph", children: [{ text: "End of regression test" }] },
    ];

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let noteId = "";
    for (let i = 0; i < 16; i++) noteId += chars.charAt(Math.floor(Math.random() * chars.length));

    await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
        method: "POST",
        headers: { cookie: COOKIE, "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: WS_ID, noteId, note: { textVersion: 2, title: "REGRESSION TEST", parentId: "default", is_portal_share: false } }),
    });

    console.log("=== Writing all block types... ===");
    const writeResult = await writeContentViaWebSocket(HOST, WS_ID, noteId, COOKIE, blocks, { replace: true, timeout: 20000 });
    console.log(`Write: ${JSON.stringify(writeResult)}`);

    if (!writeResult.success) {
        console.log(`❌ WRITE FAILED: ${writeResult.error}`);
        process.exit(1);
    }
    console.log("✅ Write succeeded");

    // Read back
    console.log("\n=== Reading back via decoder... ===");
    await new Promise(r => setTimeout(r, 2000));
    const readResult = await readContentViaWebSocket(HOST, WS_ID, noteId, COOKIE);

    if (!readResult.success) {
        console.log(`❌ READ FAILED: ${readResult.error}`);
        process.exit(1);
    }
    console.log("✅ Read succeeded");

    const html = readResult.html || "";
    console.log(`HTML: ${html.length} chars`);
    console.log(html);

    // Verification checks
    const checks: [string, boolean][] = [
        // Headings
        ["H1", html.includes("Full Regression Test")],
        ["H2", html.includes("Heading H2")],
        ["H3", html.includes("Heading H3")],
        // Inline formats
        ["bold", html.includes("<strong>")],
        ["italic", html.includes("<em>")],
        ["strikethrough", html.includes("<del>")],
        ["underline", html.includes("<u>")],
        ["inline code", html.includes("<code>")],
        ["link", html.includes("href=")],
        // Divider
        ["divider", html.includes("<hr>")],
        // Quote
        ["blockquote", html.includes("wise quote")],
        // Code block
        ["code block", html.includes("42")],
        // Toggle
        ["toggle", html.includes("Toggle Summary")],
        // Hint
        ["hint/callout", html.includes("callout")],
        // Collapsible
        ["collapsible", html.includes("Collapsible")],
        // Image
        ["image", html.includes("<img") || html.includes("image")],
        // Bookmark
        ["bookmark", html.includes("bookmark") || html.includes("github")],
        // Outline
        ["outline", html.includes("outline")],
        // Button
        ["button", html.includes("button")],
        // Steps
        ["steps", html.includes("step")],
        // Grid (Phase 6)
        ["grid left col", html.includes("Left column")],
        ["grid right col", html.includes("Right column")],
    ];

    console.log("\n=== Y.js Block & HTML Decoder Verification ===");
    let pass = 0, fail = 0;
    for (const [name, ok] of checks) {
        console.log(`  ${ok ? "✅" : "❌"} ${name}`);
        if (ok) pass++; else fail++;
    }

    // ─── Markdown Parser Validation ───
    console.log("\n=== Markdown Ingestion Parser Verification ===");
    const mdTableSample = `| Name | Role | Salary | Active |
|:-----|:----:|-------:|:------:|
| Alice | Eng | $140,000 | [x] |
| Bob | Ops | $90,000 | [ ] |`;
    const parsedBlocks = markdownToSchema(mdTableSample);
    const tableBlock = parsedBlocks.find((b) => b.type === "table") as any;

    const mdCallout = `> [!WARNING]
> Critical system update needed`;
    const calloutBlocks = markdownToSchema(mdCallout);
    const hintBlock = calloutBlocks.find((b) => b.type === "hint") as any;

    const mdImage = `![Network Architecture](https://example.com/net.png "Topology")`;
    const imgBlocks = markdownToSchema(mdImage);
    const imageBlock = imgBlocks.find((b) => b.type === "image") as any;

    const mdToggle = `<details>
<summary>Database Secrets</summary>
Password is hidden
</details>`;
    const toggleBlocks = markdownToSchema(mdToggle);
    const toggleBlock = toggleBlocks.find((b) => b.type === "toggle") as any;

    const mdInline = `Word with <u>underlined text</u> and ==yellow highlight==`;
    const inlineSegs = parseInline(mdInline);

    const parserChecks: [string, boolean][] = [
        ["GFM table parsed to TableBlock", !!tableBlock],
        ["GFM table columns detected (4 columns)", tableBlock?.columns?.length === 4],
        ["GFM table currency column inferred", tableBlock?.columns?.[2]?.type === "currency"],
        ["GFM table checkbox column inferred", tableBlock?.columns?.[3]?.type === "checkbox"],
        ["GFM table row count (2 rows)", tableBlock?.rows?.length === 2],
        ["GFM table currency cell parsed numerically", tableBlock?.rows?.[0]?.cells?.[2]?.value === 140000],
        ["GFM table checkbox cell parsed to boolean", tableBlock?.rows?.[0]?.cells?.[3]?.checked === true],
        ["GitHub callout parsed to HintBlock", !!hintBlock],
        ["GitHub callout warning mapped to yellow color", hintBlock?.color === "yellow"],
        ["Markdown image parsed to ImageBlock", !!imageBlock && imageBlock.src === "https://example.com/net.png"],
        ["Markdown image caption extracted", imageBlock?.caption?.[0]?.text === "Topology"],
        ["HTML <details> parsed to ToggleBlock", !!toggleBlock],
        ["Toggle summary extracted from <summary>", toggleBlock?.summary?.[0]?.text === "Database Secrets"],
        ["HTML <u> parsed to underline: true", inlineSegs.some((s) => s.underline && s.text === "underlined text")],
        ["== parsed to highlight: yellow", inlineSegs.some((s) => !!s.highlight && s.text === "yellow highlight")],
    ];

    for (const [name, ok] of parserChecks) {
        console.log(`  ${ok ? "✅" : "❌"} ${name}`);
        if (ok) pass++; else fail++;
    }

    const totalAssertions = checks.length + parserChecks.length;
    console.log(`\n${fail === 0 ? "✅ ALL PASS" : "❌ SOME FAILED"} (${pass}/${totalAssertions})`);
    console.log(`  https://${HOST}/space/${WS_ID}/page/${noteId}`);

    if (fail > 0) process.exit(1);
}

main().catch(console.error);
