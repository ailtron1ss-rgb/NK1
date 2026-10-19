import assert from 'node:assert/strict';
import { B279NeuralAttractorAssemblies } from '../src/organism/cognition/B279NeuralAttractorAssemblies.ts';
const a=new B279NeuralAttractorAssemblies();
for(let i=0;i<8;i++){a.step({tick:i,vector:Array.from({length:16},(_,j)=>Math.sin(i+j)),action:i%2?'explore':'verify'});a.learnFromOutcome({tick:i,reward01:.65,predictionError01:.25,action:i%2?'explore':'verify'});}
const raw=JSON.parse(JSON.stringify(a.snapshot())); const b=new B279NeuralAttractorAssemblies(); b.restore(raw); assert.deepEqual(b.snapshot(),raw);
console.log(JSON.stringify({ok:true,roundTrip:true,cycles:raw.cycles,learningUpdates:raw.learningUpdates,consolidations:raw.consolidationCount},null,2));
