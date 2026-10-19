import { spawnSync } from 'node:child_process';
import process from 'node:process';
const NODE=process.execPath; const strip=f=>[NODE,'--experimental-strip-types',f]; const plain=f=>[NODE,f];
const steps=[
 ['operation-coverage',plain('scripts/audit-operation-semantic-coverage.mjs')],
 ['semantic-audit',plain('scripts/audit-semantic-coverage.mjs')],
 ['architecture',plain('scripts/audit-architecture.mjs')],
 ['hygiene',plain('scripts/audit-source-hygiene.mjs')],
 ['forensics',plain('scripts/audit-forensics.mjs')],
 ['syntax',plain('scripts/audit-executable-syntax.mjs')],
 ['integrity',strip('scripts/audit-integrity.mjs')],
 ['contract',plain('scripts/audit-release-contract.mjs')],
 ['release-source',strip('scripts/verify-release-source.mjs')],
];
const results=[]; const env={...process.env,TERM:process.env.TERM||'xterm'};
for(const [name,cmd] of steps){const [exe,...args]=cmd;const r=spawnSync(exe,args,{stdio:'inherit',timeout:300000,windowsHide:true,cwd:process.cwd(),env});results.push({name,status:r.status,signal:r.signal,error:r.error?.message??null});if(r.error||r.status!==0){console.error(JSON.stringify({pass:false,failed:name,results}));process.exit(1);}}
console.log(JSON.stringify({pass:true,profile:'r24-heavy-release-audits',steps:results.length,results}));
