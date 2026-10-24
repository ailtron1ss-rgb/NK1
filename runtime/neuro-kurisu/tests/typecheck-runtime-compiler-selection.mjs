import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const typecheckScript = path.join(runtimeRoot, 'scripts/typecheck-runtime.mjs');

const root = await mkdtemp(path.join(os.tmpdir(), 'nk-typecheck-compiler-'));
try {
  const fixtureRuntime = path.join(root, 'runtime/neuro-kurisu');
  const fixtureAppCompiler = path.join(root, 'app/node_modules/typescript/bin/tsc');
  const log = path.join(root, 'compiler-invocation.json');
  await mkdir(path.join(fixtureRuntime, 'scripts'), { recursive: true });
  await mkdir(path.join(fixtureAppCompiler, '..'), { recursive: true });
  await mkdir(path.join(fixtureRuntime, 'src'), { recursive: true });
  await writeFile(path.join(fixtureRuntime, 'scripts/typecheck-runtime.mjs'), await readFile(typecheckScript));
  await writeFile(path.join(fixtureRuntime, 'tsconfig.clean.json'), JSON.stringify({ compilerOptions: {}, files: [] }));
  await writeFile(fixtureAppCompiler, `const fs = require('node:fs'); fs.writeFileSync(process.env.NK_TSC_SELECTION_LOG, JSON.stringify(process.argv.slice(2))); console.log('FAKE_PINNED_TSC=PASS');\n`);
  await chmod(fixtureAppCompiler, 0o755);
  const result = spawnSync(process.execPath, [path.join(fixtureRuntime, 'scripts/typecheck-runtime.mjs')], {
    cwd: fixtureRuntime,
    encoding: 'utf8',
    env: { ...process.env, NK_TSC_SELECTION_LOG: log },
    timeout: 15000,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /TYPECHECK=PASS mode=tsc compiler=app-lock/);
  assert.deepEqual(JSON.parse(await readFile(log, 'utf8')), ['-p', 'tsconfig.clean.json', '--noEmit']);
  console.log('TYPECHECK_RUNTIME_COMPILER_SELECTION=PASS source=app-lock pinned compiler selected ahead of global PATH');

  // Without any pinned or PATH compiler, syntax parsing must never be reported
  // as a semantic TypeScript pass. Deliberately invalid assignment is valid syntax.
  await rm(fixtureAppCompiler, { force: true });
  const emptyPath = path.join(root, 'empty-path');
  await mkdir(emptyPath, { recursive: true });
  const semanticallyInvalid = path.join(fixtureRuntime, 'src/fallback.ts');
  await writeFile(semanticallyInvalid, 'const value: string = 42;\n');
  const fallback = spawnSync(process.execPath, [path.join(fixtureRuntime, 'scripts/typecheck-runtime.mjs')], {
    cwd: fixtureRuntime,
    encoding: 'utf8',
    env: { ...process.env, PATH: emptyPath },
    timeout: 15000,
  });
  assert.equal(fallback.status, 2, `${fallback.stdout}\n${fallback.stderr}`);
  assert.match(fallback.stdout, /TYPECHECK=PARTIAL mode=node-strip-syntax-only files=1/);
  assert.match(fallback.stdout, /semantic tsc check unavailable/);
  assert.doesNotMatch(fallback.stdout, /TYPECHECK=PASS/);
  console.log('TYPECHECK_RUNTIME_FALLBACK_STATUS=PASS syntax-only fallback is explicitly partial');

  // Syntax errors still fail even in the degraded parser-only mode.
  const syntaxError = path.join(fixtureRuntime, 'src/syntax-error.ts');
  await writeFile(syntaxError, 'export const broken: = 1;\n');
  const syntaxFailure = spawnSync(process.execPath, [path.join(fixtureRuntime, 'scripts/typecheck-runtime.mjs')], {
    cwd: fixtureRuntime,
    encoding: 'utf8',
    env: { ...process.env, PATH: emptyPath },
    timeout: 15000,
  });
  assert.equal(syntaxFailure.status, 1, `${syntaxFailure.stdout}\n${syntaxFailure.stderr}`);
  assert.match(syntaxFailure.stderr, /TS_PARSE_FAIL src[\\/]syntax-error\.ts/);
  await rm(syntaxError, { force: true });

  // A real compiler failure must propagate; it must not silently downgrade to
  // syntax-only success just because TypeScript reports diagnostics.
  const fixtureRuntimeCompiler = path.join(fixtureRuntime, 'node_modules/typescript/bin/tsc');
  await mkdir(path.dirname(fixtureRuntimeCompiler), { recursive: true });
  await writeFile(fixtureRuntimeCompiler, "process.stderr.write('FAKE_TSC_TYPE_ERROR\\n'); process.exit(7);\n");
  const compilerFailure = spawnSync(process.execPath, [path.join(fixtureRuntime, 'scripts/typecheck-runtime.mjs')], {
    cwd: fixtureRuntime,
    encoding: 'utf8',
    env: { ...process.env, PATH: emptyPath },
    timeout: 15000,
  });
  assert.equal(compilerFailure.status, 7, `${compilerFailure.stdout}\n${compilerFailure.stderr}`);
  assert.match(compilerFailure.stderr, /FAKE_TSC_TYPE_ERROR/);
  assert.doesNotMatch(compilerFailure.stdout, /TYPECHECK=PARTIAL|TYPECHECK=PASS/);
  console.log('TYPECHECK_RUNTIME_FAILURE_PROPAGATION=PASS semantic compiler failures remain failures');
} finally {
  await rm(root, { recursive: true, force: true });
}
