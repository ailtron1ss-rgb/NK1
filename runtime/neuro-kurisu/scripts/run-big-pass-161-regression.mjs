import { spawn } from 'node:child_process';
import fs from 'node:fs';
const cases=[
  ['typecheck',['scripts/typecheck-runtime.mjs'],120000],
  ['semantic160',['--experimental-strip-types','tests/big-pass-160-semantic-coverage.mjs'],90000],
  ['semantic161-sweep',['--experimental-strip-types','tests/big-pass-161-function-sweep.mjs'],120000],
  ['cognitive-event-fabric',['--experimental-strip-types','tests/big-pass-161-cognitive-event-fabric.mjs'],120000],
  ['157-core',['--experimental-strip-types','tests/big-pass-157-core-operational-life.mjs'],120000],
  ['157-restart',['--experimental-strip-types','tests/big-pass-157-restart.mjs'],120000],
  ['157-server',['--experimental-strip-types','tests/big-pass-157-server-smoke.mjs'],120000],
  ['128-154-core',['--experimental-strip-types','tests/big-pass-128-154-core-autonomous-life.mjs'],120000],
  ['122-core',['--experimental-strip-types','tests/big-pass-122-core-personal-curriculum.mjs'],120000],
  ['p34-integration',['--experimental-strip-types','tests/p34-integration.mjs'],90000],
  ['p26-learning',['--experimental-strip-types','tests/p26-true-learning.mjs'],90000],
  ['p24-world',['--experimental-strip-types','tests/p24-world-identity.mjs'],90000],
  ['p28-integration',['--experimental-strip-types','tests/p28-integration.mjs'],90000],
  ['p29-integration',['--experimental-strip-types','tests/p29-integration.mjs'],90000],
  ['p30-integration',['--experimental-strip-types','tests/p30-integration.mjs'],90000],
  ['p18-long-horizon',['--experimental-strip-types','tests/p18-long-horizon.mjs'],90000],
  ['p20-temporal',['--experimental-strip-types','tests/p20-temporal-continuity.mjs'],90000],
];
function run(args,timeout){return new Promise(resolve=>{const p=spawn(process.execPath,args,{stdio:'pipe'});let out='',err='',done=false;const finish=(status,code=null)=>{if(done)return;done=true;clearTimeout(timer);resolve({status,code,stdout:out.slice(-5000),stderr:err.slice(-3000)});};p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('close',code=>finish(code===0?'PASS':'FAIL',code));p.on('error',e=>finish('FAIL',null,String(e)));const timer=setTimeout(()=>{p.kill('SIGTERM');setTimeout(()=>{try{p.kill('SIGKILL')}catch{};finish('TIMEOUT',null)},2000)},timeout);});}
const results=[];for(const [name,args,t] of cases){const started=Date.now();const r=await run(args,t);results.push({name,...r,durationMs:Date.now()-started});console.log(`${r.status.padEnd(7)} ${name} ${results.at(-1).durationMs}ms`);}
const summary={pass:161,generatedAt:new Date().toISOString(),total:results.length,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,timeouts:results.filter(r=>r.status==='TIMEOUT').length,results};
fs.writeFileSync('BIG_PASS_161_REGRESSION.json',JSON.stringify(summary,null,2));
process.exit(summary.failed||summary.timeouts?1:0);
