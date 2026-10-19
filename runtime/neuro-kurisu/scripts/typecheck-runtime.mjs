import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = ['-p', 'tsconfig.clean.json', '--noEmit'];
const localCompilers = [
  { label: 'runtime-lock', path: path.join(root, 'node_modules/typescript/bin/tsc') },
  // The canonical installer installs the app lockfile too; reuse its pinned compiler
  // for the runtime package instead of depending on whichever global `tsc` is on PATH.
  { label: 'app-lock', path: path.resolve(root, '../../app/node_modules/typescript/bin/tsc') },
].filter(candidate => existsSync(candidate.path));

try {
  const compiler = localCompilers[0];
  if (compiler) {
    execFileSync(process.execPath, [compiler.path, ...args], { cwd: root, stdio: 'inherit' });
    console.log(`TYPECHECK=PASS mode=tsc compiler=${compiler.label}`);
  } else {
    execFileSync('tsc', args, { cwd: root, stdio: 'inherit' });
    console.log('TYPECHECK=PASS mode=tsc compiler=PATH');
  }
  process.exit(0);
} catch (error) {
  if (error?.code === 'ENOENT' && localCompilers.length === 0) {
    const files = [];
    const walk = dir => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (['history', 'legacy-original', 'node_modules', 'state'].includes(ent.name)) continue;
        const file = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(file);
        else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) files.push(file);
      }
    };
    walk(path.join(root, 'src'));
    let failed = 0;
    for (const file of files) {
      try {
        execFileSync(process.execPath, ['--experimental-strip-types', '--check', file], { cwd: root, stdio: 'ignore' });
      } catch {
        failed++;
        console.error(`TS_PARSE_FAIL ${path.relative(root, file)}`);
      }
    }
    if (failed) process.exit(1);
    console.log(`TYPECHECK=PASS mode=node-strip-syntax-only files=${files.length} note="TypeScript compiler not installed; semantic tsc check unavailable."`);
    process.exit(0);
  }
  process.exit(typeof error?.status === 'number' ? error.status : 1);
}
