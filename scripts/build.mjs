import { existsSync, lstatSync, realpathSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const output = join(root, 'dist');
if (existsSync(output)) {
  if (lstatSync(output).isSymbolicLink() || realpathSync(output) !== output) throw new Error('Refusing to clean a redirected dist directory');
  rmSync(output, { recursive: true });
}
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc')], { cwd: root, stdio: 'inherit' });
