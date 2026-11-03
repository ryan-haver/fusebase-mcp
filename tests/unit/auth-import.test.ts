import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('authentication helper import', () => {
  it('does not run the CLI, load credentials, or print cookies when imported', () => {
    const result = spawnSync(process.execPath, [
      '--import', 'tsx', '--input-type=module', '-e',
      "await import('./scripts/auth.ts'); console.log('import-only');",
    ], { encoding: 'utf8', timeout: 10_000 });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('import-only');
    expect(result.stderr).toBe('');
  });
});
