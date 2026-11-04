/**
 * COR-14: CLI argument building for `init` / logs, and the timeout path of executeCommand.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as path from "path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return { ...actual, spawn: vi.fn() };
});

import { spawn } from "child_process";
import { EventEmitter } from "events";
import { FusebaseCliManager } from "../../src/cli-manager.js";
import { startServer } from "./helpers/server.js";

const ok = { success: true, stdout: "ok", stderr: "", exitCode: 0 };

describe("current CLI contract", () => {
  afterEach(() => vi.restoreAllMocks());

  it("defaults updates to a CLI-only preview without Git checkpoints", async () => {
    const exec = vi.spyOn(FusebaseCliManager, "executeCommand").mockResolvedValue(ok);
    const session = await startServer(undefined, { tier: "all" });
    try {
      await session.callText("fusebase_cli_update");
      expect(exec).toHaveBeenCalledWith("update", ["--skip-commit", "--dry-run", "--skip-product"], undefined, 300000);
      await session.callText("fusebase_cli_update", { dryRun: false, includeProduct: true, environment: "staging" });
      expect(exec).toHaveBeenLastCalledWith("update", ["--skip-commit", "--env", "staging"], undefined, 300000);
    } finally { await session.close(); }
  });

  it("rejects obsolete build flags before any remote changes", async () => {
    const exec = vi.spyOn(FusebaseCliManager, "executeCommand").mockResolvedValue(ok);
    const session = await startServer(undefined, { tier: "all" });
    try {
      const res = await session.callText("fusebase_cli_app_update", { appIdOrPath: "app1", permissions: "read", buildCommand: "npm run build" });
      expect(res.isError).toBe(true);
      expect(res.text).toContain("fusebase.json");
      expect(exec).not.toHaveBeenCalled();
    } finally { await session.close(); }
  });

  it("forwards access, additive permission sync and the named environment", async () => {
    const exec = vi.spyOn(FusebaseCliManager, "executeCommand").mockResolvedValue(ok);
    await FusebaseCliManager.updateApp("app1", { access: "visitor,orgRole:member", syncGatePermissions: true, environment: "staging" });
    expect(exec).toHaveBeenCalledWith("app", ["update", "app1", "--access", "visitor,orgRole:member", "--sync-gate-permissions", "--env", "staging"], undefined);
  });

  it("reports CLI update failures as MCP errors", async () => {
    vi.spyOn(FusebaseCliManager, "executeCommand").mockResolvedValue({ ...ok, success: false, exitCode: 1 });
    const session = await startServer(undefined, { tier: "all" });
    try { expect((await session.callText("fusebase_cli_update")).isError).toBe(true); }
    finally { await session.close(); }
  });

  it("reads version and auth status through the noninteractive argument-vector runner", async () => {
    vi.spyOn(FusebaseCliManager, "getCliPath").mockReturnValue("/fake/fusebase");
    const exec = vi.spyOn(FusebaseCliManager, "executeCommand")
      .mockResolvedValueOnce({ ...ok, stdout: "FuseBase CLI 0.33.1\nLauncher 2026.093014.3932\nChannel prod" })
      .mockResolvedValueOnce({ ...ok, stdout: '[{"id":"org1","title":"Test"}]' });
    expect(await FusebaseCliManager.getStatus()).toMatchObject({ version: "0.33.1", authenticated: true });
    expect(exec.mock.calls.map(call => call.slice(0, 2))).toEqual([["--version", []], ["orgs", ["list", "--json"]]]);
  });
});

describe("current CLI secret declarations", () => {
  it("lists only declared keys and descriptions without a CLI process or secret values", async () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "fusebase-secrets-test-"));
    vi.stubEnv("FUSEBASE_CLI_ALLOWED_DIRS", cwd);
    const exec = vi.spyOn(FusebaseCliManager, "executeCommand");
    try {
      writeFileSync(path.join(cwd, "fusebase.json"), JSON.stringify({ apps: [{ path: "apps/demo", id: "app1", secrets: [{ key: "API_KEY", description: "Provider key", value: "do-not-expose" }] }] }));
      const result = await FusebaseCliManager.listSecrets("app1", cwd);
      expect(result.success).toBe(true);
      expect(JSON.parse(result.stdout)).toEqual({ appPath: "apps/demo", source: "fusebase.json", secrets: [{ key: "API_KEY", description: "Provider key" }] });
      expect(result.stdout).not.toContain("do-not-expose");
      expect(exec).not.toHaveBeenCalled();
      expect((await FusebaseCliManager.listSecrets("unknown", cwd)).success).toBe(false);
      writeFileSync(path.join(cwd, "fusebase.json"), 'invalid-json-with-secret');
      const invalid = await FusebaseCliManager.listSecrets("app1", cwd);
      expect(invalid.stderr).toBe("fusebase.json is not valid JSON.");
    } finally {
      exec.mockRestore();
      vi.unstubAllEnvs();
      expect(path.dirname(cwd)).toBe(path.resolve(tmpdir()));
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("fusebase_cli_init (COR-14)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("passes the app name as a plain argument, without literal quotes", async () => {
    const exec = vi.spyOn(FusebaseCliManager, "executeCommand").mockResolvedValue(ok);
    const session = await startServer(undefined, { tier: "all" });
    try {
      const res = await session.callText("fusebase_cli_init", { name: "My App", orgId: "org1" });
      expect(res.isError).toBe(false);
      const [sub, args] = exec.mock.calls[0];
      expect(sub).toBe("init");
      expect(args).toEqual(["--name", "My App", "--yes", "--skip-git", "--org", "org1"]);
      expect(exec.mock.calls[0][3]).toBe(300000);
    } finally {
      await session.close();
    }
  });
});

describe("getLogs maps onto the real CLI (COR-14)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("remote (default) fetches runtime logs with --tail", async () => {
    const exec = vi.spyOn(FusebaseCliManager, "executeCommand").mockResolvedValue(ok);
    await FusebaseCliManager.getLogs("app_123", { lines: 50 });
    expect(exec.mock.calls[0].slice(0, 2)).toEqual(["remote-logs", ["runtime", "app_123", "--tail", "50"]]);
  });

  it("build fetches build logs", async () => {
    const exec = vi.spyOn(FusebaseCliManager, "executeCommand").mockResolvedValue(ok);
    await FusebaseCliManager.getLogs("app_123", { type: "build", lines: 50 });
    expect(exec.mock.calls[0].slice(0, 2)).toEqual(["remote-logs", ["build", "app_123"]]);
  });

  it("clamps --tail to the CLI's 1-1000 range", async () => {
    const exec = vi.spyOn(FusebaseCliManager, "executeCommand").mockResolvedValue(ok);
    await FusebaseCliManager.getLogs("app_123", { lines: 5000 });
    expect(exec.mock.calls[0][1]).toEqual(["runtime", "app_123", "--tail", "1000"]);
  });

  it("dev reports that the CLI has no dev-log command instead of running something else", async () => {
    const exec = vi.spyOn(FusebaseCliManager, "executeCommand").mockResolvedValue(ok);
    const res = await FusebaseCliManager.getLogs("app_123", { type: "dev" });
    expect(res.success).toBe(false);
    expect(res.stderr).toMatch(/dev start/);
    expect(exec).not.toHaveBeenCalled();
  });

  it("requires an app ID for remote logs", async () => {
    const exec = vi.spyOn(FusebaseCliManager, "executeCommand").mockResolvedValue(ok);
    const res = await FusebaseCliManager.getLogs(undefined, {});
    expect(res.success).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it("the fusebase_cli_logs tool forwards the log type", async () => {
    const exec = vi.spyOn(FusebaseCliManager, "executeCommand").mockResolvedValue(ok);
    const session = await startServer(undefined, { tier: "all" });
    try {
      await session.callText("fusebase_cli_logs", { appPath: "app_123", type: "build" });
      expect(exec.mock.calls[0].slice(0, 2)).toEqual(["remote-logs", ["build", "app_123"]]);
    } finally {
      await session.close();
    }
  });
});

describe("executeCommand timeout (COR-14)", () => {
  const originalPlatform = process.platform;
  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    vi.restoreAllMocks();
    vi.mocked(spawn).mockReset();
  });

  /** A child process that never exits on its own. */
  function hangingChild(pid: number) {
    const child: any = new EventEmitter();
    child.pid = pid;
    child.exitCode = null;
    child.signalCode = null;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    return child;
  }

  function setup(platform: NodeJS.Platform, cliPath: string) {
    Object.defineProperty(process, "platform", { value: platform });
    vi.spyOn(FusebaseCliManager, "getCliPath").mockReturnValue(cliPath);
    const children: any[] = [];
    vi.mocked(spawn).mockImplementation((() => {
      const c = hangingChild(4242 + children.length);
      children.push(c);
      return c;
    }) as any);
    return children;
  }

  it("on Windows kills the whole process tree with taskkill, without a shell", async () => {
    const children = setup("win32", "C:\\fake\\fusebase.exe");
    const res = await FusebaseCliManager.executeCommand("deploy", [], undefined, 20);
    expect(res.exitCode).toBe(-2);
    expect(res.stderr).toMatch(/timed out/);

    expect(spawn).toHaveBeenCalledTimes(2);
    const [cmd, args, opts] = vi.mocked(spawn).mock.calls[1] as any[];
    expect(path.basename(cmd).toLowerCase()).toBe("taskkill.exe");
    expect(args).toEqual(["/pid", "4242", "/T", "/F"]);
    expect(opts?.shell).toBeFalsy();
    expect(children[0].kill).not.toHaveBeenCalled();
  });

  it("redacts failed CLI output before returning it to tools", async () => {
    const children = setup("win32", "C:\\fake\\fusebase.exe");
    const pending = FusebaseCliManager.executeCommand("deploy");
    children[0].stdout.emit("data", 'Authorization: Bearer SYNTHETIC_CLI_STDOUT\nDeployment rejected');
    children[0].stderr.emit("data", 'Cookie: sid=SYNTHETIC_CLI_STDERR\nexit 1');
    children[0].emit("close", 1);
    const result = await pending;
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain("SYNTHETIC_CLI_");
    expect(result.stdout).toContain("Deployment rejected");
    expect(result.stderr).toContain("exit 1");
  });

  it("elsewhere uses a normal kill", async () => {
    const children = setup("linux", "/usr/local/bin/fusebase");
    const res = await FusebaseCliManager.executeCommand("deploy", [], undefined, 20);
    expect(res.exitCode).toBe(-2);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(children[0].kill).toHaveBeenCalled();
  });

  it("settles once and detaches its listeners after a timeout", async () => {
    const children = setup("linux", "/usr/local/bin/fusebase");
    const res = await FusebaseCliManager.executeCommand("deploy", [], undefined, 20);
    const child = children[0];
    expect(child.stdout.listenerCount("data")).toBe(0);
    expect(child.stderr.listenerCount("data")).toBe(0);
    expect(child.listenerCount("close")).toBe(0);
    // A late error (e.g. from the kill) must not throw as an unhandled 'error' event.
    expect(() => child.emit("error", new Error("late"))).not.toThrow();
    child.emit("close", null);
    expect(res.exitCode).toBe(-2);
  });
});
