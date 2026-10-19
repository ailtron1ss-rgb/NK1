import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { rm } from 'node:fs/promises';
const dir='/tmp/nk177-device-truth'; await rm(dir,{recursive:true,force:true});
const stateFile=`${dir}/organism.json`, worldStateFile=`${dir}/world.json`;
const runtime=new OrganismRuntime({stateFile,worldStateFile,stateStore:new FileStateStore(stateFile),enableLanguage:false});
await runtime.init();
const tool=runtime.toolSnapshot().find(x=>x.id==='organism.device.status'); assert.ok(tool);
const result=await runtime.executeTool('organism.device.status');
const body=runtime.embodimentStatus();
if(body.telemetry.source==='android-termux' && body.telemetry.staleMs===0){ assert.equal(result.verified,true); assert.equal(result.ok,true); }
else { assert.equal(result.verified,false); assert.equal(result.ok,false); assert.equal(result.result.error,'android-telemetry-not-fresh'); }
const project=await runtime.executeTool('organism.project.device');
if(body.telemetry.source==='android-termux' && body.telemetry.staleMs===0){ assert.equal(project.verified,true); }
else { assert.equal(project.verified,false); }
console.log(`BIG_PASS_177_DEVICE_TRUTH=PASS source=${body.telemetry.source} staleMs=${body.telemetry.staleMs} statusVerified=${result.verified} projectVerified=${project.verified}`);
