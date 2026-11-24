import assert from 'node:assert/strict';
import { B272EndogenousGoalGenesis } from '../src/organism/cognition/B272EndogenousGoalGenesis.ts';

const makeBase=()=>({selfLatent:new Array(16).fill(.15),worldLatent:new Array(32).fill(.2),traits:{curiosity:.82,'truth-seeking':.74,'self-reflection':.79,'self-preservation':.76,care:.55,'social-attunement':.42,persistence:.86},needs:{energy01:.72,uncertainty01:.30,novelty01:.52,goalPressure01:.58,socialNeed01:.35},predictionError01:.25,autobiographicalContinuity01:.82,identityContinuity01:.88,intrinsicReward01:.76,lastAction:null,lastReward01:.5});
const engine=new B272EndogenousGoalGenesis();
const base=makeBase();
let exemplar=null;
for(let tick=1;tick<=10;tick++){
  const r=engine.step({...base,tick});
  if(!exemplar) exemplar=r.vector.slice();
  engine.learnFromOutcome({tick,action:r.action,reward01:.92,predictionError01:.08,externalEvidence01:0,independentEvaluatorGain01:.18,acceptedExternalGoal:true});
}
const d=engine.diagnostics();
assert.ok(Object.keys(d.goalOutcomeMemory).length>=1,'goal outcome memory must record endogenous goal outcomes');
assert.ok(d.learnedGoalClosure01>.30,'learned goal closure should become non-trivial');
const learnedBias=engine.learnedGoalBias(exemplar,11);
assert.ok(learnedBias>0,'positive goal experience must create positive learned goal bias');
const restored=new B272EndogenousGoalGenesis();
restored.restore(engine.snapshot());
assert.deepEqual(restored.snapshot().goalOutcomeMemory,engine.snapshot().goalOutcomeMemory,'learned goal memory must survive restore');
const restoredBias=restored.learnedGoalBias(exemplar,11);
assert.ok(restoredBias>0,'restored learned goal memory must still bias the same goal family');
const next=restored.step({...base,tick:11});
assert.ok(next.predictedFutureValue01>=0&&next.predictedFutureValue01<=1);
console.log(`B338_ENDOGENOUS_GOAL_PLASTICITY=PASS memory=${d.goalOutcomeMemoryEntries} closure=${d.learnedGoalClosure01.toFixed(3)} learnedBias=${learnedBias.toFixed(4)} next=${next.predictedFutureValue01.toFixed(3)}`);
