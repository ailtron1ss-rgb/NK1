import { spawnSync } from 'node:child_process';
import process from 'node:process';
const NODE=process.execPath;
const strip=(file)=>[NODE,'--experimental-strip-types',file];
const plain=(file)=>[NODE,file];
const steps=[
 ['typecheck',plain('scripts/typecheck-runtime.mjs')],
 ['r25-architecture-integration',strip('tests/r25-neurocore-architecture-integration.mjs')],
 ['b262-multitimescale',strip('tests/big-pass-262-multitimescale-world-model.mjs')],
 ['memory-causal-ab',strip('tests/p2910-causal-memory-ab-retained-control.mjs')],
 ['anti-decoration',plain('scripts/audit-r22-anti-decoration.mjs')],
 ['integrity',strip('scripts/audit-integrity.mjs')],
 ['contract',plain('scripts/audit-release-contract.mjs')],
 ['release-source',strip('scripts/verify-release-source.mjs')],
];
const results=[];const env={...process.env,TERM:process.env.TERM||'xterm'};
for(const [name,command] of steps){const [exe,...args]=command;const r=spawnSync(exe,args,{stdio:'inherit',timeout:180000,windowsHide:true,cwd:process.cwd(),env});results.push({name,status:r.status,signal:r.signal,error:r.error?.message??null});if(r.error||r.status!==0){console.error(JSON.stringify({pass:false,failed:name,results}));process.exit(1);}}
console.log(JSON.stringify({pass:true,profile:'r25-functional-core',steps:results.length,results}));
