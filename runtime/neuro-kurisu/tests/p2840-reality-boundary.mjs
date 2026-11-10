import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { WorldEnvironment } from '../src/organism/world/WorldEnvironment.ts';
import { RealityLearningGate } from '../src/organism/system/RealityLearningGate.ts';
import { ExternalPostconditionVerifier, isTrustedEmbodiedOutcomeVerification } from '../src/organism/system/ExternalPostconditionVerifier.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { createTrustedEmbodiedActionFixture } from './helpers/trusted-embodied-action-fixture.mjs';

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
const verifier = new ExternalPostconditionVerifier();
const verifiedAction = await createTrustedEmbodiedActionFixture('explore');
const verifiedPostcondition = await verifier.assess(verifiedAction);
assert.equal(isTrustedEmbodiedOutcomeVerification(verifiedPostcondition,verifiedAction),true);
const verified = gate.decide({source:'external',evidence01:.96,verified01:1,independent01:1,consequence01:.8,predictionError01:.7,surprise01:.8,reward01:.95,success01:1,actuation:false,resource01:.8,embodiedAction:verifiedAction,postconditionVerification:verifiedPostcondition});
const receiptAction = await createTrustedEmbodiedActionFixture('respond');
const receiptPostcondition = await verifier.assess(receiptAction);
assert.equal(isTrustedEmbodiedOutcomeVerification(receiptPostcondition,receiptAction),false);
const receiptOnly = gate.decide({source:'external',evidence01:.46,verified01:0,independent01:0,consequence01:.12,predictionError01:.7,surprise01:.8,reward01:.95,success01:1,actuation:true,resource01:.8,embodiedAction:receiptAction,postconditionVerification:receiptPostcondition});
assert(verified.learningScale01 > receiptOnly.learningScale01, 'only a matching OutcomeVerificationService token may authorize external learning');
assert(verified.identityUpdateScale01 > receiptOnly.identityUpdateScale01, 'verified evidence must promote identity more strongly');
assert.equal(receiptOnly.learningScale01,0, 'receipt-only actions must not enter replay/policy learning');
assert.equal(receiptOnly.memoryPromotionScale01,0);
assert.equal(receiptOnly.identityUpdateScale01,0);
assert.equal(receiptOnly.reward01,.5);
assert.equal(receiptOnly.surprise01,0);

// 3) Integrated runtime: an external outcome must NOT advance the predictive shadow world.
const runtime = new OrganismRuntime({stateFile,enableLanguage:false,autoRun:false,realityMode:'external-first',performanceProfile:'mobile'});
await runtime.init();
const originalExecute = runtime.embodiedActions.execute.bind(runtime.embodiedActions);
runtime.embodiedActions.execute = async (_action,input={}) => createTrustedEmbodiedActionFixture('respond',{decisionId:input.decisionId});

const tickBeforeExternal = runtime.environment.snapshot().tick;
const groundedWorldBefore = runtime.core.groundedWorldSnapshot();
const externalStep = await runtime.autonomousStep();
const tickAfterExternal = runtime.environment.snapshot().tick;
const groundedWorldAfter = runtime.core.groundedWorldSnapshot();
assert.equal(tickAfterExternal, tickBeforeExternal, 'external-primary cycle must not commit shadow world state');
assert((runtime.realityShadowBridgeSnapshot()?.externalHolds ?? 0) >= 1, 'external shadow hold must be recorded');
assert((runtime.realityLearningGateSnapshot()?.externalDecisions ?? 0) >= 1, 'external learning gate decision must persist');
const lastGrounding=runtime.realityGroundingSnapshot()?.last;
assert.equal(lastGrounding?.proofClass,'stable-device-receipt');
assert.equal(lastGrounding?.verified01,0);
assert.equal(lastGrounding?.independent01,0);
const lastLearning=runtime.realityLearningGateSnapshot()?.last;
assert.equal(lastLearning?.learningScale01,0,'unverified device receipt must not update replay/policy learning');
assert.equal(lastLearning?.identityUpdateScale01,0);
assert.deepEqual(groundedWorldAfter.facts,groundedWorldBefore.facts,'a command receipt must not create grounded world facts');
assert.equal(groundedWorldAfter.confidence01,groundedWorldBefore.confidence01,'a command receipt must not increase grounded world confidence');
assert.ok(groundedWorldAfter.events.some(x=>x.label.startsWith('external-receipt:respond:executed:stable-device-receipt')));
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
