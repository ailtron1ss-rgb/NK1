import assert from 'node:assert/strict';
import { RealityLearningGate } from '../src/organism/system/RealityLearningGate.ts';
import { ExternalPostconditionVerifier, isTrustedEmbodiedOutcomeVerification } from '../src/organism/system/ExternalPostconditionVerifier.ts';
import { createTrustedEmbodiedActionFixture } from './helpers/trusted-embodied-action-fixture.mjs';

const gate=new RealityLearningGate();
const verifier=new ExternalPostconditionVerifier();
const sim=gate.decide({source:'simulation',evidence01:.18,verified01:0,independent01:0,consequence01:.18,predictionError01:.8,surprise01:.8,reward01:.9,success01:1,actuation:false,resource01:.8});

const observation=await createTrustedEmbodiedActionFixture('explore');
const observationVerification=await verifier.assess(observation);
assert.equal(isTrustedEmbodiedOutcomeVerification(observationVerification,observation),true);
const externalStrong=gate.decide({source:'external',evidence01:.96,verified01:1,independent01:1,consequence01:.9,predictionError01:.8,surprise01:.8,reward01:.9,success01:1,actuation:false,resource01:.8,embodiedAction:observation,postconditionVerification:observationVerification});

const receipt=await createTrustedEmbodiedActionFixture('respond');
const receiptVerification=await verifier.assess(receipt);
assert.equal(isTrustedEmbodiedOutcomeVerification(receiptVerification,receipt),false);
const externalWeak=gate.decide({source:'external',evidence01:.44,verified01:0,independent01:0,consequence01:.08,predictionError01:.8,surprise01:.8,reward01:.9,success01:1,actuation:true,resource01:.8,embodiedAction:receipt,postconditionVerification:receiptVerification});

assert.equal(externalWeak.learningScale01,0,'receipt-only external outcomes must not enter replay/policy learning');
assert.equal(externalWeak.memoryPromotionScale01,0);
assert.equal(externalWeak.identityUpdateScale01,0);
assert.ok(externalWeak.learningScale01 < sim.learningScale01,'simulation may update its predictive substrate, but receipt-only external data may not update long-lived learning');
assert.ok(sim.learningScale01 < externalStrong.learningScale01,'a verified external postcondition should have the strongest learning path');
assert.ok(externalStrong.identityUpdateScale01 > .5);
console.log(JSON.stringify({ok:true,sim,externalWeak,externalStrong,diagnostics:gate.diagnostics()}));
