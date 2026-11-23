import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';

const root = process.cwd();
// P26 installs runtime/neuro-kurisu/package-lock.json, so prefer that lock's
// Node typings. Only fall back to the app install when the runtime lock lacks them.
const nodeTypeRootCandidates = [
  path.resolve(root, 'node_modules/@types'),
  path.resolve(root, '../../app/node_modules/@types'),
];
const nodeTypeRoots = nodeTypeRootCandidates.find(candidate => existsSync(path.join(candidate, 'node')));
const hasOfficialNodeTypes = Boolean(nodeTypeRoots);
const configFile = hasOfficialNodeTypes ? 'tsconfig.clean.json' : 'tsconfig.shim.json';
const args = ['-p', configFile, '--noEmit'];
if (nodeTypeRoots) args.push('--typeRoots', nodeTypeRoots, '--types', 'node');
console.log(`TYPECHECK_NODE_TYPES=${hasOfficialNodeTypes ? 'official' : 'fallback-shim'}`);
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
    // No TypeScript compiler is installed, so a semantic tsc check is impossible.
    // Node's `--check` never strips types (it parses as plain JS and fails on every
    // annotation), so the previous approach produced false "TS_PARSE_FAIL" results.
    // Use the type-stripping API and surface the parser's real diagnostics instead.
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
    const scratch = mkdtempSync(path.join(tmpdir(), 'nk-typecheck-'));
    let failed = 0;
    for (const file of files) {
      let stripped;
      try {
        stripped = stripTypeScriptTypes(readFileSync(file, 'utf8'), { mode: 'strip', sourceUrl: file });
      } catch (stripError) {
        failed++;
        console.error(`TS_PARSE_FAIL ${path.relative(root, file)} ${String(stripError?.message ?? stripError).split('\n')[0]}`);
        continue;
      }
      const probe = path.join(scratch, `${failed}-${path.basename(file)}.mjs`);
      writeFileSync(probe, stripped);
      try {
        execFileSync(process.execPath, ['--check', probe], { cwd: root, stdio: 'ignore' });
      } catch {
        failed++;
        console.error(`TS_PARSE_FAIL ${path.relative(root, file)}`);
      }
    }
    rmSync(scratch, { recursive: true, force: true });
    if (failed) process.exit(1);
    console.log(`TYPECHECK=PASS mode=node-strip-syntax-only files=${files.length} note="TypeScript compiler not installed; semantic tsc check unavailable."`);
    process.exit(0);
  }
  process.exit(typeof error?.status === 'number' ? error.status : 1);
}
