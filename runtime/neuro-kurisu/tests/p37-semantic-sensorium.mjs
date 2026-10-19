import assert from 'node:assert/strict';
import { P37EmbodiedSensoriumEngine } from '../src/organism/body/P37EmbodiedSensorium.ts';
const e = new P37EmbodiedSensoriumEngine();
e.ingest({text:'Kurisu enters lab', vision:{sceneLabel:'lab',confidence01:.9,objects:[{label:'desk',kind:'object',confidence01:.9,x:1,y:2,z:0},{label:'Kurisu',kind:'person',confidence01:.95}],relations:[{from:'Kurisu',relation:'near',to:'desk',confidence01:.8}]}, audio:{events:[{label:'door-close',confidence01:.8}]}, worldContext:{location:'lab',objects:[{id:'d1',label:'desk',location:'lab',value:.5,visible:true,collected:false}],events:['arrival']},body:{location:'lab',energy01:.8,thermal01:.2,capacity01:.8,awake:true,sensoryFreshness01:1}});
let s=e.snapshot(); assert.equal(s.scene.label,'lab'); assert.ok(s.entities.length>=2); assert.ok(s.relationEdges.length>=1); assert.ok(s.sensors.vision.samples>=1); assert.ok(e.nextPerception() === null || e.nextPerception()?.priority01 >= 0);
console.log(`P37_SENSORIUM=PASS entities=${s.entities.length} relations=${s.relationEdges.length} agreement=${s.crossModalAgreement01.toFixed(3)}`);
