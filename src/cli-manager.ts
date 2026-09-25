/**
 * FuseBase Developer CLI Integration Manager.
 * Handles detection, installation guidance, and execution of the official FuseBase CLI (`fusebase`).
 */

import { execSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export interface CliStatus {
  installed: boolean;
  cliPath?: string;
  version?: string;
  authenticated?: boolean;
  organizations?: Array<{ id: string; title: string; role?: string }>;
  installCommand: string;
  notes?: string;
}

export class FusebaseCliManager {
  private static cachedPath: string | null = null;

  /**
   * Resolve the path to the fusebase CLI executable.
   */
  static getCliPath(): string | null {
    if (this.cachedPath && existsSync(this.cachedPath)) {
      return this.cachedPath;
    }

    const isWindows = process.platform === "win32";

    // 1. Check known explicit paths
    if (isWindows) {
      const progFiles = process.env.ProgramFiles || "C:\\Program Files";
      const localAppData = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
      const candidates = [
        join(progFiles, "FuseBase CLI", "fusebase.exe"),
        join(progFiles, "FuseBase", "fusebase.exe"),
        join(localAppData, "Programs", "FuseBase CLI", "fusebase.exe"),
        join(localAppData, "FuseBase CLI", "fusebase.exe"),
      ];
      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          this.cachedPath = candidate;
          return candidate;
        }
      }
    } else {
      const home = homedir();
      const candidates = [
        join(home, ".local", "bin", "fusebase"),
        "/usr/local/bin/fusebase",
        "/opt/homebrew/bin/fusebase",
      ];
      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          this.cachedPath = candidate;
          return candidate;
        }
      }
    }

    // 2. Check system PATH
    try {
      const checkCmd = isWindows ? "where.exe fusebase" : "which fusebase";
      const output = execSync(checkCmd, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      const firstLine = output.split(/\r?\n/)[0];
      if (firstLine && existsSync(firstLine)) {
        this.cachedPath = firstLine;
        return firstLine;
      }
    } catch {
      // Not on PATH
    }

    return null;
  }

  /**
   * Get installation instructions for the current platform.
   */
  static getInstallCommand(): string {
    if (process.platform === "win32") {
      return "irm https://thefusebase.com/fusebase-cli/install-fusebase.ps1 | iex";
    }
    return "curl -sSL https://thefusebase.com/fusebase-cli/install-fusebase.sh | FUSEBASE_AGENT=1 sh";
  }

  /**
   * Check full CLI status: installation, version, and auth state.
   */
  static async getStatus(): Promise<CliStatus> {
    const cliPath = this.getCliPath();
    const installCommand = this.getInstallCommand();

    if (!cliPath) {
      return {
        installed: false,
        installCommand,
        notes: "FuseBase CLI is not currently installed or not found on PATH. Run the install command to install.",
      };
    }

    let version = "unknown";
    try {
      const verOut = execSync(`"${cliPath}" version`, {
        encoding: "utf-8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      version = verOut || "installed";
    } catch {
      version = "installed";
    }

    let authenticated = false;
    let organizations: Array<{ id: string; title: string; role?: string }> | undefined;

    try {
      const orgOut = execSync(`"${cliPath}" orgs list --json`, {
        encoding: "utf-8",
        timeout: 8000,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (orgOut) {
        const parsed = JSON.parse(orgOut);
        if (Array.isArray(parsed)) {
          authenticated = true;
          organizations = parsed;
        }
      }
    } catch {
      authenticated = false;
    }

    return {
      installed: true,
      cliPath,
      version,
      authenticated,
      organizations,
      installCommand,
      notes: authenticated
        ? `CLI is ready. Authenticated with ${organizations?.length ?? 0} organization(s).`
        : "CLI is installed but not authenticated. Run `fusebase auth` to log in.",
    };
  }

  /**
   * Directories a tool-supplied `cwd` may point into: the server's working directory
   * (unless it is a filesystem root), the project's apps/ folder, and any directories in
   * FUSEBASE_CLI_ALLOWED_DIRS (separated by the platform path delimiter).
   */
  static allowedWorkingDirs(): string[] {
    const roots = [resolve(PROJECT_ROOT, "apps")];
    const cwd = resolve(process.cwd());
    if (parse(cwd).root !== cwd) roots.push(cwd);
    for (const dir of (process.env.FUSEBASE_CLI_ALLOWED_DIRS || "").split(delimiter)) {
      if (dir.trim()) roots.push(resolve(dir.trim()));
    }
    return roots;
  }

  /** Resolve a tool-supplied working directory, or throw if it is outside the allow-list. */
  static resolveWorkingDir(cwd?: string): string {
    if (!cwd) return process.cwd();
    const target = resolve(cwd);
    const allowed = this.allowedWorkingDirs();
    const inside = (root: string) => {
      const rel = relative(root, target);
      return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
    };
    if (!allowed.some(inside)) {
      throw new Error(`cwd ${JSON.stringify(cwd)} is outside the allowed directories (${allowed.join(", ")}). Add it to FUSEBASE_CLI_ALLOWED_DIRS to allow it.`);
    }
    return target;
  }

  /**
   * Decide how to launch the CLI without letting arguments reach a shell.
   * Windows can only run .cmd/.bat files through cmd.exe, so for an npm shim we run the
   * underlying JavaScript entry point with node directly. If that can't be found, the
   * shell is used only when no argument contains a cmd.exe metacharacter.
   */
  static resolveInvocation(cliPath: string, args: string[]): { command: string; args: string[]; shell: boolean } {
    const isBatch = process.platform === "win32" && /\.(cmd|bat)$/i.test(cliPath);
    if (!isBatch) return { command: cliPath, args, shell: false };

    try {
      const shim = readFileSync(cliPath, "utf-8");
      const entry = /"%(?:~?dp0)%\\([^"]+\.(?:c|m)?js)"/i.exec(shim)?.[1];
      if (entry) {
        const script = join(dirname(cliPath), ...entry.split(/[\\/]/));
        if (existsSync(script)) return { command: process.execPath, args: [script, ...args], shell: false };
      }
    } catch {
      // Unreadable shim: fall through to the guarded shell path.
    }

    const unsafe = args.find((a) => /[&|<>^%!"`\r\n]/.test(a));
    if (unsafe !== undefined) {
      throw new Error(`Argument ${JSON.stringify(unsafe)} contains characters that are unsafe to pass through cmd.exe.`);
    }
    return { command: cliPath, args: args.map((a) => (/\s/.test(a) ? `"${a}"` : a)), shell: true };
  }

  /**
   * Execute a CLI command safely.
   */
  static async executeCommand(
    subcommand: string,
    args: string[] = [],
    cwd?: string,
    timeoutMs: number = 30000,
  ): Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number | null }> {
    const cliPath = this.getCliPath();
    if (!cliPath) {
      return {
        success: false,
        stdout: "",
        stderr: `FuseBase CLI not found. Install via: ${this.getInstallCommand()}`,
        exitCode: -1,
      };
    }

    let invocation: { command: string; args: string[]; shell: boolean };
    let workingDir: string;
    try {
      workingDir = this.resolveWorkingDir(cwd);
      invocation = this.resolveInvocation(cliPath, [subcommand, ...args]);
    } catch (err) {
      return { success: false, stdout: "", stderr: err instanceof Error ? err.message : String(err), exitCode: -4 };
    }

    type Result = { success: boolean; stdout: string; stderr: string; exitCode: number | null };
    return new Promise<Result>((resolve) => {
      const child = spawn(invocation.command, invocation.args, {
        cwd: workingDir,
        shell: invocation.shell,
        env: { ...process.env, FUSEBASE_AGENT: "1" },
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const onStdout = (data: Buffer | string) => { stdout += data.toString(); };
      const onStderr = (data: Buffer | string) => { stderr += data.toString(); };

      /** Resolve exactly once, then detach every listener this call added. */
      const finish = (result: Result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.stdout?.off("data", onStdout);
        child.stderr?.off("data", onStderr);
        child.off("close", onClose);
        child.off("error", onError);
        // Keep swallowing late errors (e.g. from killing it) so they can't crash the server.
        child.on("error", () => {});
        resolve(result);
      };

      const onClose = (code: number | null) => {
        finish({ success: code === 0, stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code });
      };
      const onError = (err: Error) => {
        finish({ success: false, stdout, stderr: err.message, exitCode: -3 });
      };

      const timer = setTimeout(() => {
        this.killProcessTree(child);
        finish({
          success: false,
          stdout,
          stderr: stderr + `\nCommand timed out after ${timeoutMs}ms.`,
          exitCode: -2,
        });
      }, timeoutMs);

      child.stdout?.on("data", onStdout);
      child.stderr?.on("data", onStderr);
      child.on("close", onClose);
      child.on("error", onError);
    });
  }

  /**
   * Kill a CLI process and everything it started. On Windows `child.kill()` only ends the
   * process we spawned (cmd.exe for a shim, or the fusebase.exe launcher), leaving the real
   * CLI running, so the whole tree is ended with taskkill (run directly, never via a shell).
   */
  static killProcessTree(child: ChildProcess): void {
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
    if (process.platform !== "win32") {
      child.kill();
      return;
    }
    const taskkill = join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe");
    try {
      const killer = spawn(taskkill, ["/pid", String(child.pid), "/T", "/F"], { shell: false, stdio: "ignore", windowsHide: true });
      killer.on("error", () => child.kill());
    } catch {
      child.kill();
    }
  }

  /**
   * Add a sidecar container to an app.
   */
  static async addSidecar(
    appPath: string,
    name: string,
    image: string,
    options?: {
      port?: number;
      tier?: "small" | "medium" | "large";
      env?: Record<string, string>;
      secrets?: string[];
      cwd?: string;
    },
  ) {
    const args = ["add", "--app", appPath, "--name", name, "--image", image];
    if (options?.port) args.push("--port", String(options.port));
    if (options?.tier) args.push("--tier", options.tier);
    if (options?.env) {
      for (const [k, v] of Object.entries(options.env)) {
        args.push("--env", `${k}=${v}`);
      }
    }
    if (options?.secrets) {
      for (const sec of options.secrets) {
        args.push("--secret", sec);
      }
    }
    return this.executeCommand("sidecar", args, options?.cwd);
  }

  /**
   * Remove a sidecar container from an app.
   */
  static async removeSidecar(appPath: string, name: string, cwd?: string) {
    return this.executeCommand("sidecar", ["remove", "--app", appPath, "--name", name], cwd);
  }

  /**
   * List configured sidecar containers for an app.
   */
  static async listSidecars(appPath: string, cwd?: string) {
    return this.executeCommand("sidecar", ["list", "--app", appPath], cwd);
  }

  /**
   * Register an application secret on the FuseBase platform.
   */
  static async createSecret(appPath: string, key: string, description?: string, cwd?: string) {
    const secretVal = description ? `${key}:${description}` : key;
    return this.executeCommand("secret", ["create", "--app", appPath, "--secret", secretVal], cwd);
  }

  /**
   * List registered application secrets.
   */
  static async listSecrets(appPath: string, cwd?: string) {
    return this.executeCommand("secret", ["list", "--app", appPath], cwd);
  }

  /**
   * Retrieve logs for a deployed app. The CLI has no `logs` command; it has
   * `remote-logs runtime <featureId> [--tail N]` and `remote-logs build <featureId>`.
   * Local dev-server output is only printed by `fusebase dev start`, so "dev" can't be fetched.
   */
  static async getLogs(
    appId?: string,
    options?: { lines?: number; type?: "remote" | "build" | "dev"; cwd?: string },
  ): Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number | null }> {
    const type = options?.type ?? "remote";
    if (type === "dev") {
      return {
        success: false,
        stdout: "",
        stderr: "The FuseBase CLI has no command to fetch local dev logs; they are printed by `fusebase dev start` in the terminal running it. Use type \"remote\" (runtime) or \"build\" for a deployed app.",
        exitCode: -5,
      };
    }
    if (!appId) {
      return { success: false, stdout: "", stderr: "An app ID is required to fetch remote logs.", exitCode: -5 };
    }
    if (type === "build") return this.executeCommand("remote-logs", ["build", appId], options?.cwd, 15000);

    const args = ["runtime", appId];
    if (options?.lines) args.push("--tail", String(Math.min(1000, Math.max(1, Math.floor(options.lines)))));
    return this.executeCommand("remote-logs", args, options?.cwd, 15000);
  }

  /**
   * Update app configuration, including permissions and build commands.
   */
  static async updateApp(
    appIdOrPath: string,
    options?: {
      permissions?: string;
      devCommand?: string;
      buildCommand?: string;
      outputDir?: string;
      cwd?: string;
    },
  ) {
    const args = ["update", appIdOrPath];
    if (options?.permissions) args.push("--permissions", options.permissions);
    if (options?.devCommand) args.push("--dev-command", options.devCommand);
    if (options?.buildCommand) args.push("--build-command", options.buildCommand);
    if (options?.outputDir) args.push("--output-dir", options.outputDir);
    return this.executeCommand("app", args, options?.cwd);
  }
}

