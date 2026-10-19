import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const config={performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:true,operationalPulseEvery:2,checkpointMaxDirtyCycles:1,checkpointMinIntervalMs:0};
const worker=new URL('./big-pass-319-crash-worker.mjs',import.meta.url).pathname;
const points=['after-tmp-write','after-file-fsync','after-backup','before-rename','after-rename'];
function crashWorker(stateFile,point){
  const r=spawnSync(process.execPath,['--experimental-strip-types',worker,stateFile,point],{encoding:'utf8',timeout:120000,env:{...process.env,NEURO_CRASH_INJECT:point,NEURO_RUNTIME_PROFILE:'mobile',NEURO_CHECKPOINT_MIN_INTERVAL_MS:'0',NEURO_CHECKPOINT_MAX_DIRTY_CYCLES:'1'}});
  assert.equal(r.signal,'SIGKILL',`B319 ${point} did not receive injected SIGKILL: status=${r.status} signal=${r.signal} stderr=${r.stderr}`);
  return r;
}

async function seed(dir){
 const file=join(dir,'organism.json');
 const store=new FileStateStore(file,{backupEverySaves:1,directoryFsyncEverySaves:1});
 const core=new OrganismCore(store,config); await core.init(); await core.flush(); await core.flush();
 const durable=await store.load();
 return {file,tick:durable.state.tick,size:(await stat(file)).size};
}

async function main(){
 const root=await mkdtemp(join(tmpdir(),'neuro-kurisu-b319-matrix-'));
 const matrix={};
 try{
  for (const point of points){
   const dir=await mkdtemp(join(root,`${point}-`));
   const {file,tick,size}=await seed(dir);
   crashWorker(file,point);
   let primary=null; let primaryValid=false;
   try { primary=JSON.parse(await readFile(file,'utf8')); primaryValid=Boolean(primary?.state); } catch {}
   const recoveryStore=new FileStateStore(file,{backupEverySaves:1});
   const recovered=await recoveryStore.load();
   assert.ok(recovered?.state,'B319 recovery produced no state');
   assert.equal(recovered.state.tick,tick,`B319 ${point} recovered wrong tick`);
   const runtimeStore=new FileStateStore(file,{backupEverySaves:1,directoryFsyncEverySaves:1});
   const runtime=new OrganismCore(runtimeStore,config); await runtime.init();
   await runtime.flush();
   const post=await runtimeStore.load();
   assert.ok(post?.state,'B319 ${point} resumed runtime failed to persist');
   assert.equal(post.state.tick,tick,`B319 ${point} recovery unexpectedly changed tick`);
   matrix[point]={primaryValid,recoveredFromBackup:!primaryValid || primary?.state?.tick===tick,recoveredTick:recovered.state.tick,postResumeTick:post.state.tick,seedBytes:size};
  }
  // Explicit corruption contract on a state with a known backup.
  const cdir=await mkdtemp(join(root,'corruption-')); const {file,tick}=await seed(cdir);
  await writeFile(file,'{"broken":','utf8');
  const recovered=await new FileStateStore(file,{backupEverySaves:1}).load();
  assert.equal(recovered.state.tick,tick,'B319 corrupted-primary recovery failed');
  console.log(JSON.stringify({pass:true,crashPointCount:points.length,matrix,corruptionRecovery:true},null,2));
 } finally { await rm(root,{recursive:true,force:true}); }
}
await main();
