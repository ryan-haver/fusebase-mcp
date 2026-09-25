// Runs after `npm install`: downloads the FuseBase guides used by search_guides / get_guide
// into .cache/guides (they're FuseBase's content, so they aren't committed). Never fails the
// install: offline or on error it prints how to fetch them later.
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const guidesDir = process.env.FUSEBASE_GUIDES_DIR || join(process.cwd(), ".cache", "guides");
const index = join(guidesDir, "index.md");
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

if (process.env.FUSEBASE_SKIP_GUIDES === "1") {
  console.log("[postinstall] FUSEBASE_SKIP_GUIDES=1: not downloading guides.");
} else if (existsSync(index) && Date.now() - statSync(index).mtimeMs < WEEK_MS) {
  console.log("[postinstall] FuseBase guides are up to date (.cache/guides).");
} else {
  console.log("[postinstall] Downloading FuseBase guides into .cache/guides…");
  const res = spawnSync("npx", ["tsx", "scripts/scrape-guides.ts"], { stdio: "inherit", shell: process.platform === "win32", timeout: 10 * 60 * 1000 });
  if (res.status !== 0) {
    console.warn("[postinstall] Couldn't download the guides now; run `npm run guides:fetch` later. The guide tools report this until then.");
  }
}
