import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

const dir=await mkdtemp(path.join(tmpdir(),'nk-conscio-http-'));
const port=34000 + Math.floor(Math.random()*500);
const env={...process.env,HOST:'127.0.0.1',PORT:String(port),STATE_DIR:dir};
const child=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{cwd:path.resolve(process.cwd()),env,stdio:['ignore','pipe','pipe']});
let output=''; child.stdout.on('data',d=>output+=d); child.stderr.on('data',d=>output+=d);
const get=async(pathname)=>fetch(`http://127.0.0.1:${port}${pathname}`,{signal:AbortSignal.timeout(5000)});
const post=async(pathname,payload)=>fetch(`http://127.0.0.1:${port}${pathname}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(5000)});
try {
  let ready=false;
  for(let i=0;i<150;i++){await new Promise(r=>setTimeout(r,100));try{const r=await get('/api/health');const j=await r.json();if(r.ok&&j.ready===true){ready=true;break;}}catch{}}
  assert(ready,`server not ready: ${output.slice(-500)}`);
  const overview=await (await get('/api/organism/integration/conscio')).json(); assert.equal(overview.ok,true);
  const sync=await (await post('/api/organism/integration/conscio/sync-memory',{limit:16})).json(); assert.equal(sync.ok,true);
  const safeSearch=await (await get('/api/organism/integration/conscio/search?q=memory&k=4')).json(); assert.equal(safeSearch.ok,true); assert(Array.isArray(safeSearch.hits));
  const hostile=await (await get('/api/organism/integration/conscio/search?q=%22%20OR%201%3D1%20--&k=4')).json(); assert.equal(hostile.ok,true); assert(Array.isArray(hostile.hits));
  const source=await (await post('/api/organism/integration/conscio/source-boundary',{path:'legacy/input-archives/will-main.zip',requestedState:'canonical'})); assert.equal(source.status,403); const sourceJson=await source.json(); assert.equal(sourceJson.result.state,'provenance-only');
  const canary=await (await post('/api/organism/integration/conscio/source-boundary',{path:'runtime/neuro-kurisu/src/server/server.mjs',requestedState:'canonical'})).json(); assert.equal(canary.ok,true);
  const skill=await (await post('/api/organism/integration/conscio/skills/publish',{name:'http-smoke',summary:'verify server through sandboxed requests',provenance:'smoke'})).json(); assert.equal(skill.ok,true); const sid=skill.skill.id;
  assert.equal((await (await post('/api/organism/integration/conscio/skills/trial',{skillId:sid,ok:true,evidence:'trial-1'})).json()).ok,true);
  assert.equal((await (await post('/api/organism/integration/conscio/skills/trial',{skillId:sid,ok:true,evidence:'trial-2'})).json()).ok,true);
  assert.equal((await (await post('/api/organism/integration/conscio/skills/review',{skillId:sid,decision:'approve'})).json()).ok,true);
  assert.equal((await (await post('/api/organism/integration/conscio/peers/pair',{id:'http-peer',label:'HTTP Peer',capabilities:['message']})).json()).ok,true);
  assert.equal((await (await post('/api/organism/integration/conscio/peers/decide',{id:'http-peer',decision:'trust'})).json()).ok,true);
  const msg=await (await post('/api/organism/integration/conscio/peers/message',{to:'http-peer',payload:{text:'hello'}})).json(); assert.equal(msg.ok,true);
  const idemPost=()=>post('/api/organism/integration/conscio/peers/message',{to:'http-peer',payload:{text:'idempotent-once'},idempotencyKey:'http-conscio-idem'});
  const idemFirstRes=await idemPost(); assert.equal(idemFirstRes.status,200); const idemFirst=await idemFirstRes.json(); assert.equal(idemFirst.ok,true);
  const idemReplayRes=await post('/api/organism/integration/conscio/peers/message',{to:'http-peer',payload:{text:'idempotent-once'},idempotencyKey:'http-conscio-idem'}); assert.equal(idemReplayRes.status,200); const idemReplay=await idemReplayRes.json(); assert.equal(idemReplay.reused,true); assert.equal(idemReplay.message.id,idemFirst.message.id);
  const idemConflictRes=await post('/api/organism/integration/conscio/peers/message',{to:'http-peer',payload:{text:'different'},idempotencyKey:'http-conscio-idem'}); assert.equal(idemConflictRes.status,409); const idemConflict=await idemConflictRes.json(); assert.equal(idemConflict.error,'idempotency-key-conflict'); assert.equal(idemConflict.existingId,idemFirst.message.id); assert.equal('message' in idemConflict,false);
  assert.equal((await (await post('/api/organism/integration/conscio/peers/ack',{id:msg.message.id,accepted:true})).json()).ok,true);
  const cal=await (await post('/api/organism/integration/conscio/calibration/observe',{key:'http-smoke',predicted01:.9,outcome01:1,evidenceTrust01:.9})).json(); assert.equal(cal.ok,true); assert.equal(cal.calibration.samples,1);
  const claimNoEvidence=await post('/api/organism/integration/conscio/claims',{claim:'I sent it',expectedAction:'http-peer',supported:true}); assert.equal(claimNoEvidence.status,400);
  const claim=await (await post('/api/organism/integration/conscio/claims',{claim:'I sent it',expectedAction:'http-peer',supported:true,evidence:[`receipt:${msg.message.id}`]})).json(); assert.equal(claim.ok,true);
  const metabolic=await (await get('/api/organism/integration/conscio/metabolic?used=9000&window=16384')).json(); assert.equal(metabolic.ok,true); assert.equal(metabolic.metabolic.state,'fatigue');
  console.log('CONSCIO_SERVER_SMOKE=PASS');
} finally {
  child.kill('SIGTERM'); await new Promise(r=>setTimeout(r,300)); await rm(dir,{recursive:true,force:true});
}
