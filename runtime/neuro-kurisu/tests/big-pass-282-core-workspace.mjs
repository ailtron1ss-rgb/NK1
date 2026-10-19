import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
const makeAreas=()=>({sensorium:[1,0,1,0,0,1,0,0],memory:[0,1,0,1,1,0,0,0],association:[1,1,0,0,0,0,1,0],selfAction:[0,0,1,1,0,0,1,0]});
for(let i=0;i<12;i++){
  core.b282PredictiveWorkspaceStep({tick:i,areaSpikes:makeAreas(),selfLatent:Array(8).fill(.2+i*.01),worldLatent:Array(8).fill(.3),goalVector:Array(8).fill(.4),novelty01:.35,uncertainty01:.25,predictionError01:.18,reward01:.6,autonomy01:.7,learningEnabled:true});
  core.b282PredictiveWorkspaceLearn({tick:i,reward01:.62,predictionError01:.14,action:i%2?'explore':'verify'});
}
const d=core.b282PredictiveWorkspaceDiagnostics(); assert(d.steps>=12); assert(d.learningUpdates>0); assert(d.ignitionCount>0); const lesion=core.b282PredictiveWorkspaceLesion('association',.5); assert(lesion.causalDrop01>0);
const snap=core.snapshot(); const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await restored.init(); assert.deepEqual(restored.b282PredictiveWorkspaceSnapshot(),core.b282PredictiveWorkspaceSnapshot());
console.log(JSON.stringify({pass:true,steps:d.steps,learningUpdates:d.learningUpdates,predictionUpdates:d.predictionUpdates,ignitionCount:d.ignitionCount,ignition01:d.ignition01,globalCoherence01:d.globalCoherence01,globalPrediction01:d.globalPrediction01,coalition:d.lastCoalition,lesionDrop01:lesion.causalDrop01,restart:true}));
