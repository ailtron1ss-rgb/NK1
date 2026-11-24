import assert from 'node:assert/strict';
import { P31FunctionalConsciousnessEngine, defaultP31Consciousness } from '../src/organism/cognition/P31FunctionalConsciousness.ts';
import { ConsciousnessEvidenceLedger } from '../src/organism/cognition/ConsciousnessEvidenceLedger.ts';
import { MetaCognitiveMonitor } from '../src/organism/cognition/MetaCognitiveMonitor.ts';

const base={tick:1,observationId:'c-1',externalInput:false,selectedAction:'verify',selectedConfidence:.82,workspaceCapacity:5,identityContinuity01:.88,metacognitiveAccuracy01:.86,decisionUncertainty01:.18,predictionError01:.12,body:{energy:.82,cognitiveLoad:.18,uncertainty:.18,novelty:.35,identityCoherence:.9}};
const richItems=[{id:'goal',source:'goal',salience:.96,content:{action:'verify'}},{id:'memory',source:'memory',salience:.84,content:{action:'reflect'}},{id:'body',source:'body',salience:.66,content:{action:'rest'}}];

const p=new P31FunctionalConsciousnessEngine();
p.restore(defaultP31Consciousness());
const a=p.integrate({...base,workspaceItems:richItems});
assert.equal(a.version,3);
assert.equal(a.recentMomentIds.length,1);
assert.ok(a.metrics.functionalIntegration01>0);
assert.ok(a.introspection.groundedIds.includes('c-1'));

const previewA=p.preview({items:richItems,capacity:2,selectedAction:'verify',externalInput:false});
const previewB=p.preview({items:[{id:'low',source:'body',salience:.2,content:{action:'rest'}},{id:'tiny',source:'goal',salience:.1,content:{action:'verify'}}],capacity:2,selectedAction:'verify',externalInput:false});
assert.equal(previewA.focus?.id,'goal');
assert.notEqual(previewA.focus?.id,previewB.focus?.id);
assert.ok((previewA.accessBiasByAction.verify??0) >= (previewB.accessBiasByAction.verify??0));

p.observeOutcome({action:'verify',success01:.92,reward01:.9,surprise01:.08,predictedSameAction:true,externallyRequested:false});
const beforeLesion=p.snapshot();
const lesion=p.lesion('higher-order');
assert.ok(lesion.after<lesion.before);
assert.equal(p.rescueLastLesion(),true);
const rescued=p.snapshot();
assert.equal(rescued.lesionState,null);
assert.deepEqual(rescued.metrics,beforeLesion.metrics);
assert.equal(p.rescueLastLesion(),false);

// Restart with a synthetic 20-minute wall-clock gap: continuity should record the interruption.
const persisted=structuredClone(rescued); persisted.lastWallAt=Date.now()-20*60*1000;
const r=new P31FunctionalConsciousnessEngine(); r.restore(persisted);
const afterGap=r.integrate({...base,tick:2,observationId:'c-2',workspaceItems:richItems});
assert.ok(afterGap.temporal.gapMs>=19*60*1000);
assert.ok(afterGap.temporal.discontinuities>=1);
assert.ok(afterGap.temporal.continuity01 < rescued.temporal.continuity01);
assert.ok(afterGap.temporal.durationMs>=rescued.temporal.durationMs);
assert.equal(r.recentMomentIds().length,2);

// Metacognitive calibration should move in opposite directions for accurate vs badly calibrated confidence.
const accurate=new MetaCognitiveMonitor();
accurate.update({confidence:.9,outcomeSuccess:.9,predictionError:.1,worldUncertainty:.1,identityDrift:.05});
const inaccurate=new MetaCognitiveMonitor();
inaccurate.update({confidence:.9,outcomeSuccess:.1,predictionError:.8,worldUncertainty:.7,identityDrift:.3});
assert.ok(accurate.snapshot().predictionCalibration>inaccurate.snapshot().predictionCalibration);
assert.ok(inaccurate.snapshot().revisionReadiness>accurate.snapshot().revisionReadiness);

// Evidence ledger negative control: replaying identical observation key must not create new support.
const ledger=new ConsciousnessEvidenceLedger();
for(let i=0;i<6;i++) ledger.update({recurrent:.9,workspace:.86,higherOrder:.8,predictive:.84,attention:.82,embodiment:.8,continuity:.9,metacognition:.81,agency:.79,causalMap:{},observationKey:'same',independentEvidence:true});
const same=ledger.snapshot();
assert.equal(same.indicators[0].supportingObservations,1);
for(let i=1;i<25;i++) ledger.update({recurrent:.9,workspace:.86,higherOrder:.8,predictive:.84,attention:.82,embodiment:.8,continuity:.9,metacognition:.81,agency:.79,causalMap:{},observationKey:`ind-${i}`,independentEvidence:true});
const longitudinal=ledger.snapshot();
assert.equal(longitudinal.indicators[0].supportingObservations,25);
assert.ok(longitudinal.aggregateLongitudinalEvidence>same.aggregateLongitudinalEvidence);
for (let i=25;i<28;i++) ledger.update({recurrent:.9,workspace:.86,higherOrder:.8,predictive:.84,attention:.82,embodiment:.8,continuity:.9,metacognition:.81,agency:.79,causalMap:{},observationKey:`ind-${i}`,independentEvidence:true});
ledger.update({recurrent:.9,workspace:.86,higherOrder:.8,predictive:.84,attention:.82,embodiment:.8,continuity:.9,metacognition:.81,agency:.79,causalMap:{},observationKey:'ind-7',independentEvidence:true});
const replayed=ledger.snapshot();
assert.equal(replayed.indicators[0].supportingObservations,28);

console.log('BIG_PASS_179_CONSCIOUSNESS_BATTERY=PASS',JSON.stringify({
  ignition:Number(a.globalWorkspace.ignition01.toFixed(3)),
  integration:Number(a.metrics.functionalIntegration01.toFixed(3)),
  lesionDelta:Number(lesion.delta.toFixed(3)),
  restoredGapMs:afterGap.temporal.gapMs,
  discontinuities:afterGap.temporal.discontinuities,
  recentMoments:r.recentMomentIds().length,
  calibrationAccurate:Number(accurate.snapshot().predictionCalibration.toFixed(3)),
  calibrationInaccurate:Number(inaccurate.snapshot().predictionCalibration.toFixed(3)),
  evidenceSameCount:same.indicators[0].supportingObservations,
  evidenceIndependentCount:longitudinal.indicators[0].supportingObservations,
  evidenceAfterOldReplayCount:replayed.indicators[0].supportingObservations,
}));
