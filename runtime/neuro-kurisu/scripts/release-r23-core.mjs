import { spawnSync } from 'node:child_process';
import process from 'node:process';
const NODE=process.execPath;
const strip=(file)=>[NODE,'--experimental-strip-types',file];
const plain=(file)=>[NODE,file];
const steps=[
 ['typecheck',plain('scripts/typecheck-runtime.mjs')],
 ['memory-value-byte',strip('tests/p2897-memory-value-per-byte.mjs')],
 ['memory-budget-regret',strip('tests/p2904-memory-budget-regret.mjs')],
 ['correction-capsules',strip('tests/p2898-correction-aware-capsules.mjs')],
 ['actionability-holdout',strip('tests/p2896-actionable-world-model.mjs')],
 ['multistep-world',strip('tests/p2903-multistep-world-model.mjs')],
 ['long-memory-battery',strip('tests/p2905-long-memory-experience-battery.mjs')],
 ['recurrent-ablation',strip('tests/p2906-bounded-recurrent-ablation.mjs')],
 ['operation-runtime',strip('tests/p2902-runtime-operation-evidence.mjs')],
 ['operation-coverage',plain('scripts/audit-operation-semantic-coverage.mjs')],
 ['semantic-audit',plain('scripts/audit-semantic-coverage.mjs')],
 ['anti-decoration',plain('scripts/audit-r22-anti-decoration.mjs')],
 ['mobile-equivalence',strip('tests/p2868-mobile-semantic-equivalence.mjs')],
 ['causal-calibration',strip('tests/p2842-causal-calibration.mjs')],
 ['architecture',plain('scripts/audit-architecture.mjs')],
 ['hygiene',plain('scripts/audit-source-hygiene.mjs')],
 ['forensics',plain('scripts/audit-forensics.mjs')],
 ['syntax',plain('scripts/audit-executable-syntax.mjs')],
 ['integrity',strip('scripts/audit-integrity.mjs')],
 ['manifests',plain('scripts/generate-manifests.mjs')],
 ['archive-manifest',plain('scripts/generate-archive-manifest.mjs')],
 ['contract',plain('scripts/audit-release-contract.mjs')],
 ['release-source',strip('scripts/verify-release-source.mjs')],
];
const results=[];const env={...process.env,TERM:process.env.TERM||'xterm'};
for(const [name,command] of steps){const [exe,...args]=command;const r=spawnSync(exe,args,{stdio:'inherit',timeout:120000,windowsHide:true,cwd:process.cwd(),env});results.push({name,status:r.status,signal:r.signal,error:r.error?.message??null});if(r.error||r.status!==0){console.error(JSON.stringify({pass:false,failed:name,results}));process.exit(1);}}
console.log(JSON.stringify({pass:true,profile:'r23-functional-core',steps:results.length,results}));
