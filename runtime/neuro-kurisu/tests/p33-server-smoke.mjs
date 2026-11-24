import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const port=18733;
const child=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{env:{...process.env,PORT:String(port),KOBOLDCPP_URL:'http://127.0.0.1:9'},stdio:['ignore','pipe','pipe']});
try{
  let started=false;
  for(let i=0;i<30&&!started;i++){
    await wait(100);
    try{const r=await fetch(`http://127.0.0.1:${port}/api/organism/personhood`); if(r.ok)started=true;}catch{}
  }
  assert.equal(started,true);
  const r=await fetch(`http://127.0.0.1:${port}/api/organism/personhood`);
  const j=await r.json();
  assert.equal(j.personhood.identity.canonicalName,'Makise Kurisu');
  const s=await fetch(`http://127.0.0.1:${port}/api/organism/status`); const status=await s.json(); assert.ok(status.personhood);
  console.log('P33_SERVER=PASS', JSON.stringify(j.diagnostics));
}finally{child.kill('SIGTERM');}
