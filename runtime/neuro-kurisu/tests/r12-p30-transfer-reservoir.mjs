import assert from 'node:assert/strict';
import { P30ContinualIntelligenceEngine } from '../src/organism/learning/P30ContinualIntelligence.ts';

const engine = new P30ContinualIntelligenceEngine();
const baseState = {
  needs:{energy:.7,cognitiveLoad:.3,uncertainty:.25,novelty:.55,goalPressure:.4,socialNeed:.5,identityCoherence:.8},
  predictionError:.2,attentionBudget:.7,selfPredictionError:.15,
};
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
for(let i=0;i<150;i++){
  const task=`task-${i}`;
  const action=actions[i%actions.length];
  engine.recordTransferOutcome(task,action,baseState,(i%11)/10);
}
const before=engine.snapshot();
assert.equal(before.transferReservoirStreamCount,150);
assert.ok(before.transferExemplars.length<=96);
const caps=Object.values(before.transferReservoirGroups).map((x)=>x.capacity);
assert.ok(caps.length>=96);
assert.ok(Math.max(...caps)-Math.min(...caps)<=1);
const restored=new P30ContinualIntelligenceEngine();
restored.restore(before);
const after=restored.snapshot();
assert.equal(after.transferReservoirStreamCount,before.transferReservoirStreamCount);
assert.equal(after.transferExemplars.length,before.transferExemplars.length);
assert.deepEqual(after.transferReservoirGroups,before.transferReservoirGroups);
for(let i=0;i<40;i++) restored.recordTransferOutcome(`task-${i}`,actions[i%actions.length],baseState,.4+(i%5)*.05);
const continued=restored.snapshot();
assert.equal(continued.transferReservoirStreamCount>=after.transferReservoirStreamCount,true);
assert.ok(continued.transferExemplars.length<=96);
assert.ok(Object.keys(continued.transferReservoirGroups).length<=96);
console.log(`R12_P30_RESERVOIR=PASS stream=${after.transferReservoirStreamCount} exemplars=${after.transferExemplars.length} groups=${caps.length}`);
