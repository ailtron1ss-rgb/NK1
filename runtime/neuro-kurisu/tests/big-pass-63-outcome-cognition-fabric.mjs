import assert from 'node:assert/strict';
import { OutcomeCognitionFabric } from '../src/organism/system/OutcomeCognitionFabric.ts';

const f=new OutcomeCognitionFabric();
const v={verified:true,basis:'external-postcondition',confidence01:.93,externalObservation:true,observationId:'obs-fabric-1',expectedPostcondition:'door=open',observedPostcondition:'door=open'};
const a=f.project({tick:7,tool:'door.open',ok:true,verification:v,reason:'goal:test',inputKeys:['room'],predictedAction:'verify',predictionConfidence01:.71});
assert.equal(a.verifiedExternal,true);
assert.ok(a.causal.nodes.some(n=>n.kind==='prediction'));
assert.ok(a.causal.nodes.some(n=>n.kind==='verification'));
assert.equal(a.causal.nodes.some(n=>n.kind==='learning'), false, 'a tool verifier without source identity may verify this receipt but cannot assign learning credit');
const s=f.snapshot(); const g=new OutcomeCognitionFabric(); g.restore(s); assert.equal(g.summary().records,1); assert.equal(g.summary().causal.verificationNodes,1);
const weak=f.project({tick:8,tool:'door.inspect',ok:true,verification:{verified:false,basis:'none',confidence01:0,externalObservation:false},reason:'inspect'});
assert.equal(weak.verifiedExternal,false); assert.equal(f.summary().causal.predictionErrors,0, 'unknown outcome without evidence must not be counted as a prediction error');

// Defense in depth: even a caller that bypasses OutcomeVerificationService cannot
// turn a tool-contract ACK into an external learning signal.
const malformed=f.project({tick:9,tool:'door.write',ok:true,executionId:'exec-forged-external',verification:{verified:true,basis:'tool-contract',confidence01:1,externalObservation:true,observationId:'self-asserted-ack'}});
assert.equal(malformed.verifiedExternal,false);
assert.equal(malformed.verificationRecord.verified,false);
assert.equal(malformed.verificationRecord.externalObservation,false);
assert.equal(malformed.causal.nodes.some(n=>n.kind==='learning' && String(n.label||'').includes('verified-external-outcome:door.write')),false);

const missingIdentity=f.project({tick:10,tool:'door.write',ok:true,executionId:'exec-missing-observation-id',verification:{verified:true,basis:'external-postcondition',confidence01:1,externalObservation:true}});
assert.equal(missingIdentity.verifiedExternal,false);
assert.equal(missingIdentity.verificationRecord.verified,false);
// An external observer with a stable independent source key and high-confidence
// matching postcondition may assign positive evidence-linked learning.
const learner=new OutcomeCognitionFabric();
learner.project({tick:11,tool:'door.open',ok:true,executionId:'exec-learning-with-source',verification:{verified:false,basis:'none',confidence01:0,externalObservation:false}});
const observed=learner.resolveExternalObservation({tick:12,tool:'door.open',executionId:'exec-learning-with-source',observationId:'external-door-observed',verified:true,confidence01:.91,assessment:'match',sourceId:'door-sensor-a',sourceClass:'device',independenceKey:'door-sensor-bus-a',expectedPostcondition:'door=open',observedPostcondition:'door=open'});
assert.equal(observed.resolved,true);
assert.ok(observed.causal.nodes.some(n=>n.kind==='learning'&&n.data?.observationId==='external-door-observed'&&n.data?.evidenceThresholdMet===true));
console.log('BIG_PASS_63_OUTCOME_COGNITION_FABRIC=PASS records='+f.summary().records+' nodes='+f.summary().causal.nodes+' edges='+f.summary().causal.edges+' external-evidence-contract=fail-closed learning=provenance-gated');
