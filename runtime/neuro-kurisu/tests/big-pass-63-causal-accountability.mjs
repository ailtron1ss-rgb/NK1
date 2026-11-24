import assert from 'node:assert/strict';
import { CausalAccountabilityGraph } from '../src/organism/system/CausalAccountabilityGraph.ts';
import { OutcomeVerificationService } from '../src/organism/system/OutcomeVerificationService.ts';

const graph=new CausalAccountabilityGraph();
const goal=graph.add('goal',1,'goal:test');
const decision=graph.add('decision',1,'decision:test');
const prediction=graph.add('prediction',1,'prediction:test',{expected:.8},.82);
const chain=graph.recordActionChain({tick:1,tool:'test.external',ok:true,verified:true,observationId:'obs-63',confidence01:.91,expectedPostcondition:'value=2',observedPostcondition:'value=2',externalObservation:true,goalId:goal,decisionId:decision,predictionId:prediction});
assert.ok(chain.actionId&&chain.outcomeId);
const snap=graph.snapshot();
assert.ok(snap.nodes.some(n=>n.kind==='verification'));
assert.ok(snap.edges.some(e=>e.relation==='verified-by'));
const restored=new CausalAccountabilityGraph(); restored.restore(snap); assert.equal(restored.summary().verificationNodes,1);

const verifier=new OutcomeVerificationService();
const good=await verifier.verify({toolId:'x',input:{},result:{ok:true}},()=>({verified:true,basis:'external-postcondition',confidence01:.9,externalObservation:true,observationId:'obs-63',expectedPostcondition:'x=1',observedPostcondition:'x=1'}));
assert.equal(good.verified,true);
const bad=await verifier.verify({toolId:'x',input:{},result:{ok:true}},()=>({verified:true,basis:'external-postcondition',confidence01:.9,externalObservation:true}));
assert.equal(bad.verified,false);
console.log('BIG_PASS_63_CAUSAL_ACCOUNTABILITY=PASS nodes='+snap.nodes.length+' edges='+snap.edges.length+' verifications='+restored.summary().verificationNodes);
