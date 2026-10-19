import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root=process.cwd();
const stateDir=await mkdtemp(path.join(tmpdir(),'nk-input-hardening-')); const port=35700+Math.floor(Math.random()*200); const base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),STATE_DIR:stateDir},stdio:['ignore','pipe','pipe']});
let log=''; child.stdout.on('data',d=>log+=d); child.stderr.on('data',d=>log+=d);
try{
 let ready=false; for(let i=0;i<300;i++){await new Promise(r=>setTimeout(r,100)); try{const x=await fetch(`${base}/api/health`); if(x.ok){ready=true;break}}catch{}}
 assert.equal(ready,true,`not ready after 30s ${log.slice(-1000)}`);
 const bad=await fetch(`${base}/api/organism/integration/hexis/policy`,{method:'POST',headers:{'content-type':'application/json'},body:'{"broken":'});
 assert.equal(bad.status,400); assert.equal((await bad.json()).error,'invalid-json-request');
 const payload='x'.repeat(300000); const large=await fetch(`${base}/api/organism/integration/hexis/policy`,{method:'POST',headers:{'content-type':'application/json','content-length':String(Buffer.byteLength(payload))},body:payload});
 assert.equal(large.status,413); assert.equal((await large.json()).error,'request-too-large');
 const traversal=await fetch(`${base}/%2e%2e/%2e%2e/etc/passwd`); assert.notEqual(traversal.status,200);
 console.log('SERVER_INPUT_HARDENING=PASS');
}finally{child.kill('SIGTERM'); await new Promise(r=>setTimeout(r,300)); await rm(stateDir,{recursive:true,force:true});}
