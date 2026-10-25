import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = ['-p', 'tsconfig.clean.json', '--noEmit'];
const localCompilers = [
  // The app lockfile is the canonical source for both TypeScript and @types/node.
  // Prefer it over any stale runtime-local compiler to keep semantic checks reproducible.
  { label: 'app-lock', path: path.resolve(root, '../../app/node_modules/typescript/bin/tsc') },
  { label: 'runtime-lock', path: path.join(root, 'node_modules/typescript/bin/tsc') },
].filter(candidate => existsSync(candidate.path));

const compiler = localCompilers[0];
if (!compiler) {
  console.error('TYPECHECK=BLOCKED reason=pinned-compiler-not-installed');
  console.error('Install the canonical locked toolchain with: npm ci --prefix ../../app');
  process.exit(2);
}

try {
  execFileSync(process.execPath, [compiler.path, ...args], { cwd: root, stdio: 'inherit' });
  console.log(`TYPECHECK=PASS mode=tsc compiler=${compiler.label}`);
  process.exit(0);
} catch (error) {
  if (error?.code === 'ENOENT') {
    console.error(`TYPECHECK=BLOCKED reason=pinned-compiler-unavailable compiler=${compiler.label}`);
  }
  process.exit(typeof error?.status === 'number' ? error.status : 1);
}
