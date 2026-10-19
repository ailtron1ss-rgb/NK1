import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { inspectCameraFile } from '../src/organism/body/CameraEvidenceProcessor.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { NoopOperationalJournal } from '../src/organism/persistence/NoopOperationalJournal.ts';

const dir=await mkdtemp(path.join(os.tmpdir(),'nk-p92-'));
// Minimal JPEG with SOF marker; enough to exercise dimension parsing without image libs.
const jpeg=Buffer.from([0xff,0xd8,0xff,0xc0,0x00,0x11,0x08,0x00,0xf0,0x01,0x40,0x03,0x01,0x11,0x00,0x02,0x11,0x01,0x03,0x11,0x01,0xff,0xd9]);
const image=path.join(dir,'sample.jpg'); await writeFile(image,jpeg);
const first=await inspectCameraFile({path:image,cameraId:0,previousHash:''});
const second=await inspectCameraFile({path:image,cameraId:0,previousHash:first.sha256});
assert.equal(first.width,320); assert.equal(first.height,240); assert.equal(first.novelty01,1); assert.equal(second.novelty01,0);

const rt=new OrganismRuntime({stateFile:path.join(dir,'organism.json'),worldStateFile:path.join(dir,'world.json'),autoRun:false,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new NoopOperationalJournal()});
await rt.init();
const ev=rt.core.recordCameraEvidence(first);
assert.equal(ev.captures,1);
assert.equal(rt.core.snapshot().facets.embodiment.cameraEvidence.last?.sha256,first.sha256);
assert.equal(rt.core.snapshot().facets.embodiment.cameraEvidence.semanticVisionAvailable,false);

const semanticDir=await mkdtemp(path.join(os.tmpdir(),'nk-p92-backend-'));
const semanticImage=path.join(semanticDir,'image.jpg'); await writeFile(semanticImage,jpeg);
const semanticBackend={id:'test-vision',async analyze(input){ const fs=await import('node:fs/promises'); const st=await fs.stat(input.imagePath); return {semantic:true,sceneLabel:'lab',confidence01:.91,objects:[{label:'desk',kind:'object',confidence01:.94}],relations:[{from:'desk',relation:'inside',to:'lab',confidence01:.77}],events:[],backend:'test-vision',latencyMs:1,evidenceKind:'model-output'}; }};
const rtBackend=new OrganismRuntime({stateFile:path.join(semanticDir,'organism.json'),worldStateFile:path.join(semanticDir,'world.json'),autoRun:false,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new NoopOperationalJournal(),visionBackend:semanticBackend});
await rtBackend.init();
(rtBackend.embodiment).captureCamera=async()=>({ok:true,path:semanticImage,size:jpeg.length,hash:first.sha256});
const captured=await rtBackend.captureCamera(0,false);
assert.equal(captured.semanticVision,true); assert.equal(captured.semanticBackend,'test-vision');
assert.equal(rtBackend.core.cameraEvidenceSnapshot().semanticFrames,1);
assert.equal(rtBackend.core.p41PerceptionSnapshot().scene.label,'lab');
assert.equal(rtBackend.core.p41NextPerception(),null);
await (await import('node:fs/promises')).access(semanticImage).then(()=>{throw new Error('temporary backend image was not removed')}).catch(()=>{});
rtBackend.stop();

console.log(`P92_SENSORIUM=PASS bytes=${first.byteLength} size=${first.width}x${first.height} entropy=${first.byteEntropy01.toFixed(3)} novelty2=${second.novelty01} semanticBackend=PASS`);
rt.stop();
