import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{enableWorkspace:true,enableSelfPrediction:true});
await core.init();
const step=await core.observe({text:'я вижу экран в лаборатории и хочу понять, что изменилось',vision:{features:[.2,.4,.6,.8],sceneLabel:'lab',objects:[{label:'screen',kind:'object',confidence01:.9}],relations:[]},audio:{samples:[0,.2,-.2,.1,0],sampleRate:8000},worldContext:{tick:1,location:'lab',energy:.8,attention:.75,uncertainty:.3,facts:['screen-on','desk-present'],objects:[{id:'desk-1',label:'desk',location:'lab',value:.4,visible:true,collected:false}],events:['screen-on']}});
assert.ok(core.p42ExperienceSnapshot().tick>=1); assert.ok(core.p43ImagerySnapshot().activeContents.length>=1); assert.ok(core.p44PredictiveWorldSnapshot().rollouts.length>=1); assert.ok(step.state.lastAction!=='none');
await core.feedback({success:.84,reward:.72,surprise:.1,notes:'P42-P44 integration'}); await core.flush();
console.log('P42_P44_INTEGRATION=PASS',JSON.stringify({action:step.state.lastAction,p42:core.p42ExperienceSnapshot().tick,p43:core.p43ImagerySnapshot().tick,p44Samples:core.p44PredictiveWorldSnapshot().samples}));
