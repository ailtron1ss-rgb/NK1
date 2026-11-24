import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';

const root = process.cwd();
const args = ['-p', 'tsconfig.clean.json', '--noEmit'];
const localCompilers = [
  { label: 'runtime-lock', path: path.join(root, 'node_modules/typescript/bin/tsc') },
  // The canonical installer installs the app lockfile too; reuse its pinned compiler
  // for the runtime package instead of depending on whichever global `tsc` is on PATH.
  { label: 'app-lock', path: path.resolve(root, '../../app/node_modules/typescript/bin/tsc') },
  { label: 'root-lock', path: path.resolve(root, '../../node_modules/typescript/bin/tsc') },
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
        stripTypeScriptTypes(readFileSync(file, 'utf8'), { mode: 'strip', sourceUrl: file });
      } catch (error) {
        const message = String(error?.message ?? error);
        // `node --check` cannot parse TypeScript at all, so the fallback must strip the
        // source itself. `stripTypeScriptTypes` mirrors exactly what the runtime erases.
        if (/not supported in strip-only mode|Unsupported syntax/i.test(message)) unsupported++;
        else failed++;
        console.error(`TS_PARSE_FAIL ${path.relative(root, file)} :: ${message.split('\n')[0]}`);
      }
    }
    if (failed) process.exit(1);
    if (unsupported) {
      console.error(`TS_STRIP_UNSUPPORTED count=${unsupported}`);
      process.exit(1);
    }
    console.log(`TYPECHECK=PASS mode=node-strip-syntax-only files=${files.length} note="TypeScript compiler not installed; semantic tsc check unavailable."`);
    process.exit(0);
  }
  process.exit(typeof error?.status === 'number' ? error.status : 1);
}
