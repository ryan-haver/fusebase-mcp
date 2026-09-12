/**
 * FuseBase Developer CLI Integration Manager.
 * Handles detection, installation guidance, and execution of the official FuseBase CLI (`fusebase`).
 */

import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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
   * Execute a CLI command safely.
   */
  static async executeCommand(
    subcommand: string,
    args: string[] = [],
    cwd: string = process.cwd(),
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

    return new Promise((resolve) => {
      const fullArgs = [subcommand, ...args];
      const child = spawn(cliPath, fullArgs, {
        cwd,
        shell: true,
        env: { ...process.env, FUSEBASE_AGENT: "1" },
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          stdout,
          stderr: stderr + `\nCommand timed out after ${timeoutMs}ms.`,
          exitCode: -2,
        });
      }, timeoutMs);

      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code,
        });
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          stdout,
          stderr: err.message,
          exitCode: -3,
        });
      });
    });
  }
}
