import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core=new OrganismCore(new MemoryStateStore());
await core.init();
const world=(tick)=>({tick,location:'active-perception-lab',energy:.82,attention:.75,uncertainty:.68,facts:['hidden-state','sensor-selection'],objects:[],events:[`event-${tick%3}`]});
for(let i=0;i<8;i++){
  await core.observe({text:`active perception ${i}`,novelty:.72,worldContext:world(i),vision:{features:[.2,.7,.4,.9],sceneLabel:'lab'}});
  const req=core.activePerceptionSnapshot().lastRequest;
  assert(req,'live active-perception proposal must be produced');
  assert.equal(core.activePerceptionComplete(req.id,.68+(i%3)*.08),true);
  await core.feedback({success:.72,reward:.74,surprise:.21,worldTransition:{action:'explore',before:world(i),after:world(i+1),reward:.74,surprise:.21,at:70000+i}});
}
const snapBefore=core.snapshot();
assert((snapBefore.system.activePerceptionNeural?.learningSteps??0)>=8,'central active-perception learner must receive live completed-gain evidence');
assert(snapBefore.system.activePerceptionExecutor?.proposed>=1,'active perception executor must receive a live proposal');
const neural=core.activePerceptionNeuralSnapshot();
assert(neural.selectedModality!==null,'neural selector must choose a modality when sensors are available');
const after=core.activePerceptionNeuralSnapshot();
assert(after.learningSteps>=8,'observed gains must train the active-perception substrate');
console.log(JSON.stringify({pass:193,learningSteps:after.learningSteps,selected:after.selectedModality,quality:after.quality,executor:core.activePerceptionSnapshot()},null,2));
