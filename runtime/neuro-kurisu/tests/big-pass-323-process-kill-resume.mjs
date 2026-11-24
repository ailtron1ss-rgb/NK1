import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const outDir = join(process.env.NK_B323_REPORT_DIR ?? 'state/process-life-b323');
await (await import('node:fs/promises')).mkdir(outDir, { recursive:true });
const dir = await mkdtemp(join(tmpdir(),'neuro-kurisu-b323-'));
const stateFile = join(dir,'life-state.json');
const worker = join(dir,'worker.mjs');

const workerSource = `
import { FileStateStore } from ${JSON.stringify(join(root,'src/organism/persistence/FileStateStore.ts'))};
const file = process.env.NK_STATE_FILE;
const max = Number(process.env.NK_WORKER_CYCLES || 6);
const killAfter = Number(process.env.NK_KILL_AFTER || 0);
const mode = process.env.NK_WORKER_MODE || 'run';
const store = new FileStateStore(file,{backupEverySaves:2,directoryFsyncEverySaves:1});
let s = (await store.load()) || {version:1,tick:0,learning:0,closures:0,actions:0,session:0,history:[]};
s.session += 1;
for(let i=0;i<max;i++){
  s.tick += 1;
  s.actions += 1;
  s.learning += 1;
  s.closures += 1;
  s.history.push({tick:s.tick,session:s.session,learning:s.learning});
  if(s.history.length>32) s.history=s.history.slice(-32);
  await store.save(s);
  console.log(JSON.stringify({session:s.session,tick:s.tick,learning:s.learning,closures:s.closures}));
  if(mode==='kill' && s.tick===killAfter) process.kill(process.pid,'SIGKILL');
}
`;
await writeFile(worker, workerSource, 'utf8');

function run(extraEnv) {
  return new Promise((resolve,reject)=>{
    const p = spawn(process.execPath,['--experimental-strip-types',worker],{cwd:root,env:{...process.env,NK_STATE_FILE:stateFile,...extraEnv},stdio:['ignore','pipe','pipe']});
    let stdout=''; let stderr='';
    p.stdout.on('data',d=>stdout+=d);
    p.stderr.on('data',d=>stderr+=d);
    p.on('error',reject);
    p.on('close',(code,signal)=>resolve({code,signal,stdout,stderr}));
  });
}

try {
  const first = await run({NK_WORKER_MODE:'kill',NK_KILL_AFTER:'3',NK_WORKER_CYCLES:'8'});
  assert.equal(first.signal,'SIGKILL','first process should be killed by SIGKILL');
  const resumed = await run({NK_WORKER_MODE:'run',NK_WORKER_CYCLES:'4'});
  assert.equal(resumed.code,0,`resume worker failed: ${resumed.stderr}`);
  const state = JSON.parse(await readFile(stateFile,'utf8'));
  assert.equal(state.tick,7,'resume did not continue from durable tick');
  assert.equal(state.learning,7,'learning did not survive process kill');
  assert.equal(state.closures,7,'closure count did not survive process kill');
  assert.equal(state.session,2,'resume did not start a new process session');
  assert.ok(state.history.some(x=>x.session===1 && x.tick===3),'pre-kill evidence missing');
  assert.ok(state.history.some(x=>x.session===2 && x.tick===7),'post-resume evidence missing');
  const report={gate:'B323_PROCESS_KILL_RESUME',version:'35.6.1',verdict:'HOST_PROCESS_LIFECYCLE_VERIFIED',first:{code:first.code,signal:first.signal,stdout:first.stdout.trim().split(/\n+/)},resumed:{code:resumed.code,signal:resumed.signal,stdout:resumed.stdout.trim().split(/\n+/)},finalState:state,limitations:['This proves process kill/resume against a durable file on host; it is not Android OEM/Doze certification.','Physical-device certification remains gated by B321 REAL_DEVICE_VERIFIED evidence.']};
  await writeFile(join(outDir,'report.json'),JSON.stringify(report,null,2));
  console.log('BIG_PASS_323_PROCESS_KILL_RESUME=PASS',JSON.stringify({tick:state.tick,learning:state.learning,closures:state.closures,session:state.session}));
} finally { await rm(dir,{recursive:true,force:true}); }
