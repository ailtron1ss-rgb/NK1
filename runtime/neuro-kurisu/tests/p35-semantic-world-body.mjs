import assert from 'node:assert/strict';
import { P35SemanticWorldBodyEngine } from '../src/organism/body/P35SemanticWorldBody.ts';

const engine=new P35SemanticWorldBodyEngine();
const first=engine.ingest({
  text:'Kurisu enters the lab',
  vision:{sceneLabel:'laboratory',confidence01:.82,objects:[{label:'microscope',kind:'object',confidence01:.88,x:1,y:2,z:0},{label:'Kurisu',kind:'person',confidence01:.91}],relations:[{from:'Kurisu',relation:'inside',to:'laboratory',confidence01:.8}]},
  audio:{events:[{label:'door-close',confidence01:.76}]},
  worldContext:{location:'laboratory',objects:[{id:'m1',label:'microscope',location:'lab',value:.7,visible:true,collected:false}],events:['arrival']},
  body:{location:'laboratory',energy01:.79,thermal01:.14,capacity01:.88,awake:true,sensoryFreshness01:.98},
  at:1000,
});
assert.ok(first.entities.length>=4);
assert.equal(first.scene.label,'laboratory');
assert.ok(first.relations.length>=1);
assert.ok(first.metrics.semanticCoverage01>0);
assert.ok(first.metrics.bodyWorldCoherence01>=.35);
assert.equal(first.body.awake,true);
const second=engine.ingest({vision:{objects:[{label:'microscope',kind:'object',confidence01:.9}]},body:{energy01:.18,thermal01:.78,capacity01:.24,awake:true},at:2000});
assert.equal(second.body.energy01,.18);
assert.equal(second.body.thermal01,.78);
assert.ok(second.affordances.rest>.5);
assert.ok(typeof second.lastWorldHash==='string' && second.lastWorldHash.length===32);
const persisted=engine.snapshot();
const restored=new P35SemanticWorldBodyEngine(); restored.restore(persisted);
assert.deepEqual(restored.snapshot(),persisted);
console.log('P35_SEMANTIC_WORLD_BODY=PASS',JSON.stringify({entities:first.entities.length,relations:first.relations.length,coverage:second.metrics.semanticCoverage01.toFixed(3),rest:second.affordances.rest.toFixed(3)}));
