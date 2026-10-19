import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile'});
await core.init();
for(let i=0;i<96;i++){
  const a=i%4===0?'explore':i%4===1?'verify':'reflect';
  const assembly=Array.from({length:16},(_,j)=>Math.max(0,Math.sin(i*.12+j*.31+(i%4)*.7)*.5+.5));
  const selfLatent=Array.from({length:16},(_,j)=>Math.tanh(Math.sin(i*.07+j*.17)));
  const vector=Array.from({length:16},(_,j)=>Math.sin(i*.025+j*.11)*.4+((i%7)/7)*.1);
  core.b271NeuralAutobiographyStep(assembly,selfLatent,vector,a);
  if(i%2===1) core.b271NeuralAutobiographyLearn(.62+.14*((i%5)/4),.10+.12*((i%7)/6),a);
}
const d=core.b271NeuralAutobiographyDiagnostics();
assert.ok(d.steps>90,'B271 did not run in core');
assert.ok(d.learningUpdates>40,'B271 did not learn in core');
assert.ok(d.sequenceDepth>0,'B271 sequence memory absent');
assert.ok(d.reconstruction01>.2,'B271 reconstruction weak');
assert.ok(d.autonomousGoalPressure01>.05,'B271 goal pressure inert');
assert.ok(['explore','verify','reflect','rest','respond','wait','defer'].includes(d.proposedAction),'invalid proposed action');
const recall=core.b271NeuralAutobiographyRecall(Array(16).fill(0).map((_,j)=>j===2?1:0),4);
assert.equal(recall.length,5,'unexpected recall horizon');
const snap=core.snapshot();
const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile'});
await core2.init();
const d2=core2.b271NeuralAutobiographyDiagnostics();
assert.equal(d2.learningUpdates,d.learningUpdates,'B271 learning not persisted');
assert.equal(d2.sequenceDepth,d.sequenceDepth,'B271 autobiographical traces not persisted');
assert.equal(d2.proposedGoal,d.proposedGoal,'B271 goal state not persisted');
console.log(JSON.stringify({pass:true,diagnostics:d,restored:d2,recallDepth:recall.length},null,2));
