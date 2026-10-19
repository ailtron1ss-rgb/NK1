import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const dir=await mkdtemp(`${tmpdir()}/neuro-p39-server-`);
const port=34200+(process.pid%700);
const child=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{env:{...process.env,PORT:String(port),STATE_DIR:dir,ENABLE_LANGUAGE:'0'},stdio:['ignore','pipe','pipe']});
let output=''; child.stdout.on('data',d=>output+=d); child.stderr.on('data',d=>output+=d);
const waitForStart=()=>new Promise((resolve,reject)=>{const end=Date.now()+4000; const timer=setInterval(()=>{if(output.includes(`http://127.0.0.1:${port}`)){clearInterval(timer);resolve(true);} else if(Date.now()>end){clearInterval(timer);reject(new Error(`server did not start: ${output.slice(-1000)}`));} else if(child.exitCode!==null){clearInterval(timer);reject(new Error(`server exited: ${output.slice(-1000)}`));}},50);});
try{
  await waitForStart();
  const base=`http://127.0.0.1:${port}`;
  const h=await fetch(`${base}/api/health`); assert.equal(h.status,200);
  const r=await fetch(`${base}/api/organism/life`); assert.equal(r.status,200);
  const body=await r.json(); assert.equal(body.ok,true); assert.ok(body.life);
  const hp=await fetch(`${base}/api/organism/life/host`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({hostId:'server-test-host'})});
  assert.equal(hp.status,200); const hb=await hp.json(); assert.equal(hb.life.host.current,'server-test-host');
  console.log(`P39_SERVER=PASS schema=${body.life.version} host=${hb.life.host.current}`);
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve=>{if(child.exitCode!==null)resolve(); else child.once('close',resolve);});
  await rm(dir,{recursive:true,force:true});
}
