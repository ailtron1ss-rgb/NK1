import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const dir = await mkdtemp(path.join(tmpdir(), 'nk-p2862-persist-'));
const stateFile = path.join(dir, 'state.json');
const worldStateFile = path.join(dir, 'world.json');
const opts = {
  stateFile,
  worldStateFile,
  enableLanguage: false,
  autoRun: false,
  intervalMs: 100000,
  checkpointMinIntervalMs: 0,
  checkpointMaxDirtyCycles: 1,
  performanceProfile: 'mobile',
};

try {
  const first = new OrganismRuntime(opts);
  await first.init();
  for (let i = 0; i < 12; i += 1) {
    await first.step(i % 3 === 0 ? 'observe the current environment and verify the consequence' : undefined);
  }
  const before = first.core.b2525LearnedLatentTransitionFieldDiagnostics();
  assert.ok(before.writes > 0, `expected learned transition writes, got ${before.writes}`);
  assert.ok(before.prototypes.length > 0, `expected learned transition prototypes, got ${before.prototypes.length}`);
  await first.stop();

  const second = new OrganismRuntime(opts);
  await second.init();
  const after = second.core.b2525LearnedLatentTransitionFieldDiagnostics();
  assert.ok(after.writes >= before.writes, `writes were not restored: before=${before.writes} after=${after.writes}`);
  assert.ok(after.prototypes.length >= before.prototypes.length, `prototypes were not restored: before=${before.prototypes.length} after=${after.prototypes.length}`);
  await second.stop();

  console.log(`P2862_PERSISTENCE=PASS writes=${before.writes}->${after.writes} prototypes=${before.prototypes.length}->${after.prototypes.length}`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
