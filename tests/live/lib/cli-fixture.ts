import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";
import { assert, assertEqual, assertIncludes, callTool, ROOT_DIR, verifyWrite } from "./harness.js";

/** Exercise the installed CLI's local declarations without deploying a container or secret. */
export async function validateCliDeclarations(client: Client): Promise<void> {
  const scratch = join(ROOT_DIR, "scratch");
  mkdirSync(scratch, { recursive: true });
  const cwd = mkdtempSync(join(scratch, "cli-validation-"));
  const rel = relative(scratch, cwd);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("CLI fixture cleanup path escaped scratch");
  const appPath = "apps/qa-fixture";
  const file = join(cwd, "fusebase.json");
  writeFileSync(file, JSON.stringify({ apps: [{ name: "QA CLI Fixture", path: appPath, backend: { dockerfile: "Dockerfile", port: 3000 } }] }, null, 2));
  const app = () => JSON.parse(readFileSync(file, "utf8")).apps[0];
  try {
    const secret = await callTool(client, "fusebase_cli_secret_create", { appPath, key: "QA_TEST_KEY", description: "Test declaration only", cwd });
    assertEqual(secret.success, true, "CLI secret declaration success");
    await verifyWrite("fusebase_cli_secret_create", "local secret key and description read back, with no secret value", async () => {
      const listed = await callTool(client, "fusebase_cli_secret_list", { appPath, cwd });
      assertEqual(listed.success, true, "CLI secret list success");
      const entry = JSON.parse(listed.stdout).secrets.find((s: any) => s.key === "QA_TEST_KEY");
      assertEqual(entry?.description, "Test declaration only", "secret description");
      assert(!("value" in entry), "secret list contains no values");
    });
    const added = await callTool(client, "fusebase_cli_sidecar_add", { appPath, name: "qa-cache", image: "redis:7-alpine", port: 6379, tier: "small", env: { QA_MODE: "true" }, cwd });
    assertEqual(added.success, true, "CLI sidecar add success");
    await verifyWrite("fusebase_cli_sidecar_add", "local sidecar declaration reads back with its image, port and environment", async () => {
      const listed = await callTool(client, "fusebase_cli_sidecar_list", { appPath, cwd });
      assertEqual(listed.success, true, "CLI sidecar list success");
      assertIncludes(listed.stdout, "qa-cache", "sidecar list");
      const entry = app().backend.sidecars.find((s: any) => s.name === "qa-cache");
      assertEqual(entry?.image, "redis:7-alpine", "sidecar image");
      assertEqual(entry?.port, 6379, "sidecar port");
      assertEqual(entry?.env?.QA_MODE, "true", "sidecar environment");
    });
    const removed = await callTool(client, "fusebase_cli_sidecar_remove", { appPath, name: "qa-cache", cwd });
    assertEqual(removed.success, true, "CLI sidecar remove success");
    await verifyWrite("fusebase_cli_sidecar_remove", "sidecar declaration absent from fresh CLI list and local config", async () => {
      const listed = await callTool(client, "fusebase_cli_sidecar_list", { appPath, cwd });
      assertEqual(listed.success, true, "CLI sidecar list after removal");
      assert(!listed.stdout.includes("qa-cache"), "sidecar absent from CLI list");
      assert(!(app().backend.sidecars ?? []).some((s: any) => s.name === "qa-cache"), "sidecar absent from config");
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
