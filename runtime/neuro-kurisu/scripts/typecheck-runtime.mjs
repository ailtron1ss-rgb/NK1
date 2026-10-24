import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
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
    let unsupported = 0;
    for (const file of files) {
      try {
        // Node explicitly does not support TypeScript in --check. Parse the
        // source through the module API instead; this strips erasable types but
        // never evaluates the file or its imports.
        stripTypeScriptTypes(readFileSync(file, 'utf8'), { mode: 'strip', sourceUrl: file });
      } catch (error) {
        const relative = path.relative(root, file);
        if (error?.code === 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX') {
          // Some valid TS constructs need code generation rather than stripping.
          // That limits this diagnostic fallback; it does not prove the source is invalid.
          unsupported++;
          console.error(`TS_PARSE_UNSUPPORTED ${relative}: ${String(error.message ?? error).slice(0, 240)}`);
        } else {
          failed++;
          console.error(`TS_PARSE_FAIL ${relative}: ${String(error?.message ?? error).slice(0, 240)}`);
        }
      }
    }
    if (failed) process.exit(1);
    console.log(`TYPECHECK=PARTIAL mode=node-strip-types files=${files.length} unsupported=${unsupported} note="TypeScript compiler unavailable; no semantic typecheck performed."`);
    // A syntax-only fallback can never report semantic typecheck success.
    process.exit(2);
  }
  process.exit(typeof error?.status === 'number' ? error.status : 1);
}
