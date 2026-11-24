import assert from 'node:assert/strict';
import { P40ModelEcologyEngine } from '../src/organism/learning/P40ModelEcology.ts';
const e=new P40ModelEcologyEngine();
const local=e.select({task:'language',urgency01:.3,resourceRisk01:.95,desiredQuality01:.65,allowCloud:false});
assert.ok(['local-fallback','kobold'].includes(local));
const cloud=e.select({task:'language',urgency01:.8,resourceRisk01:.05,desiredQuality01:.88,allowCloud:true});
assert.ok(['gemini','kobold','local-fallback'].includes(cloud));
const beforeQuality=e.profile(cloud).quality01; e.observe(cloud,true,.3); e.observe(cloud,false,.7); assert.equal(e.profile(cloud).quality01,beforeQuality); e.observe(cloud,true,.2,.95); assert.ok(e.profile(cloud).quality01>beforeQuality); assert.ok(e.snapshot().metrics.decisions===2);
console.log('P40_MODEL_ECOLOGY=PASS');
