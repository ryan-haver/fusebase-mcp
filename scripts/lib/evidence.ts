import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
export interface SourceIdentity { commit: string; sourceHash: string; dirty: boolean }
const generated = new Set(["apps/client-portal-dashboard/apps/status-dashboard/src/data/project-status.json", "apps/client-portal-dashboard/apps/status-dashboard/public/release.json"]);
export function sourceIdentity(root: string): SourceIdentity {
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  const files = git("ls-files", "-z", "--cached", "--others", "--exclude-standard").split("\0").filter(file => file && !generated.has(file));
  const hash = createHash("sha256");
  for (const file of [...new Set(files)].sort()) {
    hash.update(file + "\0");
    const absolute = join(root, file);
    hash.update(existsSync(absolute) ? readFileSync(absolute) : "[deleted]");
    hash.update("\0");
  }
  const dirty = git("status", "--porcelain", "--untracked-files=normal").split(/\r?\n/).some(line => line && !generated.has(line.slice(3).replace(/\\/g, "/")));
  return { commit: git("rev-parse", "HEAD").trim(), sourceHash: hash.digest("hex"), dirty };
}

export interface EvidenceRun {
  schemaVersion: 2; runId: string; source: SourceIdentity; selectedStages: string[];
  startedAt: string; finishedAt?: string; complete: boolean; sourceChanged?: boolean;
  runtime: string; stages: Record<string, RecordedStage>;
}
export interface RecordedStage {
  kind: "offline" | "live"; order: number; passed: boolean; secs: number; runAt: string; commit: string;
  assertions?: { passed: number; total: number }; skipped?: number; knownGaps?: number; tools?: number;
}
export function evidenceState(run: Partial<EvidenceRun> | undefined, source: SourceIdentity): "current" | "working-tree" | "stale" | "incomplete" | "missing" {
  if (!run) return "missing";
  if (run.schemaVersion !== 2 || run.source?.sourceHash !== source.sourceHash || run.source?.commit !== source.commit || run.sourceChanged) return "stale";
  if (!run.complete || !run.selectedStages?.length || run.selectedStages.some(name => !run.stages?.[name])) return "incomplete";
  if (run.selectedStages.some(name => run.stages?.[name]?.commit !== run.source?.commit)) return "stale";
  return source.dirty || run.source?.dirty ? "working-tree" : "current";
}
