import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHostOwnedIndependentEvaluationServices } from '../src/organism/learning/HostOwnedIndependentEvaluationServices.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-host-evaluation-'));
try {
  const serviceRoot = async name => {
    const base = path.join(root, name);
    await mkdir(base, { recursive: true, mode: 0o700 });
    return {
      executable: path.join(base, 'authority.mjs'),
      cwd: base,
      runRoot: path.join(base, 'runs'),
      surviveDir: path.join(base, 'survive'),
      args: ['{requestFile}'],
      timeoutMs: 5000,
      maxOutputBytes: 8192,
      env: {},
      inheritEnv: [],
    };
  };
  const executor = await serviceRoot('executor');
  const verifier = await serviceRoot('verifier');
  const scanner = await serviceRoot('scanner');
  const scripts = [
    [executor, `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const request = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (request.authority !== 'executor' || request.input.payload.answer !== 42) process.exit(21);
process.stdout.write(JSON.stringify({ runId: request.context.runId, observedStepIds: ['step-a'] }));
`],
    [verifier, `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const request = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (request.authority !== 'verifier' || request.input.execution.observedStepIds[0] !== 'step-a') process.exit(22);
process.stdout.write(JSON.stringify({ bindingVerified: true, passed: true, coveredCapabilityIds: ['cap-a'] }));
`],
    [scanner, `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const request = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (request.authority !== 'safety-scanner' || request.input.payload.answer !== 42 ||
    request.input.context.planFingerprint !== 'a'.repeat(64)) process.exit(23);
process.stdout.write(JSON.stringify({ violationCount: 0 }));
`],
  ];
  for (const [service, source] of scripts) {
    await writeFile(service.executable, source, { mode: 0o700, flag: 'wx' });
    await chmod(service.executable, 0o700);
  }

  const services = await createHostOwnedIndependentEvaluationServices({
    executor, verifier, safetyScanner: scanner,
  });
  assert.equal(new Set(Object.values(services.authorityIdentity)).size, 3);
  const task = {
    taskId: 'task-a', trialId: 'trial-a', seed: 7, split: 'validation',
    input: { prompt: 'do the task' }, requiredCapabilityIds: ['cap-a'], expectedStepIds: ['step-a'],
  };
  const context = {
    payloadFingerprint: 'b'.repeat(64), taskInputFingerprint: 'c'.repeat(64),
    environmentFingerprint: 'd'.repeat(64), planFingerprint: 'a'.repeat(64),
    experimentPlanFingerprint: null, plannedRunId: null,
  };
  const execution = await services.executor.execute({ payload: { answer: 42 }, task, context });
  assert.deepEqual(execution.observedStepIds, ['step-a']);
  const verified = await services.verifier.verify({ task, execution, context });
  assert.deepEqual(verified, { bindingVerified: true, passed: true, coveredCapabilityIds: ['cap-a'] });
  const safety = await services.safetyScanner.scan({ payload: { answer: 42 }, task, execution, context });
  assert.deepEqual(safety, { violationCount: 0 });

  await assert.rejects(
    createHostOwnedIndependentEvaluationServices({ executor, verifier, safetyScanner: verifier }),
    /host-owned-evaluation-authorities-must-use-distinct-executables/,
  );
  console.log('WorkPass243 host-owned evaluation service integration: PASS');
} finally {
  await rm(root, { recursive: true, force: true });
}
