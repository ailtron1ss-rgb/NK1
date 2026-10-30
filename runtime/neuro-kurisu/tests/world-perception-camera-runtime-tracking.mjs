import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const root=await mkdtemp(path.join(os.tmpdir(),'nk1-camera-runtime-tracking-'));
const imagePath=path.join(root,'frame.jpg');
// Small valid JPEG header/EOI fixture with known 320x240 SOF metadata.
const imageBytes=Uint8Array.from([
  0xff,0xd8,0xff,0xc0,0x00,0x11,0x08,0x00,0xf0,0x01,0x40,
  0x03,0x01,0x11,0x00,0x02,0x11,0x01,0x03,0x11,0x01,0xff,0xd9,
]);
await writeFile(imagePath,imageBytes);
const imageHash=createHash('sha256').update(imageBytes).digest('hex');
let captureCount=0;
const visionBackend={
  id:'test-vision-box-backend',
  async analyze(input){
    assert.equal(input.cameraId,0);
    captureCount++;
    return {
      semantic:true,
      sceneLabel:'laboratory',
      confidence01:.93,
      objects:[{
        label:'chair',kind:'object',confidence01:.96,
        bbox:{x:captureCount===1 ? .10 : .12,y:.20,width:.20,height:.35},
        bboxConfidence01:.92,
      }],
      relations:[],events:[],backend:this.id,latencyMs:1,evidenceKind:'model-output',
    };
  },
};

const runtime=new OrganismRuntime({
  stateFile:path.join(root,'organism.json'),
  worldStateFile:path.join(root,'world.json'),
  enableLanguage:false,
  autoRun:false,
  visionBackend,
});

try{
  await runtime.init();
  let receipt=0;
  // Exercise the real public runtime capture method and real evidence decoder;
  // only the platform ActionGateway/device receipt is controlled in this test.
  runtime.core.executeTool=async (_tool,_input,_origin,_options)=>{
    receipt++;
    return {
      tool:'organism.device.capture',
      ok:true,
      verified:true,
      executionId:`runtime-camera-receipt-${receipt}`,
      providerReceiptId:`provider-camera-receipt-${receipt}`,
      outcomeClass:'success',
      idempotencyStatus:'new',
      result:{ok:true,path:imagePath,size:imageBytes.length,hash:imageHash},
    };
  };

  const first=await runtime.captureCamera(0,true);
  assert.equal(first.ok,true);
  assert.equal(first.semanticVision,true);
  assert.equal(first.tracking.acceptedFrame,true);
  assert.equal(first.tracking.newTrackCount,1);
  assert.equal(first.semanticResult.objects[0].trackingStatus,'new');
  const firstTrackId=first.semanticResult.objects[0].trackId;
  assert.ok(firstTrackId);

  // The bytes/hash are deliberately identical. A new capture receipt is still a
  // new frame and must associate the second detection to the prior track.
  const second=await runtime.captureCamera(0,true);
  assert.equal(second.ok,true);
  assert.equal(second.evidence.sha256,first.evidence.sha256);
  assert.notEqual(second.executionId,first.executionId);
  assert.equal(second.tracking.acceptedFrame,true);
  assert.equal(second.tracking.associatedTrackCount,1);
  assert.equal(second.semanticResult.objects[0].trackingStatus,'associated');
  assert.equal(second.semanticResult.objects[0].trackId,firstTrackId);

  const perception=runtime.core.p41PerceptionSnapshot();
  const chair=perception.entities.find(entity=>entity.label==='chair'&&entity.kind==='object');
  assert.ok(chair);
  assert.equal(chair.trackId?.endsWith(firstTrackId),true);
  assert.equal(chair.imageBoxCameraId,0);
  assert.ok(chair.imageBoxAt>0);
  assert.deepEqual(chair.imageBox,{x:.12,y:.20,width:.20,height:.35});

  console.log(JSON.stringify({
    ok:true,
    captureReceipts:receipt,
    identicalImageHashStillNewFrame:true,
    secondFrameAssociated:true,
    canonicalP41TrackId:chair.trackId,
    imageSpaceBoxPersisted:true,
    physicalDeviceTouched:false,
  }));
}finally{
  await runtime.stop?.();
  await rm(root,{recursive:true,force:true});
}
