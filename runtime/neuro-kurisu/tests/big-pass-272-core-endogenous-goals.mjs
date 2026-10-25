import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile'}); await core.init();
for(let i=0;i<96;i++){
  const r=core.b272EndogenousGoalStep({tick:i,selfLatent:Array.from({length:16},(_,j)=>Math.tanh(Math.sin(i*.07+j*.13))),worldLatent:Array.from({length:16},(_,j)=>Math.cos(i*.05+j*.11)),needs:{energy01:.78-(i%15)*.008,uncertainty01:i%19<6?.72:.28,novelty01:.35+(i%9)*.045,goalPressure01:.25+(i%19<6?.24:.04),socialNeed01:i%11===0?.72:.27},traits:{curiosity:.70,caution:.63,'truth-seeking':.74,'self-reflection':.67,'self-preservation':.68,care:.56,'social-attunement':.58,persistence:.72},predictionError01:i%19<6?.62:.16,autobiographicalContinuity01:.74,identityContinuity01:.80,intrinsicReward01:.62,lastAction:null,lastReward01:.5});
  core.b272EndogenousGoalLearn({tick:i,action:r.action,reward01:r.action==='explore'?.72:r.action==='verify'?.68:.59,predictionError01:i%19<6?.42:.17,externalEvidence01:i%17===0?1:0,independentEvaluatorGain01:i%19<6?.04:.02,acceptedExternalGoal:i%5!==0});
}
const d=core.b272EndogenousGoalDiagnostics();
assert.ok(d.learningUpdates>=90,'B272 did not learn in core');
assert.ok(d.generatedGoals>=90,'B272 did not generate goals in core');
assert.ok(d.goalEntropy01>.20,'core goal diversity collapsed');
assert.ok(d.prototypeDiversity01>.04,'core action prototypes did not differentiate');
assert.ok(d.agency01>.20,'core agency remained inert');
const snap=core.snapshot();
const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile'}); await core2.init();
assert.deepEqual(core2.b272EndogenousGoalDiagnostics(),d,'B272 state did not survive Core restart');

const liveCore=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await liveCore.init();
await liveCore.observe({
  text:'',
  novelty:.68,
  surprise:.63,
  embodiment:{bodyEnergy01:.74,cognitiveCapacity01:.84,thermalStrain01:.15,sensoryFreshness01:.91,awake:true,battery01:.75,cpuLoad01:.22,ramPressure01:.22},
},'operational');
const liveSnapshot=liveCore.snapshot();
const liveIntrinsic=liveSnapshot.facets.consciousness.intrinsic;
const liveGoal=liveCore.b272EndogenousGoalDiagnostics();
assert.ok(liveIntrinsic&&Number.isFinite(liveIntrinsic.overall)&&liveIntrinsic.overall>0,'live Core did not calculate an intrinsic drive');
assert.ok(Math.abs(liveGoal.lastIntrinsicDrive01-liveIntrinsic.overall)<1e-9,'live B272 goal genesis did not consume the current-cycle intrinsic drive');
assert.ok(liveGoal.lastIntrinsicDriveConfidence01>0&&liveGoal.lastIntrinsicDriveConfidence01<=1,'live B272 goal genesis did not receive bounded drive-support confidence');
const latestIntentEvidence=liveGoal.goalHistory.at(-1);
assert.ok(latestIntentEvidence,'live B272 goal history is missing the generated intention');
assert.ok(Math.abs(latestIntentEvidence.intrinsicDrive01-liveIntrinsic.overall)<1e-9,'goal history did not retain the drive that generated this intention');
assert.ok(Math.abs(latestIntentEvidence.intrinsicDriveConfidence01-liveGoal.lastIntrinsicDriveConfidence01)<1e-9,'goal history did not retain the drive-support score for this intention');

console.log(JSON.stringify({pass:true,diagnostics:d,restored:core2.b272EndogenousGoalDiagnostics(),liveDrive:{value:liveGoal.lastIntrinsicDrive01,confidence01:liveGoal.lastIntrinsicDriveConfidence01}},null,2));
