import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';

const dir=await mkdtemp(`${tmpdir()}/neuro-p38-server-`);
const port=35600+Math.floor(Math.random()*700);
const env={...process.env,HOST:'127.0.0.1',PORT:String(port),STATE_DIR:dir,ENABLE_LANGUAGE:'0',ACTION_TIMEOUT_MS:'1200'};
const child=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{cwd:path.resolve(process.cwd()),env,stdio:['ignore','pipe','pipe']});
let output=''; child.stdout.on('data',d=>output+=d); child.stderr.on('data',d=>output+=d);
const base=`http://127.0.0.1:${port}`;
try{
  let health=null;
  for(let i=0;i<50;i++){
    await new Promise(r=>setTimeout(r,100));
    try{ const r=await fetch(`${base}/api/health`); if(r.ok){health=await r.json();break;} }catch{}
  }
  assert.ok(health && health.ok===true,`server did not start: ${output.slice(-900)}`);
  const r=await fetch(`${base}/api/organism/system-graph`); assert.equal(r.status,200);
  const body=await r.json(); assert.equal(body.ok,true);
  assert.equal(body.release, health.version);
  assert.ok(Array.isArray(body.graph?.nodes) && body.graph.nodes.length>0);
  assert.deepEqual(body.graph.dependencyCycles,[]);
  console.log(`P38_SERVER=PASS schema=${health.schemaVersion} causal-surface=present`);
}finally{
  child.kill('SIGTERM');
  await new Promise(resolve=>{const t=setTimeout(resolve,1000); child.once('close',()=>{clearTimeout(t);resolve();});});
  await rm(dir,{recursive:true,force:true});
}
