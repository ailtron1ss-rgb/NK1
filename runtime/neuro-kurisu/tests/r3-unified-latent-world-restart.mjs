import assert from 'node:assert/strict';
import { WorldSubsystemRuntime } from '../src/organism/core/WorldSubsystemRuntime.ts';

const context=(tick,uncertainty=.2)=>({tick,location:'restart-lab',energy:.74,attention:.68,uncertainty,facts:['persistent-fact'],objects:[{id:'o1',label:'instrument',location:'restart-lab',value:.8,visible:true,collected:false,evidenceKind:'observed',sourceId:`sensor-${tick}`}],events:['restart-check']});
const organismState={version:1,tick:1,at:1000,needs:{energy:.74,cognitiveLoad:.2,uncertainty:.24,socialNeed:.1,novelty:.3,identityCoherence:.7,goalPressure:.4},predictionError:.2,attentionBudget:.8,lastAction:'wait',lastActionSuccess:null,autonomyScore:.5,selfPredictionError:.2,predictedNextAction:'verify',lastPredictionConfidence:.7,worldContextVersion:1};

const a=new WorldSubsystemRuntime();
a.observeGroundedContext(context(1));
const predicted=a.predictForDecision('verify',.63,.24,organismState);
assert.ok(predicted.predictionId);
const snap=a.snapshot();
const canon=snap.unifiedLatentWorldState;
assert.ok(canon.currentLatent?.id);
assert.equal(canon.predictions.length,1);
assert.equal(canon.predictions[0].resolved,false);

const b=new WorldSubsystemRuntime();
b.restoreFromPersisted({advanced:snap,cognition:{p27:snap.p27,brainSubstrate:snap.brainSubstrate},learning:{p44PredictiveWorld:snap.p44PredictiveWorld},consciousness:{activeInference:snap.activeInference},persisted:{worldModel:snap.world}});
const restored=b.unifiedLatentWorldState.snapshot();
assert.equal(restored.currentLatent.id,canon.currentLatent.id);
assert.deepEqual(restored.currentLatent.vector,canon.currentLatent.vector);
assert.equal(restored.predictions[0].id,canon.predictions[0].id);
assert.equal(restored.predictions[0].resolved,false);
const outcome=b.observeActionOutcome({action:'verify',before:context(1),after:context(2,.16),reward:.82,surprise:.08,at:2000},undefined,predicted.predictionId);
assert.equal(outcome.canonicalResolution.resolved,true);
assert.equal(b.unifiedLatentWorldState.diagnostics().openPredictions,0);
assert.equal(b.unifiedLatentWorldState.snapshot().currentLatent.tick,2);
console.log('R3_UNIFIED_LATENT_RESTART_PASS');
console.log(JSON.stringify({latentId:restored.currentLatent.id,predictionId:restored.predictions[0].id,resolvedAfterRestoreOutcome:true,observationsAfterOutcome:b.unifiedLatentWorldState.snapshot().observations}));
