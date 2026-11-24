import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';

const dir = await mkdtemp(path.join(os.tmpdir(), 'nk-plan-cli-'));
try {
  const manifestPath = path.join(dir, 'manifest.json');
  const outputPath = path.join(dir, 'nested', 'plan.json');
  const manifest = [{
    taskId: 'cli-task', family: 'memory', split: 'holdout',
    promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('CLI plan fixture'),
    verifierId: 'independent-v1', version: '1',
  }];
  await writeFile(manifestPath, JSON.stringify(manifest), 'utf8');
  const cli = path.resolve('scripts/create-learning-experiment-plan.mjs');
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types', cli,
    '--manifest', manifestPath, '--out', outputPath,
    '--seeds', '2,1', '--reset-every', '1,3',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PLAN_CREATED/);
  const plan = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.equal(plan.counts.runs, 8);
  assert.deepEqual(plan.seedIds, [1, 2]);
  assert.equal(plan.split, 'holdout');

  const research = spawnSync(process.execPath, [
    '--experimental-strip-types', cli,
    '--manifest', manifestPath, '--out', outputPath,
    '--seeds', '1,2,3,4,5', '--reset-every', '1,3', '--research-grade',
  ], { encoding: 'utf8' });
  assert.equal(research.status, 0, research.stderr);
  assert.match(research.stdout, /"researchGrade":true/);
  const researchPlan = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.equal(researchPlan.counts.runs, 20);

  const underpowered = spawnSync(process.execPath, [
    '--experimental-strip-types', cli,
    '--manifest', manifestPath, '--out', outputPath,
    '--seeds', '1,2,3', '--research-grade',
  ], { encoding: 'utf8' });
  assert.notEqual(underpowered.status, 0);
  assert.match(underpowered.stderr, /at least five paired seeds/);

  const bad = spawnSync(process.execPath, [
    '--experimental-strip-types', cli,
    '--manifest', manifestPath, '--out', outputPath, '--seeds', '1,1',
  ], { encoding: 'utf8' });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /distinct non-negative/);
} finally {
  await rm(dir, { recursive: true, force: true });
}
console.log('P23_LEARNING_EXPERIMENT_PLAN_CLI=PASS');
