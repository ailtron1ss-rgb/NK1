import assert from 'node:assert/strict';
import { RecurrentCausalMemory } from '../src/organism/cognition/RecurrentCausalMemory.ts';
import { CanonicalNeuralSubstrate } from '../src/organism/cognition/CanonicalNeuralSubstrate.ts';

const memory=new RecurrentCausalMemory();
const brain=new CanonicalNeuralSubstrate();

for(let i=0;i<18;i++){
  brain.step({vector:Array.from({length:24},(_,j)=>Math.sin(i*.17+j*.11)),tick:i,action:null,learningEnabled:false});
  memory.encodeContext({tick:i,memoryId:`m${i%3}`,activity:brain.activity(),surprise01:i%4===0?.8:.2});
  memory.recordOutcome({tick:i,action:i%2===0?'verify':'explore',reward01:i%3===0?.9:.25,surprise01:i%4===0?.8:.2,memoryId:`m${i%3}`,activity:brain.activity()});
}
const before=brain.snapshot();
const credits=memory.replay(12,200);
assert.ok(credits.length>0,'replay must produce delayed credit');
let applied=0; for(const c of credits) applied+=brain.applyReplayCredit(c);
const after=brain.snapshot();
const changed=JSON.stringify(before.readoutWeights)!==JSON.stringify(after.readoutWeights)||JSON.stringify(before.valueWeights)!==JSON.stringify(after.valueWeights);
assert.ok(applied>0,'replay must apply non-zero credit');
assert.ok(changed,'replay must change trainable parameters');
assert.ok(memory.diagnostics().replayedEpisodes>0,'replay counter must advance');
const persisted=memory.snapshot();
const restored=new RecurrentCausalMemory(); restored.restore(persisted);
assert.deepEqual(restored.snapshot(),persisted,'causal memory must survive restart');
console.log(JSON.stringify({ok:true,credits:credits.length,applied,diagnostics:restored.diagnostics()}));
