import assert from 'node:assert/strict';
import { B281PredictiveInterAreaMessaging } from '../src/organism/cognition/B281PredictiveInterAreaMessaging.ts';
const areas=()=>({sensorium:[1,0,1,0,0,0,0,0],memory:[0,1,0,1,0,0,0,0],association:[1,1,0,0,0,0,0,0],selfAction:[0,0,1,1,0,0,0,0]});
const m=new B281PredictiveInterAreaMessaging(); let updates=0; let last;
for(let t=0;t<220;t++){ const r=m.step({tick:t,areaSpikes:areas(),selfLatent:[.2,.1,.3,.1,.4,.2,.1,.2],worldLatent:[.3,.4,.1,.2],goalVector:[.5,.2,.1],reward01:.55,predictionError01:.2,learningEnabled:true}); updates+=r.hiddenMessageCount; last=r; if(t%9===0)m.learnFromOutcome({tick:t,reward01:.58,predictionError01:.15,action:r.action}); }
const d=m.diagnostics(); assert(d.steps===220); assert(d.messageUpdates>0); assert(d.delayedCredit01>0); assert(d.messageCoherence01>0); const lesion=m.lesionEdge('association','selfAction',.5); assert(lesion.causalDrop01>=0); const snap=m.snapshot(); const n=new B281PredictiveInterAreaMessaging(); n.restore(snap); assert.deepEqual(n.snapshot(),snap);
console.log(JSON.stringify({pass:true,steps:d.steps,messageUpdates:d.messageUpdates,delayedCredit01:d.delayedCredit01,messageCoherence01:d.messageCoherence01,meanEdgePrediction01:d.meanEdgePrediction01,lesionDrop01:lesion.causalDrop01,hiddenMessageCount:updates,last}));
