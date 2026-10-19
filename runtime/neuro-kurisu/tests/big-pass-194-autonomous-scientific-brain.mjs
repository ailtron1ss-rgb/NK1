import assert from 'node:assert/strict';
import { AutonomousScientificBrainSubstrate } from '../src/organism/learning/AutonomousScientificBrainSubstrate.ts';

const brain=new AutonomousScientificBrainSubstrate();
const target=(x)=>Math.max(0,Math.min(1,.46+.22*x.predictionError01+.13*x.novelty01-.11*x.resourcePressure01+.08*x.activeInformationGain01));
for(let i=0;i<240;i++){
  const input={predictionError01:(i%10)/10,uncertainty01:((i*3)%10)/10,novelty01:((i*7)%10)/10,sensorConflict01:((i*5)%10)/10,selfPredictionError01:((i*2)%10)/10,agencyUncertainty01:((i*9)%10)/10,activeInformationGain01:((i*11)%10)/10,resourcePressure01:((i*13)%10)/10};
  const d=brain.decide(input); const y=target(input);
  brain.learn({predictedDelta01:d.predictedDelta01,observedDelta01:y,replicated:true,evidence01:.9,at:i,holdout:false});
}
for(let i=0;i<24;i++){
  const input={predictionError01:((i+1)%10)/10,uncertainty01:((i*5+2)%10)/10,novelty01:((i*7+1)%10)/10,sensorConflict01:((i*3+4)%10)/10,selfPredictionError01:((i*2+3)%10)/10,agencyUncertainty01:((i*9+1)%10)/10,activeInformationGain01:((i*11+2)%10)/10,resourcePressure01:((i*13+4)%10)/10};
  const d=brain.decide(input); const y=target(input);
  brain.learn({predictedDelta01:d.predictedDelta01,observedDelta01:y,replicated:true,evidence01:.9,at:300+i,holdout:true});
}
const q=brain.diagnostics().quality;
assert.ok(q.holdout01>0);
assert.equal(q.validated,true);
const saved=brain.snapshot();
const restored=new AutonomousScientificBrainSubstrate(); restored.restore(saved);
assert.deepEqual(restored.snapshot(),saved);
const after=restored.decide({predictionError01:.7,uncertainty01:.4,novelty01:.8,sensorConflict01:.2,selfPredictionError01:.3,agencyUncertainty01:.2,activeInformationGain01:.6,resourcePressure01:.1});
assert.ok(after.priority01>=0&&after.priority01<=1);
console.log(`B194_AUTONOMOUS_SCIENTIFIC_BRAIN=PASS samples=${brain.diagnostics().samples} accepted=${brain.diagnostics().acceptedUpdates} modelMae=${q.modelMae01.toFixed(6)} baselineMae=${q.baselineMae01.toFixed(6)} holdout=${q.holdout01.toFixed(4)} validated=${q.validated}`);
