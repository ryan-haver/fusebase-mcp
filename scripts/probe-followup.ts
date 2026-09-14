import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq > 0 && !process.env[t.slice(0, eq).trim()]) {
      process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  }
}

import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";

const stored = loadEncryptedCookie();
const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const ORG_ID = process.env.FUSEBASE_ORG_ID || "u268r1";
const COOKIE = stored?.cookie || process.env.FUSEBASE_COOKIE || "";

const client = new FusebaseClient({
  host: HOST,
  orgId: ORG_ID,
  cookie: COOKIE,
});

async function runFollowup() {
  console.log("=== FOLLOWUP PROBE: MOVE NOTE & AUTOMATION FOLDERS ===\n");
  const workspaces = await client.listWorkspaces();
  const wid = workspaces[0]?.id || "45h7lom5ryjak34u";

  // Check move note with folder/parent
  const notes = await client.listPages(wid, { limit: 1 });
  const nid = notes.items?.[0]?.globalId;
  const folders = await client.listFolders(wid);
  const folderId = folders[0]?.id;

  console.log(`Page: ${nid}, Folder: ${folderId}`);
  if (nid && folderId) {
    const payload = { workspaceId: wid, parentId: folderId };
    const res = await fetch(`https://${HOST}/v2/api/workspaces/${wid}/notes/${nid}/move`, {
      method: "POST",
      headers: { cookie: COOKIE, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload)
    });
    console.log(`[${res.status}] Move to folder payload: ${JSON.stringify(payload)}`);
    console.log(`   Response: ${await res.text()}`);
  }

  // Also check if we can move note back to root
  if (nid) {
    const payload = { workspaceId: wid, parentId: "root" };
    const res = await fetch(`https://${HOST}/v2/api/workspaces/${wid}/notes/${nid}/move`, {
      method: "POST",
      headers: { cookie: COOKIE, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload)
    });
    console.log(`[${res.status}] Move to root payload: ${JSON.stringify(payload)}`);
    console.log(`   Response: ${await res.text()}`);
  }

  // Check ActivePieces automation folder update: PATCH or POST?
  const autoAuth = await client.ensureAutomationAuth();
  if (autoAuth.token) {
    // Create test folder
    const createRes = await fetch(`https://${HOST}/automation/api/v1/folders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${autoAuth.token}`,
        cookie: COOKIE,
        "FBS-Session-ID": COOKIE.match(/eversessionid=([^;]+)/)?.[1]?.trim() || "",
        "content-type": "application/json"
      },
      body: JSON.stringify({ displayName: "Rename Me", color: "blue" })
    });
    const createdFolder = await createRes.json();
    console.log(`Created test automation folder: ${createdFolder.id} (${createdFolder.displayName})`);

    // Test rename via POST or PATCH
    const patchRes = await fetch(`https://${HOST}/automation/api/v1/folders/${createdFolder.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${autoAuth.token}`,
        cookie: COOKIE,
        "FBS-Session-ID": COOKIE.match(/eversessionid=([^;]+)/)?.[1]?.trim() || "",
        "content-type": "application/json"
      },
      body: JSON.stringify({ displayName: "Renamed Folder", color: "purple" })
    });
    console.log(`[${patchRes.status}] PATCH /automation/api/v1/folders/${createdFolder.id}: ${await patchRes.text()}`);

    // Cleanup
    await fetch(`https://${HOST}/automation/api/v1/folders/${createdFolder.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${autoAuth.token}`,
        cookie: COOKIE,
        "FBS-Session-ID": COOKIE.match(/eversessionid=([^;]+)/)?.[1]?.trim() || "",
      }
    });
    console.log("Cleaned up test automation folder.");
  }
}

runFollowup().catch(console.error);
