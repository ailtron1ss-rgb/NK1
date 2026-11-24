import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTrustedShadowLearningProcess } from '../src/organism/learning/TrustedShadowLearningRunCoordinator.ts';

const root = mkdtempSync(join(tmpdir(), 'nk1-trusted-coordinator-'));
try {
  const run = { runId: 'coordinator-run-1', taskId: 'task-17', seed: 17, taskVersion: 'v1', manifestFingerprint: 'a'.repeat(64), arm: 'candidate', method: 'shadow' };
  const command = { executable: process.execPath, args: ['-e', "process.stdout.write('trusted-coordinator-ok')"], cwd: root, runRoot: join(root, 'runs'), surviveDir: join(root, 'survive') };
  const registrations = [];
  const result = await runTrustedShadowLearningProcess({
    core: { registerTrustedSkillShadowRun(context) { registrations.push(context); } },
    runtimeVersion: '35.90.0',
    run,
    planFingerprint: 'b'.repeat(64),
    command,
  });
  assert.equal(result.receipt.status, 'completed');
  assert.match(result.receipt.stdout, /trusted-coordinator-ok/);
  assert.deepEqual(registrations, [{
    runId: run.runId, taskId: run.taskId, seed: run.seed,
    manifestFingerprint: run.manifestFingerprint, runtimeVersion: '35.90.0',
  }]);
  await assert.rejects(() => runTrustedShadowLearningProcess({
    core: { registerTrustedSkillShadowRun() { throw new Error('registry persistence failed'); } },
    runtimeVersion: '35.90.0',
    run: { ...run, runId: 'must-not-spawn' },
    planFingerprint: 'c'.repeat(64),
    command: { ...command, runRoot: join(root, 'failed-runs'), surviveDir: join(root, 'failed-survive') },
  }), /registry persistence failed/);
  assert.throws(() => runTrustedShadowLearningProcess({
    core: {}, runtimeVersion: '35.90.0', run, planFingerprint: 'b'.repeat(64), command,
  }), /trusted OrganismCore run registrar is required/);
  let rejectedLaneRegistrations = 0;
  assert.throws(() => runTrustedShadowLearningProcess({
    core: { registerTrustedSkillShadowRun() { rejectedLaneRegistrations++; } },
    runtimeVersion: '35.90.0',
    run: { ...run, runId: 'baseline-must-not-register', arm: 'P', method: 'prior' },
    planFingerprint: 'd'.repeat(64),
    command: { ...command, runRoot: join(root, 'baseline-runs'), surviveDir: join(root, 'baseline-survive') },
  }), /only candidate\/shadow runs/);
  assert.equal(rejectedLaneRegistrations, 0, 'baseline/control runs must not enter trusted shadow registry');
  assert.throws(() => runTrustedShadowLearningProcess({
    core: { registerTrustedSkillShadowRun() { rejectedLaneRegistrations++; } },
    runtimeVersion: '35.90.0',
    run: { ...run, runId: 'wrong-method', method: 'continuous' },
    planFingerprint: 'e'.repeat(64),
    command,
  }), /only candidate\/shadow runs/);
  assert.equal(rejectedLaneRegistrations, 0, 'non-shadow methods must not enter trusted shadow registry');
  console.log('P23_TRUSTED_SHADOW_RUN_COORDINATOR=PASS');
} finally {
  rmSync(root, { recursive: true, force: true });
}
