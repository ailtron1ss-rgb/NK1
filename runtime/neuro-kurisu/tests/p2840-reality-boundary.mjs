import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { WorldEnvironment } from '../src/organism/world/WorldEnvironment.ts';
import { RealityLearningGate } from '../src/organism/system/RealityLearningGate.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'neuro-p2840-'));
const stateFile = path.join(tmp, 'organism.json');

// 1) Pure shadow simulation must not mutate canonical world state.
const world = new WorldEnvironment();
const before = world.snapshot();
const shadow = world.simulate('move');
assert.equal(world.snapshot().tick, before.tick, 'simulate() must not advance canonical world tick');
assert.notDeepEqual(shadow.after, before, 'shadow transition must describe a real predicted change');
world.commit(shadow);
assert.equal(world.snapshot().tick, before.tick + 1, 'commit() must apply the shadow transition exactly once');
const afterCommit = world.snapshot();
world.commit(shadow);
assert.deepEqual(world.snapshot(), afterCommit, 'commit() must be idempotent for the same transition');

// 2) Verified external outcome must suppress cross-reality identity/world promotion.
const gate = new RealityLearningGate();
const verified = gate.decide({source:'external',evidence01:.96,verified01:1,independent01:1,consequence01:.8,predictionError01:.7,surprise01:.8,reward01:.95,success01:1,actuation:false,resource01:.8});
const receiptOnly = gate.decide({source:'external',evidence01:.46,verified01:0,independent01:1,consequence01:.12,predictionError01:.7,surprise01:.8,reward01:.95,success01:1,actuation:true,resource01:.8});
assert(verified.learningScale01 > receiptOnly.learningScale01, 'verified evidence must learn more strongly than receipt-only evidence');
assert(verified.identityUpdateScale01 > receiptOnly.identityUpdateScale01, 'verified evidence must promote identity more strongly');
assert(receiptOnly.identityUpdateScale01 < .4, 'unverified actuation must strongly attenuate identity promotion');

// 3) Integrated runtime: an external outcome must NOT advance the predictive shadow world.
const runtime = new OrganismRuntime({stateFile,enableLanguage:false,autoRun:false,realityMode:'external-first',performanceProfile:'mobile'});
await runtime.init();
const originalExecute = runtime.embodiedActions.execute.bind(runtime.embodiedActions);
runtime.embodiedActions.execute = async () => ({
  version:1, action:'respond', status:'executed', realityClass:'device-actuation', source:'android-termux', at:Date.now(),
  before:{battery01:.8,thermal01:.2,cognitiveCapacity01:.8,awake:true,source:'android-termux'},
  after:{battery01:.799,thermal01:.201,cognitiveCapacity01:.8,awake:true,source:'android-termux'},
  stateDelta:{battery01:-.001,thermal01:.001,cognitiveCapacity01:0,awakeChanged:false}, effect01:.02, reason:'p2840-test-external-action', capability:'android.tts',
  consequenceVerification:{attempted:true,independent:true,verified:true,sourceStable:true,freshBefore01:1,freshAfter01:1,changed01:.62,reason:'test-independent-receipt',verificationMode:'independent-observation'}
});
const tickBeforeExternal = runtime.environment.snapshot().tick;
const externalStep = await runtime.autonomousStep();
const tickAfterExternal = runtime.environment.snapshot().tick;
assert.equal(tickAfterExternal, tickBeforeExternal, 'external-primary cycle must not commit shadow world state');
assert((runtime.realityShadowBridgeSnapshot()?.externalHolds ?? 0) >= 1, 'external shadow hold must be recorded');
assert((runtime.realityLearningGateSnapshot()?.externalDecisions ?? 0) >= 1, 'external learning gate decision must persist');
const perceptual = runtime.core.perceptualEvidenceSummary();
assert(perceptual.evidence.some(x => String(x.claim).startsWith('external-outcome:respond')), 'external outcome must return to next-cycle perceptual evidence');
assert(externalStep.embodiedAction?.status === 'executed');

// Restore the real executor and verify simulation fallback still advances canonical world.
runtime.embodiedActions.execute = originalExecute;
const simulationBefore = runtime.environment.snapshot().tick;
await runtime.autonomousStep();
const simulationAfter = runtime.environment.snapshot().tick;
assert.equal(simulationAfter, simulationBefore + 1, 'simulation fallback must commit the predictive shadow transition');

await runtime.core.flush();
const persisted = JSON.parse(await fs.readFile(stateFile, 'utf8'));
assert(persisted.system.realityLearningGate, 'learning gate must persist');
assert(persisted.system.realityShadowBridge, 'shadow bridge must persist');
console.log(JSON.stringify({
  ok:true,
  externalWorldTickStable:tickAfterExternal===tickBeforeExternal,
  simulationCommitted:simulationAfter===simulationBefore+1,
  learningScaleVerified:verified.learningScale01,
  learningScaleReceiptOnly:receiptOnly.learningScale01,
  identityScaleVerified:verified.identityUpdateScale01,
  identityScaleReceiptOnly:receiptOnly.identityUpdateScale01,
  realityShadow:runtime.realityShadowBridgeSnapshot(),
  learningGate:runtime.realityLearningGateSnapshot(),
}));
