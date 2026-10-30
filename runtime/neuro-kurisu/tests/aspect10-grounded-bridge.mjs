import assert from 'node:assert/strict';
import { groundInteractionTarget } from '../src/organism/body/GroundedInteractionBridge.ts';
const now=20_000;
const world={version:1,revision:4,lastAt:now,location:'desk',uncertainty01:.1,confidence01:.9,entities:[{id:'gw-cup',label:'ceramic cup',kind:'object',confidence01:.92,present01:.98,firstSeenAt:now-1000,lastSeenAt:now,modalities:['camera'],presenceStatus:'visible',persistence01:.4,absenceEvidence01:0,observationCount:4}],relations:[],events:[],facts:[],provenanceIds:[],lastHash:'x'};
const detection={id:'camera-cup-1',label:'Ceramic Cup',position:{x:.3,y:1,z:.2},frameId:'avatar-root-m',confidence01:.96,visible:true,observedAt:now,source:'camera',safeToTouch:true,affordances:['grasp']};
const result=groundInteractionTarget({detection,world,now});
assert.equal(result.accepted,true);
if(result.accepted){assert.equal(result.target.confidence01,.92);assert.equal(result.target.frameId,'avatar-root-m');}
assert.equal(groundInteractionTarget({detection:{...detection,observedAt:now-5000},world,now}).reason,'stale-camera-detection');
assert.equal(groundInteractionTarget({detection:{...detection,label:'unknown bowl'},world,now}).reason,'object-not-present-in-canonical-world');
assert.equal(groundInteractionTarget({detection,world:{...world,entities:[]},now}).accepted,false);
assert.equal(groundInteractionTarget({detection:{...detection,visible:false},world,now}).reason,'camera-detection-not-grounded');
assert.equal(groundInteractionTarget({detection,world:{...world,entities:[{...world.entities[0],presenceStatus:'fading'}]},now}).reason,'canonical-world-does-not-confirm-presence');
console.log(JSON.stringify({pass:true,tests:6,coverage:['camera-to-world-join','confidence-fusion','stale-detection','unknown-object','missing-world','visibility','presence-status']}));
