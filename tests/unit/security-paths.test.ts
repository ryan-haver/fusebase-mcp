import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return { ...actual, spawn: vi.fn() };
});

import { spawn } from "child_process";
import { EventEmitter } from "events";
import { getGuideContent, guidesAvailable } from "../../src/guide-loader.js";
import { FusebaseCliManager } from "../../src/cli-manager.js";

describe("getGuideContent (SEC-3)", () => {
  // A fixture guides folder, with a file just outside it that path traversal would reach.
  let root: string;
  const saved = process.env.FUSEBASE_GUIDES_DIR;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "fusebase-guides-"));
    fs.mkdirSync(path.join(root, "guides", "basics"), { recursive: true });
    fs.writeFileSync(path.join(root, "guides", "basics", "hint-object.md"), "# Hint object\n");
    fs.writeFileSync(path.join(root, "PLAN-content-formats.md"), "outside the guides folder");
    process.env.FUSEBASE_GUIDES_DIR = path.join(root, "guides");
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.FUSEBASE_GUIDES_DIR;
    else process.env.FUSEBASE_GUIDES_DIR = saved;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("reads a guide", () => {
    expect(getGuideContent("basics", "hint-object")).toContain("Hint object");
  });

  it("says the guides aren't downloaded when the folder is missing", () => {
    process.env.FUSEBASE_GUIDES_DIR = path.join(root, "missing");
    expect(guidesAvailable()).toBe(false);
    expect(getGuideContent("basics", "hint-object")).toBeNull();
  });

  it.each([
    ["..", "PLAN-content-formats"],
    ["basics", "../../PLAN-content-formats"],
    ["basics/..", "index"],
    ["C:", "x"],
  ])("refuses to read outside the guides directory: section %j slug %j", (section, slug) => {
    expect(getGuideContent(section, slug)).toBeNull();
  });
});

describe("FusebaseCliManager.executeCommand (SEC-6)", () => {
  const originalPlatform = process.platform;
  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    vi.restoreAllMocks();
    vi.mocked(spawn).mockReset();
  });

  function fakeChild() {
    const child: any = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    setTimeout(() => child.emit("close", 0), 0);
    return child;
  }

  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fusebase-sec6-"));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  /** Write an npm-style .cmd shim; with `withEntry` it points at a real JS entry point. */
  function writeShim(withEntry: boolean): string {
    const shim = path.join(tmp, "fusebase.cmd");
    fs.mkdirSync(path.join(tmp, "node_modules", "fusebase", "bin"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "node_modules", "fusebase", "bin", "cli.js"), "");
    const body = withEntry
      ? '@ECHO off\r\nSET dp0=%~dp0\r\n"%_prog%"  "%dp0%\\node_modules\\fusebase\\bin\\cli.js" %*\r\n'
      : "@ECHO off\r\nsome-other-launcher.exe %*\r\n";
    fs.writeFileSync(shim, body);
    return shim;
  }

  function useCli(cliPath: string) {
    Object.defineProperty(process, "platform", { value: "win32" });
    vi.spyOn(FusebaseCliManager, "getCliPath").mockReturnValue(cliPath);
    vi.mocked(spawn).mockImplementation(() => fakeChild());
  }

  it("runs an npm .cmd shim's JS entry point with node, without a shell", async () => {
    useCli(writeShim(true));
    const res = await FusebaseCliManager.executeCommand("init", ["--name", "x & calc"]);
    expect(res.success).toBe(true);
    const [command, args, opts] = vi.mocked(spawn).mock.calls[0] as any[];
    expect(command).toBe(process.execPath);
    expect(args[0]).toBe(path.join(tmp, "node_modules", "fusebase", "bin", "cli.js"));
    expect(args.slice(1)).toEqual(["init", "--name", "x & calc"]);
    expect(opts.shell).toBe(false);
  });

  it("refuses cmd.exe metacharacters when a shim has to go through the shell", async () => {
    useCli(writeShim(false));
    const res = await FusebaseCliManager.executeCommand("init", ["--name", "x & calc"]);
    expect(res.success).toBe(false);
    expect(res.stderr).toMatch(/unsafe/);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("quotes plain arguments when a shim has to go through the shell", async () => {
    useCli(writeShim(false));
    await FusebaseCliManager.executeCommand("init", ["--name", "my app"]);
    const [, args, opts] = vi.mocked(spawn).mock.calls[0] as any[];
    expect(opts.shell).toBe(true);
    expect(args).toEqual(["init", "--name", '"my app"']);
  });

  it("refuses a cwd outside the allowed directories", async () => {
    useCli(writeShim(true));
    const res = await FusebaseCliManager.executeCommand("deploy", [], tmp);
    expect(res.success).toBe(false);
    expect(res.stderr).toMatch(/outside the allowed directories/);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("accepts a cwd listed in FUSEBASE_CLI_ALLOWED_DIRS", async () => {
    useCli(writeShim(true));
    process.env.FUSEBASE_CLI_ALLOWED_DIRS = tmp;
    try {
      const res = await FusebaseCliManager.executeCommand("deploy", [], path.join(tmp, "node_modules"));
      expect(res.success).toBe(true);
    } finally {
      delete process.env.FUSEBASE_CLI_ALLOWED_DIRS;
    }
  });
});
