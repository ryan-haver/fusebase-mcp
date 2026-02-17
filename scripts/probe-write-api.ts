/**
 * Probe all possible content write endpoints.
 * The browser MUST have a way to write content. Let's find it.
 */
import { loadEncryptedCookie } from "../src/crypto.js";

const host = "inkabeam.nimbusweb.me";
const stored = loadEncryptedCookie();
const cookie = stored?.cookie || "";
const wsId = "45h7lom5ryjak34u";

// Known page with content (use a page that the user has content in)
// Or create fresh via the API

const testContent = "<p>Hello from REST API test</p>";

// Try various endpoints that might accept content writes
const endpoints = [
  // V4 blots content (what the getPageContent previously used)
  { method: "PUT", path: "/v4/api/workspaces/{wsId}/blots/{noteId}/content", body: testContent, contentType: "text/html" },
  { method: "POST", path: "/v4/api/workspaces/{wsId}/blots/{noteId}/content", body: testContent, contentType: "text/html" },
  { method: "PATCH", path: "/v4/api/workspaces/{wsId}/blots/{noteId}/content", body: testContent, contentType: "text/html" },
  
  // V2 web-editor save
  { method: "PUT", path: "/v2/api/web-editor/space/{wsId}/note/{noteId}", body: JSON.stringify({ content: testContent }), contentType: "application/json" },
  { method: "POST", path: "/v2/api/web-editor/space/{wsId}/note/{noteId}/content", body: testContent, contentType: "text/html" },
  { method: "PUT", path: "/v2/api/web-editor/space/{wsId}/note/{noteId}/content", body: testContent, contentType: "text/html" },
  
  // Dump endpoint (write variant?)
  { method: "PUT", path: "/dump/{wsId}/{noteId}", body: testContent, contentType: "text/html" },
  { method: "POST", path: "/dump/{wsId}/{noteId}", body: testContent, contentType: "text/html" },
  
  // V2 notes update
  { method: "PUT", path: "/v2/api/workspaces/{wsId}/notes/{noteId}", body: JSON.stringify({ content: testContent }), contentType: "application/json" },
  { method: "PATCH", path: "/v2/api/workspaces/{wsId}/notes/{noteId}", body: JSON.stringify({ content: testContent }), contentType: "application/json" },
  
  // Text-service REST
  { method: "POST", path: "/v2/api/web-editor/notes/{noteId}/save", body: testContent, contentType: "text/html" },
  
  // gwapi2 endpoints (seen in HAR analysis)
  { method: "POST", path: "/gwapi2/ft:notes/content/{noteId}", body: testContent, contentType: "text/html" },
  { method: "PUT", path: "/gwapi2/ft:notes/{noteId}/content", body: testContent, contentType: "text/html" },
];

async function main() {
  // First create a test page
  console.log("═══ Probing Content Write Endpoints ═══\n");
  
  // Create page
  const createResp = await fetch(`https://${host}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: wsId,
      noteId: `probe_${Date.now().toString(36)}`,
      note: { textVersion: 2, title: "API Probe Test", parentId: "default", is_portal_share: false }
    })
  });
  const page = await createResp.json() as any;
  const noteId = page.globalId;
  console.log(`Page created: ${noteId}\n`);
  
  // Wait for server to register
  await new Promise(r => setTimeout(r, 2000));
  
  // Try each endpoint
  for (const ep of endpoints) {
    const url = `https://${host}${ep.path.replace("{wsId}", wsId).replace("{noteId}", noteId)}`;
    try {
      const resp = await fetch(url, {
        method: ep.method,
        headers: { 
          Cookie: cookie, 
          "Content-Type": ep.contentType,
        },
        body: ep.body,
      });
      const status = resp.status;
      const respText = await resp.text();
      const preview = respText.substring(0, 150).replace(/\n/g, "\\n");
      
      const icon = status < 400 ? "✅" : status === 404 ? "🚫" : "⚠️";
      console.log(`${icon} ${ep.method} ${ep.path} → ${status}`);
      if (status < 400) {
        console.log(`   Response: ${preview}`);
      }
    } catch (e) {
      console.log(`❌ ${ep.method} ${ep.path} → ERROR: ${(e as Error).message}`);
    }
  }
  
  // Also: what endpoints does the text server support via REST?
  console.log("\n═══ Checking text.nimbusweb.me REST endpoints ═══\n");
  const textEndpoints = [
    { method: "GET", path: `/api/doc/${wsId}/${noteId}` },
    { method: "GET", path: `/${wsId}/${noteId}` },
    { method: "POST", path: `/api/doc/${wsId}/${noteId}` },
    { method: "GET", path: `/api/status` },
    { method: "GET", path: `/health` },
    { method: "GET", path: `/` },
  ];
  
  for (const ep of textEndpoints) {
    try {
      const resp = await fetch(`https://text.nimbusweb.me${ep.path}`, {
        method: ep.method,
        headers: { Cookie: cookie },
        body: ep.method === "POST" ? testContent : undefined,
      });
      const status = resp.status;
      const respText = await resp.text();
      const preview = respText.substring(0, 150).replace(/\n/g, "\\n");
      const icon = status < 400 ? "✅" : "🚫";
      console.log(`${icon} ${ep.method} text.nimbusweb.me${ep.path} → ${status}`);
      if (status < 400) console.log(`   ${preview}`);
    } catch (e) {
      console.log(`❌ ${ep.method} text.nimbusweb.me${ep.path} → ${(e as Error).message}`);
    }
  }
  
  // Check what the page metadata looks like after creation
  console.log("\n═══ Page metadata ═══");
  const metaResp = await fetch(`https://${host}/v2/api/web-editor/space/${wsId}/note/${noteId}`, {
    headers: { Cookie: cookie }
  });
  const meta = await metaResp.json();
  console.log(JSON.stringify(meta, null, 2));
  
  console.log(`\nPage: https://${host}/note/${noteId}`);
}

main().catch(console.error);
