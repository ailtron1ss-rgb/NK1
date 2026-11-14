import assert from 'node:assert/strict';
import { RealityLearningGate } from '../src/organism/system/RealityLearningGate.ts';
import { ExternalPostconditionVerifier, isTrustedEmbodiedOutcomeVerification } from '../src/organism/system/ExternalPostconditionVerifier.ts';
import { createTrustedEmbodiedActionFixture } from './helpers/trusted-embodied-action-fixture.mjs';

const gate=new RealityLearningGate();
const verifier=new ExternalPostconditionVerifier();
const sim=gate.decide({source:'simulation',evidence01:.18,verified01:0,independent01:0,consequence01:.18,predictionError01:.8,surprise01:.8,reward01:.9,success01:1,actuation:false,resource01:.8});

const observation=await createTrustedEmbodiedActionFixture('explore');
const observationVerification=await verifier.assess(observation);
assert.equal(observation.realityClass,'device-telemetry');
assert.equal(isTrustedEmbodiedOutcomeVerification(observationVerification,observation),false);
const externalTelemetry=gate.decide({source:'external',evidence01:.96,verified01:1,independent01:1,consequence01:.9,predictionError01:.8,surprise01:.8,reward01:.9,success01:1,actuation:false,resource01:.8,embodiedAction:observation,postconditionVerification:observationVerification});

const receipt=await createTrustedEmbodiedActionFixture('respond');
const receiptVerification=await verifier.assess(receipt);
assert.equal(isTrustedEmbodiedOutcomeVerification(receiptVerification,receipt),false);
const externalReceipt=gate.decide({source:'external',evidence01:.44,verified01:0,independent01:0,consequence01:.08,predictionError01:.8,surprise01:.8,reward01:.9,success01:1,actuation:true,resource01:.8,embodiedAction:receipt,postconditionVerification:receiptVerification});

for (const decision of [externalTelemetry,externalReceipt]) {
  assert.equal(decision.learningScale01,0);
  assert.equal(decision.memoryPromotionScale01,0);
  assert.equal(decision.identityUpdateScale01,0);
  assert.equal(decision.reward01,.5);
  assert.equal(decision.surprise01,0);
}
assert.ok(sim.learningScale01>0,'simulation may still update its bounded predictive substrate');
console.log(JSON.stringify({ok:true,sim,externalTelemetry,externalReceipt,diagnostics:gate.diagnostics()}));
