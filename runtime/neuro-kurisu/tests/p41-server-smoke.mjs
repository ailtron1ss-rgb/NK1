import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dir = await mkdtemp(path.join(os.tmpdir(), 'neuro-p41-server-'));
const port = String(19000 + Math.floor(Math.random()*500));
const child = spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{
  cwd:process.cwd(),
  env:{...process.env,PORT:port,STATE_DIR:dir,AUTO_RUN:'0'},
  stdio:['ignore','pipe','pipe'],
});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let ready=false;
for(let i=0;i<40;i++){
  try{
    const r=await fetch(`http://127.0.0.1:${port}/api/health`);
    if(r.ok){ready=true;break;}
  }catch{}
  await sleep(100);
}
assert.equal(ready,true);
const native=await (await fetch(`http://127.0.0.1:${port}/api/organism/native-perception`)).json();
const semantic=await (await fetch(`http://127.0.0.1:${port}/api/organism/semantic-perception`)).json();
assert.equal(native.ok,true); assert.equal(semantic.ok,true);
assert.ok(native.nativePerception); assert.ok(semantic.perception);
child.kill('SIGTERM');
await sleep(150);
if(!child.killed) child.kill('SIGKILL');
await rm(dir,{recursive:true,force:true});
console.log('P41_SERVER=PASS nativeEndpoint=true semanticEndpoint=true');
