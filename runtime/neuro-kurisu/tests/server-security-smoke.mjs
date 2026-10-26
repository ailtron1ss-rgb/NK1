import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const stateDir=await mkdtemp(join(tmpdir(),'kurisu-sec-'));
const port=32189;
const child=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{env:{...process.env,HOST:'0.0.0.0',PORT:String(port),NEURO_API_TOKEN:'test-secret',STATE_DIR:stateDir,NEURO_RUNTIME_MODE:'eco'},stdio:['ignore','pipe','pipe']});
let out=''; child.stdout.on('data',b=>out+=b.toString()); child.stderr.on('data',b=>out+=b.toString());
try{
 let ok=false; let lastHealth=null;
 for(let i=0;i<300;i++){
  try {
   const r=await fetch(`http://127.0.0.1:${port}/health`);
   lastHealth=await r.json();
   if(r.ok&&lastHealth.ready===true){ok=true;break}
  } catch {}
  await new Promise(r=>setTimeout(r,100));
 }
 assert.equal(ok,true,`runtime did not become ready: health=${JSON.stringify(lastHealth)} server=${out.slice(-6000)}`);
 assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status,200);
 assert.equal((await fetch(`http://127.0.0.1:${port}/api/organism/status-lite`)).status,401);
 const authenticatedResponse=await fetch(`http://127.0.0.1:${port}/api/organism/status-lite`,{headers:{authorization:'Bearer test-secret'}});
 const authenticatedBody=await authenticatedResponse.text();
 assert.equal(authenticatedResponse.status,200,`authenticated status-lite must not crash: body=${authenticatedBody} server=${out.slice(-6000)}`);
 assert.equal((await fetch(`http://127.0.0.1:${port}/api/organism/status-lite`,{headers:{authorization:'Bearer bad'}})).status,403);
 console.log('SERVER_SECURITY_SMOKE=PASS');
}finally{child.kill('SIGTERM'); await new Promise(r=>setTimeout(r,250)); await rm(stateDir,{recursive:true,force:true});}
