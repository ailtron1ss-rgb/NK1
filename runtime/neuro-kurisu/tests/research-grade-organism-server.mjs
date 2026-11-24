import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const port=38940+Math.floor(Math.random()*1000); const child=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),NK_STATE_FILE:`/tmp/nk-rg-${process.pid}.json`},stdio:['ignore','pipe','pipe']});
let out=''; child.stdout.on('data',d=>out+=d); child.stderr.on('data',d=>out+=d);
try{for(let i=0;i<40;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/organism/research-grade-organism`); if(r.ok){const j=await r.json();assert.equal(j.ok,true);assert.ok(j.diagnostics);console.log(`RESEARCH_GRADE_SERVER=PASS overall=${j.benchmark.overall01}`);break;}}catch{} await new Promise(r=>setTimeout(r,100)); if(i===39)throw new Error(out||'server not ready');}} finally{child.kill('SIGTERM');await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1000))]);}
