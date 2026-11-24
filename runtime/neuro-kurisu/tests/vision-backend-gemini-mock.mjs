import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GeminiVisionSemanticBackend } from '../src/organism/body/GeminiVisionSemanticBackend.ts';

const dir=await mkdtemp(path.join(os.tmpdir(),'nk-gemini-vision-'));
const image=path.join(dir,'frame.jpg');
await writeFile(image,Buffer.from([0xff,0xd8,0xff,0xd9]));
const oldFetch=globalThis.fetch;
globalThis.fetch=async (_url,init)=>{
  const body=JSON.parse(String(init?.body));
  assert.equal(body.contents[0].parts[0].inline_data.mime_type,'image/jpeg');
  assert.ok(String(body.contents[0].parts[0].inline_data.data).length>0);
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"sceneLabel":"lab","confidence01":0.91,"objects":[{"label":"terminal","kind":"object","confidence01":0.94}],"relations":[{"from":"terminal","relation":"on","to":"desk","confidence01":0.82}],"events":[]}' }]}}]}),{status:200,headers:{'content-type':'application/json'}});
};
try{
  const backend=new GeminiVisionSemanticBackend({apiKey:'test-key',model:'gemini-3.8-flash'});
  const result=await backend.analyze({imagePath:image,at:1,cameraId:0});
  assert.equal(result.semantic,true); assert.equal(result.sceneLabel,'lab'); assert.equal(result.objects?.[0]?.label,'terminal'); assert.equal(result.relations?.[0]?.to,'desk');
  console.log(`GEMINI_VISION_MOCK=PASS backend=${backend.id} scene=${result.sceneLabel} objects=${result.objects?.length}`);
}finally{globalThis.fetch=oldFetch;await rm(dir,{recursive:true,force:true});}
