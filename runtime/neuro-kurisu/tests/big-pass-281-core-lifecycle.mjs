import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
for(let i=0;i<8;i++){
  core.b281PredictiveInterAreaStep({tick:i,areaSpikes:{sensorium:[1,0,1,0,0,0,0,0],memory:[0,1,0,1,0,0,0,0],association:[1,1,0,0,0,0,0,0],selfAction:[0,0,1,1,0,0,0,0]},selfLatent:Array(8).fill(.2),worldLatent:Array(8).fill(.3),goalVector:Array(8).fill(.4),reward01:.58,predictionError01:.18,learningEnabled:true});
  core.b281PredictiveInterAreaLearn({tick:i,reward01:.62,predictionError01:.14,action:i%2?'explore':'verify'});
}
const d=core.b281PredictiveInterAreaDiagnostics(); assert(d.steps>=8); assert(d.messageUpdates>0); const snap=core.snapshot(); const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await restored.init(); assert.deepEqual(restored.b281PredictiveInterAreaSnapshot(),core.b281PredictiveInterAreaSnapshot());
console.log(JSON.stringify({pass:true,steps:d.steps,learningUpdates:d.learningUpdates,messageUpdates:d.messageUpdates,delayedCredit01:d.delayedCredit01,messageCoherence01:d.messageCoherence01,meanEdgePrediction01:d.meanEdgePrediction01}));
