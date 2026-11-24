import { spawn } from 'node:child_process';
const checks=[
  ['typecheck','node scripts/typecheck-runtime.mjs'],
  ['repro','node --experimental-strip-types tests/big-pass-180-reproducibility.mjs'],
  ['lifecycle','node --experimental-strip-types tests/big-pass-180-lifecycle-function-closure.mjs'],
  ['recent-regression','node scripts/run-big-pass-179-regression.mjs'],
  ['adversarial','node --experimental-strip-types tests/big-pass-178-compound-adversarial.mjs'],
  ['consciousness','node --experimental-strip-types tests/big-pass-179-consciousness-battery.mjs'],
  ['p31-performance','node --experimental-strip-types tests/p31-performance.mjs'],
  ['long-500','node --experimental-strip-types tests/long-horizon-operational-500.mjs'],
  ['architecture','node scripts/audit-architecture.mjs'],
  ['integrity','node --experimental-strip-types scripts/audit-integrity.mjs'],
  ['forensics','node scripts/audit-forensics.mjs'],
  ['hygiene','node scripts/audit-source-hygiene.mjs'],
  ['release-source','node --experimental-strip-types scripts/verify-release-source.mjs'],
  ['lock','node scripts/verify-lock.mjs'],
  ['brain','node scripts/audit-brain.mjs'],
  ['project-state','node scripts/audit-project-state.mjs'],
  ['source-truth','node scripts/audit-source-truth.mjs'],
  ['subject-boundary','node scripts/audit-subject-boundary.mjs'],
  ['component-conflicts','node scripts/audit-component-conflicts.mjs'],
  ['function-reality','node --experimental-strip-types scripts/audit-function-reality-180.mjs'],
  ['release-freeze','node scripts/build-release-freeze-180.mjs']
];
const run=(cmd)=>new Promise((resolve)=>{const cp=spawn(cmd,{shell:true,stdio:'inherit',env:{...process.env,TERM:'dumb'}});cp.on('close',code=>resolve(code??1));});
const results=[];
for(const [name,cmd] of checks){console.log(`\n=== ${name} ===`);const code=await run(cmd);results.push({name,code,status:code===0?'PASS':'FAIL'});if(code!==0){console.error(`BIG_PASS_180_FREEZE=FAIL stage=${name}`);process.exit(code);}}
const out={pass:180,status:'PASS',checks:results,total:results.length};
console.log(JSON.stringify(out,null,2));
