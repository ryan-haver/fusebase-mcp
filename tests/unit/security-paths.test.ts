import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return { ...actual, spawn: vi.fn() };
});

import { spawn } from "child_process";
import { EventEmitter } from "events";
import { getGuideContent } from "../../src/guide-loader.js";
import { FusebaseCliManager } from "../../src/cli-manager.js";

describe("getGuideContent (SEC-3)", () => {
  it("reads a real guide", () => {
    expect(getGuideContent("basics", "hint-object")).toBeTruthy();
  });

  // SEC-3: section/slug are joined unsanitised, so ".." escapes docs/guides.
  it.fails("refuses to read files outside docs/guides", () => {
    // docs/guides/../PLAN-content-formats.md → docs/PLAN-content-formats.md
    expect(getGuideContent("..", "PLAN-content-formats")).toBeNull();
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

  // SEC-6: a .cmd shim is spawned with shell: true, so model-supplied args reach cmd.exe.
  it.fails("never spawns the CLI through a shell, even for a .cmd shim", async () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    vi.spyOn(FusebaseCliManager, "getCliPath").mockReturnValue("C:\\npm\\fusebase.cmd");
    vi.mocked(spawn).mockImplementation(() => fakeChild());

    await FusebaseCliManager.executeCommand("init", ["--name", "x & calc"]);

    const opts = vi.mocked(spawn).mock.calls[0][2] as { shell?: boolean };
    expect(opts.shell).toBeFalsy();
  });
});
