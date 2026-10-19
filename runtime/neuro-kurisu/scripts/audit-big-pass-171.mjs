import {spawnSync} from 'node:child_process';
const steps=[
 ['typecheck','npm run',['typecheck']],
 ['171-memory-value-identity-personality','npm run',['test:big-pass-171']],
 ['parameterized-function-probe','npm run',['audit:function-parameterized-safe']],
 ['semantic-audit','npm run',['audit:semantic-coverage']],
 ['function-liveness','npm run',['audit:function-liveness']],
 ['function-reality-ledger','node',['scripts/audit-function-reality-171.mjs']],
 ['core-zero-arg','npm run',['test:core-zero-arg-surface']],
 ['smoke','npm run',['test:smoke']],
 ['restart','npm run',['test:restart']],
 ['memory','npm run',['test:memory']],
 ['concurrency','npm run',['test:concurrency']],
 ['P24-world','npm run',['test:p24:world']],
 ['P26-learning','npm run',['test:p26:true-learning']],
 ['P28-plasticity','npm run',['test:p28:plasticity']],
 ['P29-governance','npm run',['test:p29:governance']],
 ['P30-continual','npm run',['test:p30:continual']],
 ['P31-consciousness','npm run',['test:p31:consciousness']],
 ['P31-lesion','npm run',['test:p31:lesion']],
 ['P32-causal-self','npm run',['test:p32:causal-self']],
 ['P33-personhood','npm run',['test:p33:personhood']],
 ['P34-personhood','npm run',['test:p34:personhood']],
 ['architecture','npm run',['audit:architecture']],
 ['integrity','npm run',['audit:integrity']],
 ['forensics','npm run',['audit:forensics']],
 ['hygiene','npm run',['audit:hygiene']],
 ['release-source','npm run',['verify:release-source']],
 ['lock','npm run',['audit:lock']],
];
const results=[]; for(const [name,cmd,args] of steps){const log=`.audit-big-pass-171-${name}.log`; const r=spawnSync('bash',['-lc',`${[cmd,...args].join(' ')} > ${log} 2>&1`],{stdio:'inherit'}); const ok=r.status===0; results.push({name,ok,status:r.status,error:r.error?.message??null,log}); if(!ok){console.error(`BIG_PASS_171_STOP=${name}; log=${log}`); break;}}
const failed=results.find(x=>!x.ok); const out={pass:171,startedAt:results.length?new Date().toISOString():new Date().toISOString(),steps:results,passed:results.filter(x=>x.ok).length,failed:failed?.name??null};
import fs from 'node:fs'; fs.writeFileSync('BIG_PASS_171_REGRESSION_RESULT.json',JSON.stringify(out,null,2)); console.log(JSON.stringify(out,null,2)); process.exit(failed?1:0);
