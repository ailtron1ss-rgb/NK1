import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp, rm} from 'node:fs/promises';

const port=39000+Math.floor(Math.random()*1000);
const tempState=await mkdtemp(path.join(os.tmpdir(),'nk-lineage-server-'));
const proc=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',STATE_DIR:tempState},stdio:['ignore','pipe','pipe']});
let ready=false; const start=Date.now();
proc.stdout.on('data',b=>{if(String(b).includes(`http://127.0.0.1:${port}`)) ready=true;});
while(!ready&&Date.now()-start<15000) await new Promise(r=>setTimeout(r,100));
try{
  assert.ok(ready,'server-start-timeout');
  const res=await fetch(`http://127.0.0.1:${port}/api/organism/identity-lineage?label=Kurisu&limit=8`);
  assert.equal(res.status,200);
  const body=await res.json();
  assert.equal(body.ok,true);
  assert.equal(body.derived,true);
  assert.equal(body.nonConsciousnessClaim,true);
  assert.equal(typeof body.summary?.nodes,'number');
  assert.equal(typeof body.summary?.edges,'number');
  assert.ok(Array.isArray(body.neighborhood?.nodes));
  assert.ok(Array.isArray(body.neighborhood?.edges));
  const stop=await fetch(`http://127.0.0.1:${port}/api/organism/voice/interrupt`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reason:'test'})});
  assert.equal(stop.status,200);
  console.log(`IDENTITY_LINEAGE_SERVER=PASS nodes=${body.summary.nodes} edges=${body.summary.edges}`);
} finally {proc.kill('SIGTERM'); await new Promise(r=>setTimeout(r,300)); await rm(tempState,{recursive:true,force:true});}
