import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

// WorkPass333: verify that endogenous intention survives the real runtime route,
// not only direct unit calls to OrganismCore. No user prompt or external tool is supplied.
const directory = await mkdtemp(join(tmpdir(), 'nk1-inner-imperative-'));
const runtime = new OrganismRuntime({
  stateFile: join(directory, 'organism.json'),
  performanceProfile: 'mobile',
  enableLanguage: false,
  autoRun: false,
});

try {
  await runtime.init();
  const result = await runtime.runAutonomousCycles(8);

  assert.equal(result.cycles, 8, 'runtime must complete the requested bounded cycles');
  assert.equal(result.externalCommands, 0, 'autonomous cycle must not fabricate external commands');
  assert.ok(result.worldTicks > 0, 'autonomous cycles must advance the world model');

  const endogenous = runtime.core.b272EndogenousGoalDiagnostics();
  const lifecycle = runtime.core.b273AutonomousGoalDiagnostics();
  assert.ok(endogenous.generatedGoals > 0, 'B272 must generate endogenous goals through runtime');
  assert.ok(endogenous.learningUpdates > 0, 'B272 must learn from runtime outcomes');
  assert.ok(lifecycle.cycles > 0, 'B273 lifecycle must run through runtime');
  assert.ok(lifecycle.goalCreations > 0, 'B273 must create lifecycle goals through runtime');

  const stateBeforeRestart = runtime.core.snapshot();
  assert.ok(stateBeforeRestart, 'runtime core must expose a persistable state snapshot');

  console.log(JSON.stringify({
    pass: true,
    workpass: 333,
    cycles: result.cycles,
    externalCommands: result.externalCommands,
    worldTicks: result.worldTicks,
    endogenous,
    lifecycle,
  }, null, 2));
} finally {
  await runtime.stop().catch(() => {});
  await rm(directory, { recursive: true, force: true });
}
