import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const port=19163; const p=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{env:{...process.env,PORT:String(port),NEURO_DISABLE_AUTOSTART:'0'},stdio:['ignore','pipe','pipe']});
let out=''; let exited=false; p.stdout.on('data',d=>out+=d); p.stderr.on('data',d=>out+=d); p.once('exit',()=>{exited=true});
let res=null; for(let i=0;i<80&&!res;i++){if(exited)break;try{res=await fetch(`http://127.0.0.1:${port}/api/organism/cognitive-organism-continuity`)}catch{}if(!res)await new Promise(r=>setTimeout(r,250));}
assert.ok(res,`server unavailable: ${out.slice(-2000)}`); assert.equal(res.status,200); const body=await res.json(); assert.equal(body.ok,true); assert.ok(body.continuity); assert.ok(body.diagnostics); assert.ok(body.benchmark); p.kill('SIGTERM'); await Promise.race([once(p,'exit'),new Promise(r=>setTimeout(r,1000))]); console.log(`BIG_PASS_127_163_SERVER=PASS phase=${body.continuity.activePhase} coherence=${body.diagnostics.coherence01.toFixed(3)}`);
