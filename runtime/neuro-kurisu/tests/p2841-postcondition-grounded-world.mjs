import assert from 'node:assert/strict';
import { ExternalPostconditionVerifier } from '../src/organism/system/ExternalPostconditionVerifier.ts';
import { RealityGroundingController } from '../src/organism/system/RealityGroundingController.ts';
import { isTrustedEmbodiedActionResult } from '../src/organism/body/EmbodiedActionExecutor.ts';
import { GroundedWorldState } from '../src/organism/world/GroundedWorldState.ts';
import { createTrustedEmbodiedActionFixture } from './helpers/trusted-embodied-action-fixture.mjs';

const verifier=new ExternalPostconditionVerifier();
const strong=await createTrustedEmbodiedActionFixture('explore');
const weak=await createTrustedEmbodiedActionFixture('respond');
assert.equal(isTrustedEmbodiedActionResult(strong),true);
assert.equal(Object.isFrozen(strong),true);
assert.equal(Object.isFrozen(strong.consequenceVerification),true);

const a=verifier.assess(strong);
const b=verifier.assess(weak);
assert.equal(a.proofClass,'independent-observation');
assert.equal(a.verified01,1);
assert.equal(a.independent01,1);
assert.ok(a.evidence01>b.evidence01);
assert.equal(b.proofClass,'stable-device-receipt');
assert.equal(b.verified01,0);
assert.equal(b.independent01,0,
  'a command receipt cannot be upgraded to independent observation merely because the executor sampled again');

// The executor can observe a newer sample while the pre-action sample is stale.
// This is a genuine executor-minted result, but it is not a verified observation.
const stale=await createTrustedEmbodiedActionFixture('explore',{staleFirstSample:true});
assert.equal(isTrustedEmbodiedActionResult(stale),true);
assert.equal(stale.consequenceVerification.independent,true);
assert.equal(stale.consequenceVerification.verified,false);
assert.equal(stale.realityClass,'derived');
assert.equal(verifier.assess(stale).proofClass,'none',
  'fresh-after alone cannot replace a fresh pre-action observation');

// Copies and JSON-like caller objects lose the in-process receipt capability.
const copied=structuredClone(strong);
assert.equal(isTrustedEmbodiedActionResult(copied),false);
assert.equal(verifier.assess(copied).reason,'untrusted-embodied-action-result');
const forgedController=new RealityGroundingController();
forgedController.setMode('external-first');
const forged=forgedController.resolve({
  tick:1,action:'explore',expectedReward01:.72,predictionConfidence01:.8,
  simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,
  embodiedAction:copied,postcondition:verifier.assess(copied),novelty01:.3,resource01:.9,
});
assert.equal(forged.source,'simulation');
assert.equal(forgedController.snapshot().externalPrimary,0,
  'a copied receipt must not enter the external-primary lane');

const copiedAssessment=structuredClone(a);
const copiedAssessmentController=new RealityGroundingController();
copiedAssessmentController.setMode('external-first');
const copiedAssessmentResult=copiedAssessmentController.resolve({
  tick:2,action:'explore',expectedReward01:.72,predictionConfidence01:.8,
  simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,
  embodiedAction:strong,postcondition:copiedAssessment,novelty01:.3,resource01:.9,
});
assert.equal(copiedAssessmentResult.source,'simulation',
  'a serialized postcondition assessment must not retain its trust capability');

const otherObservation=await createTrustedEmbodiedActionFixture('explore');
const crossRunController=new RealityGroundingController();
crossRunController.setMode('external-first');
const crossRunResult=crossRunController.resolve({
  tick:3,action:'explore',expectedReward01:.72,predictionConfidence01:.8,
  simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,
  embodiedAction:otherObservation,postcondition:a,novelty01:.3,resource01:.9,
});
assert.equal(crossRunResult.source,'simulation',
  'a verified assessment must not authorize a different executor receipt');

const actionMismatchController=new RealityGroundingController();
actionMismatchController.setMode('external-first');
const actionMismatch=actionMismatchController.resolve({
  tick:4,action:'respond',expectedReward01:.72,predictionConfidence01:.8,
  simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,
  embodiedAction:strong,postcondition:a,novelty01:.3,resource01:.9,
});
assert.equal(actionMismatch.source,'simulation',
  'an observation receipt cannot be rebound to a different selected action');

// Readiness requires six actual, executor-minted external observations.
const holdout=new RealityGroundingController();
let early=0;
let lateRow=null;
for(let tick=1;tick<=6;tick++){
  const observation=tick===1?strong:await createTrustedEmbodiedActionFixture('explore');
  lateRow=holdout.resolve({
    tick,action:'explore',expectedReward01:.72,predictionConfidence01:.8,
    simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,
    novelty01:.3,resource01:.9,embodiedAction:observation,postcondition:verifier.assess(observation),
  });
  if(tick===1) early=holdout.causalHoldoutReadiness('explore','external',6);
}
const ready=holdout.causalHoldoutReadiness('explore','external',6);
assert.ok(early>.1 && early<.3);
assert.ok(ready>.9 && ready>early);
assert.equal(lateRow?.source,'external');

const world=new GroundedWorldState();
const before=world.snapshot();
const row=world.integrateExternalOutcome({
  at:strong.at,action:'explore',status:'executed',proofClass:a.proofClass,
  verified01:a.verified01,independent01:a.independent01,evidence01:a.evidence01,
  consequence01:a.consequence01,claim:a.reason,provenanceId:`outcome:1:${strong.at}`,divergence01:.42,
});
const after=world.snapshot();
assert.equal(row.verified01,1);
assert.equal(after.revision,before.revision+1);
assert.ok(after.facts.some(x=>x.startsWith('external-observed:explore')));
assert.ok(after.events.some(x=>x.id===row.eventId));
console.log(JSON.stringify({ok:true,strong:a,weak:b,stale:verifier.assess(stale),holdout:{early,ready},world:{revision:after.revision,lastHash:after.lastHash,facts:after.facts.slice(-2)}}));
