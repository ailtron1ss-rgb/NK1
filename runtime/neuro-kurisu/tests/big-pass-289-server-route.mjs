import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
const port=31389;
const child=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
let stderr=''; child.stderr.on('data',d=>stderr+=d);
try {
  let ready=false;
  for(let i=0;i<50 && !ready;i++){ await sleep(100); try{ const r=await fetch(`http://127.0.0.1:${port}/api/embodiment/status`); ready=r.ok; }catch{} }
  if(!ready) throw new Error(`server did not start: ${stderr.slice(-1000)}`);
  const emb=await (await fetch(`http://127.0.0.1:${port}/api/embodiment/status`)).json();
  const ns=await (await fetch(`http://127.0.0.1:${port}/api/organism/neural-spine`)).json();
  if(!emb.ok || emb.profiles?.mobile?.ok!==true) throw new Error('Live2D mobile dependency closure failed');
  if(!ns.ok || ns.nonConsciousnessClaim!==true) throw new Error('B289 server route failed');
  console.log(JSON.stringify({pass:true,mobileOk:emb.profiles.mobile.ok,mobileFiles:emb.profiles.mobile.filesPresent,neuralRoute:ns.ok,computeTier:ns.diagnostics.computeTier}));
} finally { child.kill('SIGTERM'); await Promise.race([once(child,'exit'),sleep(1000)]); }
