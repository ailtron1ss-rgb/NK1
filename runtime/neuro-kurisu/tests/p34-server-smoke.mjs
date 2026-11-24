import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';

const dir=await mkdtemp(path.join(tmpdir(),'nk-p34-server-'));
const port=35500+Math.floor(Math.random()*800);
const env={...process.env,HOST:'127.0.0.1',PORT:String(port),STATE_DIR:dir};
const child=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{cwd:path.resolve(process.cwd()),env,stdio:['ignore','pipe','pipe']});
let out=''; child.stdout.on('data',d=>out+=d); child.stderr.on('data',d=>out+=d);
try{
  let healthy=false; for(let i=0;i<50;i++){await new Promise(r=>setTimeout(r,100)); try{const r=await fetch(`http://127.0.0.1:${port}/api/health`); if(r.ok){healthy=true;break;}}catch{}}
  if(!healthy)throw new Error(`server-start:${out.slice(-700)}`);
  const health=await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
  assert.equal(health.version,RELEASE_CONTRACT.application);
  const causal=await (await fetch(`http://127.0.0.1:${port}/api/organism/personhood/causal`)).json();
  assert.ok(causal.ok && causal.personhoodCausal.identityProfile.protectedIdentityAssertion);
  const goal=await (await fetch(`http://127.0.0.1:${port}/api/organism/personhood/goal`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'сохранить непрерывность',reason:'p34 smoke'})})).json();
  assert.ok(goal.ok && goal.goal?.source==='self-authored');
  const ev=await (await fetch(`http://127.0.0.1:${port}/api/organism/personhood/evidence`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'experience',summary:'server evidence',sourceId:'smoke',weight01:.8})})).json();
  assert.ok(ev.ok && ev.evidence?.id);
  const st=await (await fetch(`http://127.0.0.1:${port}/api/organism/status`)).json();
  assert.ok(st.causalPersonhood && st.personhood);
  console.log('P34_SERVER=PASS',JSON.stringify({goal:goal.goal.id,evidence:ev.evidence.id,identityRevision:causal.personhoodCausal.identityRevision}));
}finally{child.kill('SIGTERM');await new Promise(r=>setTimeout(r,500));await rm(dir,{recursive:true,force:true});}
