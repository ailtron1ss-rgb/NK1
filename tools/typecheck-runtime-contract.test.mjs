import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const sourcePath = path.join(repoRoot, 'runtime/neuro-kurisu/scripts/typecheck-runtime.mjs');
const typecheckSource = readFileSync(sourcePath, 'utf8');
const temp = mkdtempSync(path.join(os.tmpdir(), 'nk1-typecheck-contract-'));

function runTypecheck(runtimeRoot, extraEnv = {}) {
  return spawnSync(process.execPath, [path.join(runtimeRoot, 'scripts/typecheck-runtime.mjs')], {
    cwd: runtimeRoot,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
  });
}

function fakeCompiler(file, label) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `console.log('FAKE_COMPILER=${label}');\nif (process.env.FAIL_PINNED_COMPILER === '1') process.exit(7);\n`);
}

try {
  const repo = path.join(temp, 'repo');
  const runtimeRoot = path.join(repo, 'runtime', 'neuro-kurisu');
  const scriptPath = path.join(runtimeRoot, 'scripts', 'typecheck-runtime.mjs');
  mkdirSync(path.dirname(scriptPath), { recursive: true });
  mkdirSync(path.join(runtimeRoot, 'src'), { recursive: true });
  writeFileSync(scriptPath, typecheckSource);

  // A missing locked compiler must be BLOCKED, even when the host could have
  // an unrelated global tsc or Node can parse individual TypeScript files.
  const missing = runTypecheck(runtimeRoot);
  assert.equal(missing.status, 2, missing.stderr);
  assert.match(missing.stderr, /TYPECHECK=BLOCKED reason=pinned-compiler-not-installed/);
  assert.doesNotMatch(missing.stdout + missing.stderr, /TYPECHECK=PASS/);

  const appCompiler = path.join(repo, 'app', 'node_modules', 'typescript', 'bin', 'tsc');
  const runtimeCompiler = path.join(runtimeRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  fakeCompiler(appCompiler, 'app-lock');
  fakeCompiler(runtimeCompiler, 'runtime-lock');

  const selected = runTypecheck(runtimeRoot);
  assert.equal(selected.status, 0, selected.stderr);
  assert.match(selected.stdout, /FAKE_COMPILER=app-lock/);
  assert.match(selected.stdout, /TYPECHECK=PASS mode=tsc compiler=app-lock/);
  assert.doesNotMatch(selected.stdout, /FAKE_COMPILER=runtime-lock/,
    'runtime must prefer the canonical app-lock TypeScript compiler');

  // Compiler diagnostics must propagate as failure, never as a PASS marker.
  const failedPinned = runTypecheck(runtimeRoot, { FAIL_PINNED_COMPILER: '1' });
  assert.equal(failedPinned.status, 7);
  assert.doesNotMatch(failedPinned.stdout + failedPinned.stderr, /TYPECHECK=PASS/);

  // The runtime-local compiler is a usable fallback only when the canonical
  // app-lock compiler is absent; no ambient PATH lookup is permitted.
  rmSync(path.join(repo, 'app'), { recursive: true, force: true });
  const runtimeFallback = runTypecheck(runtimeRoot);
  assert.equal(runtimeFallback.status, 0, runtimeFallback.stderr);
  assert.match(runtimeFallback.stdout, /FAKE_COMPILER=runtime-lock/);
  assert.match(runtimeFallback.stdout, /TYPECHECK=PASS mode=tsc compiler=runtime-lock/);

  assert.doesNotMatch(typecheckSource, /execFileSync\(['"]tsc['"]/,
    'global tsc must not be used as an unlocked semantic checker');
  assert.doesNotMatch(typecheckSource, /node-strip-syntax-only/,
    'syntax parsing cannot be reported as semantic TypeScript typechecking');
  assert.match(typecheckSource, /TYPECHECK=BLOCKED reason=pinned-compiler-not-installed/);
  console.log('Runtime TypeScript compiler dependency contract: PASS');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
