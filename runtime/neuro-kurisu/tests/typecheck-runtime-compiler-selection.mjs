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
} finally {
  await rm(root, { recursive: true, force: true });
}
