import assert from 'node:assert/strict';
import { B281PredictiveInterAreaMessaging, defaultB281State } from '../src/organism/cognition/B281PredictiveInterAreaMessaging.ts';
const m=new B281PredictiveInterAreaMessaging();
for(let t=0;t<30;t++) m.step({tick:t,areaSpikes:{sensorium:[1,0,1,0,0,0,0,0],memory:[0,1,0,1,0,0,0,0],association:[1,1,0,0,0,0,0,0],selfAction:[0,0,1,1,0,0,0,0]},selfLatent:Array(8).fill(.2),worldLatent:Array(8).fill(.3),goalVector:Array(8).fill(.4),reward01:.6,predictionError01:.2,learningEnabled:true});
const snap=m.snapshot();
const n=new B281PredictiveInterAreaMessaging(); n.restore(snap); assert.deepEqual(n.snapshot(),snap);
const fresh=defaultB281State(); assert.equal(fresh.version,1);
console.log(JSON.stringify({pass:true,steps:snap.steps,learningUpdates:snap.learningUpdates,roundTrip:true}));
