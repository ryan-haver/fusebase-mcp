/**
 * COR-14: CLI argument building for `init` / logs, and the timeout path of executeCommand.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as path from "path";

vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return { ...actual, spawn: vi.fn() };
});

import { spawn } from "child_process";
import { EventEmitter } from "events";
import { FusebaseCliManager } from "../../src/cli-manager.js";
import { startServer } from "./helpers/server.js";

const ok = { success: true, stdout: "ok", stderr: "", exitCode: 0 };

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
      expect(args).toEqual(["--name", "My App", "--org", "org1"]);
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
