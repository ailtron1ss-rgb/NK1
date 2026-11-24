import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const branch = new NeuralExperienceBranch();
const before = branch.diagnostics().autonomousContinual;
branch.applyDreamRehearsalSignal({ robustness01: .86, promoted: true, uncertainty01: .62, resource01: .74 });
const after = branch.diagnostics().autonomousContinual;
assert.ok(after.lastReason.startsWith('dream='), 'dream feedback did not reach continual replay fabric');
assert.ok(after.counterfactualConfidence01 >= before.counterfactualConfidence01, 'dream rehearsal did not update counterfactual confidence');
assert.ok(after.replayBudget01 >= before.replayBudget01 * .95, 'dream rehearsal unexpectedly collapsed replay budget');

const dir = await mkdtemp(path.join(tmpdir(), 'nk-p2862-loop-'));
try {
  const runtime = new OrganismRuntime({
    stateFile: path.join(dir, 'state.json'),
    worldStateFile: path.join(dir, 'world.json'),
    enableLanguage: false,
    autoRun: false,
    checkpointMinIntervalMs: 0,
    checkpointMaxDirtyCycles: 1,
    performanceProfile: 'mobile',
  });
  await runtime.init();
  for (let i = 0; i < 18; i += 1) {
    await runtime.step(i % 4 === 0 ? 'inspect evidence and compare predicted consequence with observation' : undefined);
  }
  const dream = runtime.core.systemSnapshot().dreamCounterfactualLab;
  const neb = runtime.core.neuralExperienceBranchDiagnostics();
  assert.ok((dream?.rehearsals ?? 0) > 0, 'runtime dream rehearsal did not execute');
  assert.ok((neb.autonomousContinual?.outcomes ?? 0) > 0, 'continual replay fabric did not receive outcomes');
  assert.ok(typeof neb.autonomousContinual?.lastReason === 'string' && neb.autonomousContinual.lastReason.length > 0, 'continual replay diagnostics missing');
  await runtime.stop();
  console.log(`P2862_DREAM_REPLAY_IDENTITY=PASS rehearsals=${dream.rehearsals} outcomes=${neb.autonomousContinual.outcomes} replayBudget=${neb.autonomousContinual.replayBudget01.toFixed(3)}`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
