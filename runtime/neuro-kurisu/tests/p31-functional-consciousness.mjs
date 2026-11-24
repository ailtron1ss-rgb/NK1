import assert from 'node:assert/strict';
import { P31FunctionalConsciousnessEngine, defaultP31Consciousness } from '../src/organism/cognition/P31FunctionalConsciousness.ts';

const p=new P31FunctionalConsciousnessEngine();
p.restore(defaultP31Consciousness());
const first=p.integrate({
  tick:1, observationId:'obs-1', externalInput:true, selectedAction:'respond', selectedConfidence:.82,
  workspaceCapacity:5, workspaceItems:[
    {id:'ext-1',source:'external',salience:.94,content:{action:'respond',text:'hello'}},
    {id:'goal-1',source:'goal',salience:.72,content:{action:'verify'}},
    {id:'body-1',source:'body',salience:.31,content:{action:'rest'}},
  ], identityContinuity01:.88, metacognitiveAccuracy01:.76, decisionUncertainty01:.28, predictionError01:.18,
  body:{energy:.78,cognitiveLoad:.23,uncertainty:.28,novelty:.51,identityCoherence:.88},
});
assert.equal(first.evidence.status,'functional-only');
assert.ok(first.globalWorkspace.coalitionIds.length===3);
assert.ok(first.globalWorkspace.ignition01>0);
const masked=p.preview({capacity:2,selectedAction:'respond',externalInput:true,items:[{id:'hi',source:'external',salience:.9,content:{action:'respond'}},{id:'mid',source:'goal',salience:.7,content:{action:'verify'}},{id:'low',source:'body',salience:.01,content:{action:'rest'}}]});
assert.equal(masked.focus?.id,'hi');
assert.equal((masked.focus?.id==='low'),false);
assert.equal(masked.accessBiasByAction['respond'] !== undefined,true);
assert.ok(first.higherOrder.sampleCount===1);
assert.ok(first.introspection.groundedIds.includes('obs-1'));
const second=p.integrate({
  tick:2, observationId:'obs-2', externalInput:false, selectedAction:'verify', selectedConfidence:.74,
  workspaceCapacity:5, workspaceItems:[
    {id:'goal-1',source:'goal',salience:.92,content:{action:'verify'}},
    {id:'ext-1',source:'external',salience:.41,content:{action:'respond'}},
  ], identityContinuity01:.87, metacognitiveAccuracy01:.78, decisionUncertainty01:.22, predictionError01:.21,
  body:{energy:.74,cognitiveLoad:.34,uncertainty:.22,novelty:.64,identityCoherence:.87},
});
assert.notEqual(second.presentMomentId,first.presentMomentId);
assert.equal(second.temporal.previousMomentId,first.presentMomentId);
assert.ok(second.globalWorkspace.recurrence01>0);
p.observeOutcome({action:'verify',success01:.9,reward01:.86,surprise01:.12,predictedSameAction:true,externallyRequested:false});
const after=p.snapshot();
assert.ok(after.selfPerspective.ownership01>0.45);
assert.ok(after.affect.relief01>0.2);
const lesion=p.lesion('workspace');
assert.ok(lesion.after<lesion.before);
console.log('P31_FUNCTIONAL_CONSCIOUSNESS=PASS',JSON.stringify({ignition:Number(first.globalWorkspace.ignition01.toFixed(3)),continuity:Number(after.temporal.continuity01.toFixed(3)),ownership:Number(after.selfPerspective.ownership01.toFixed(3)),lesionDelta:Number(lesion.delta.toFixed(3))}));
