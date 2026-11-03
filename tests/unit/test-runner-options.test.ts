import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it.each([
  [['--offlien'], 'Unknown test-runner option'],
  [['--offline', '--live-only'], 'Choose either'],
])('rejects unsafe test-runner options before loading credentials or running stages: %j', (args, message) => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/test-all.ts', ...args], {
    encoding: 'utf8', timeout: 10_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(message);
  expect(result.stdout).not.toMatch(/\[\d+\/\d+\]|1Password|Authenticated/);
});
