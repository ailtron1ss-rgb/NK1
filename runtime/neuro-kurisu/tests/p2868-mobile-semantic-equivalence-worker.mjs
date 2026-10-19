import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

// P2868 compares execution profiles, not host-time or RNG differences.
// Keep logical time/RNG identical so a real semantic drift cannot hide behind
// Date.now()/Math.random() noise from downstream subsystems.
let logicalNow = 1800000000000;
const originalNow = Date.now;
const originalRandom = Math.random;
let randomState = 0x9e3779b9;
Date.now = () => logicalNow;
Math.random = () => {
  randomState = (Math.imul(randomState ^ (randomState >>> 15), 2246822519) + 3266489917) | 0;
  return ((randomState >>> 0) / 4294967296);
};

const { OrganismRuntime } = await import('../src/organism/core/OrganismRuntime.ts');
const dir = await mkdtemp(path.join(tmpdir(), 'nk-p2868-'));
try {
  const r = new OrganismRuntime({
    stateFile: path.join(dir, 'state.json'),
    worldStateFile: path.join(dir, 'world.json'),
    enableLanguage: false,
    autoRun: false,
    checkpointMinIntervalMs: 600000,
    checkpointMaxDirtyCycles: 24,
    performanceProfile: 'mobile',
    cycleResultMode: 'summary'
  });
  await r.init();
  const actions = [];
  for (let i = 0; i < 8; i++) {
    logicalNow += 1000;
    const x = await r.autonomousStep();
    actions.push(x.worldAction);
  }
  const d = r.core.neuralExperienceBranchDiagnostics();
  const s = r.core.operationalStatusSnapshot();
  const b295 = r.core.b295AdaptiveCognitiveBudgetDiagnostics();
  const b2508 = r.core.b2508AdaptiveComputeDiagnostics();
  console.log(JSON.stringify({
    actions,
    tick: s.tick,
    learningUpdates: Number(d.unifiedNeuroCausalCore?.learningUpdates ?? d.learningUpdates ?? 0),
    replayAdaptation01: Number(d.autonomousContinual?.replayAdaptation01 ?? 0),
    grounded01: Number(d.unifiedCausalWorldLoop?.embodiedGrounding01 ?? 0),
    b295Mode: b295.lastMode,
    b295Budget: b295.budget01,
    b2508Mode: b2508.mode,
    b2508Budget: b2508.computeBudget01,
    b2508Horizon: b2508.horizon,
    b2508Skip: b2508.skipFactor
  }));
  await r.stop();
} finally {
  await rm(dir, { recursive: true, force: true });
  Date.now = originalNow;
  Math.random = originalRandom;
}
