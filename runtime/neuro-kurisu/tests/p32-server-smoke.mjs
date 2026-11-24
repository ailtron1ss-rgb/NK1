import assert from 'node:assert/strict';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(tmpdir(),'nk-p32-server-')); const port=35000+Math.floor(Math.random()*1000);
const child=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{cwd:process.cwd(),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),STATE_DIR:dir},stdio:['ignore','pipe','pipe']});
let out=''; child.stdout.on('data',d=>out+=d); child.stderr.on('data',d=>out+=d);
try{
  let ok=false; for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,100)); try{const h=await fetch(`http://127.0.0.1:${port}/api/health`); if(h.ok){ok=true;break;}}catch{}}
  if(!ok) throw new Error(`server unavailable ${out.slice(-600)}`);
  const causal=await (await fetch(`http://127.0.0.1:${port}/api/organism/causal-self`)).json();
  assert.equal(causal.ok,true); assert.equal(causal.causalSelfModel.version,1);
  const pred=await (await fetch(`http://127.0.0.1:${port}/api/organism/causal-self/predict`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'explore'})})).json();
  assert.equal(pred.ok,true); assert.equal(pred.prediction.action,'explore');
  const intervention=await (await fetch(`http://127.0.0.1:${port}/api/organism/causal-self/intervention`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({variable:'smoke',control01:.2,treatment01:.7,independent:true,repetitions:3})})).json();
  assert.equal(intervention.ok,true); assert.equal(intervention.intervention.evidenceLevel,'controlled-repeated');
  const lesion=await (await fetch(`http://127.0.0.1:${port}/api/organism/causal-self/lesion`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({})})).json();
  assert.equal(lesion.ok,true); assert.equal(lesion.result.persisted,false);
  const health=await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
  assert.equal(health.version,RELEASE_CONTRACT.application); assert.equal(health.schemaVersion,RELEASE_CONTRACT.stateSchema);
  console.log('P32_SERVER_SMOKE=PASS');
}finally{child.kill('SIGTERM');await new Promise(r=>setTimeout(r,300));await rm(dir,{recursive:true,force:true});}
