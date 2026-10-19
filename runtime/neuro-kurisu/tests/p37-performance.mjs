import assert from 'node:assert/strict';
import { P37EmbodiedSensoriumEngine } from '../src/organism/body/P37EmbodiedSensorium.ts';
const e=new P37EmbodiedSensoriumEngine(); const t=Date.now();
for(let i=0;i<1000;i++) e.ingest({text:i%20===0?'Kurisu research lab':'' ,vision:{sceneLabel:i%2?'lab':'lab',confidence01:.8,objects:[{label:'desk',confidence01:.8,x:i%5,y:1,z:0}]},audio:{events:[{label:'ambient',confidence01:.5}]},body:{energy01:.8-(i%1000)/10000,thermal01:.2,capacity01:.8,awake:true,sensoryFreshness01:.9},at:i});
const ms=Date.now()-t; const s=e.snapshot(); assert.ok(s.entities.length<=192); assert.ok(s.claims.length<=384); assert.ok(s.events.length<=128);
console.log(`P37_PERFORMANCE=PASS cycles=1000 ms=${ms} entities=${s.entities.length} claims=${s.claims.length}`);
