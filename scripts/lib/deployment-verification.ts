export interface ReleaseManifest { commit: string; sourceHash: string; buildId: string; evidenceRunId: string | null }
export async function verifyRelease(url: string, expected: ReleaseManifest, options: { attempts?: number; delayMs?: number; timeoutMs?: number; fetcher?: typeof fetch } = {}): Promise<void> {
  const fetcher = options.fetcher ?? fetch;
  let reason = "No response";
  for (let attempt = 0; attempt < (options.attempts ?? 12); attempt++) {
    try {
      const response = await fetcher(new URL(`release.json?build=${encodeURIComponent(expected.buildId)}&attempt=${attempt}`, url), { signal: AbortSignal.timeout(options.timeoutMs ?? 10000), cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json() as ReleaseManifest;
      if (["commit", "sourceHash", "buildId", "evidenceRunId"].some(key => manifest[key as keyof ReleaseManifest] !== expected[key as keyof ReleaseManifest])) throw new Error("Live release identity does not match this build");
      return;
    } catch (error) { reason = error instanceof Error ? error.message : "Invalid release response"; }
    if (attempt + 1 < (options.attempts ?? 12)) await new Promise(resolve => setTimeout(resolve, options.delayMs ?? 5000));
  }
  throw new Error(`Deployment could not be verified: ${reason}`);
}
