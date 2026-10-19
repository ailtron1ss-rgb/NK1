import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const steps=[
 ['typecheck','npm run',['typecheck']],
 ['big-pass-172-emotion-interoceptive','npm run',['test:big-pass-172']],
 ['big-pass-171-memory-value-identity-personality','npm run',['test:big-pass-171']],
 ['big-pass-170-personality','npm run',['test:big-pass-170:personality']],
 ['big-pass-169-cognitive','npm run',['test:big-pass-169']],
 ['big-pass-169-recovery','npm run',['test:big-pass-169:recovery']],
 ['p66-p68-legacy','node',['--experimental-strip-types','tests/p66-p68-integration.mjs']],
 ['big-pass-166-world','npm run',['test:big-pass-166-fast']],
 ['big-pass-165-memory-economy','npm run',['test:big-pass-165']],
 ['big-pass-165-longitudinal','npm run',['test:big-pass-165:longitudinal']],
 ['big-pass-165-knockout','npm run',['test:big-pass-165:knockout']],
 ['public-utilities','npm run',['test:function-public-utilities']],
 ['parameterized-function-probe','npm run',['audit:function-parameterized-safe']],
 ['semantic-coverage','npm run',['audit:semantic-coverage']],
 ['function-liveness','npm run',['audit:function-liveness']],
 ['function-reality-172','node',['scripts/audit-function-reality-172.mjs']],
 ['core-zero-arg','npm run',['test:core-zero-arg-surface']],
 ['smoke','npm run',['test:smoke']],
 ['restart','npm run',['test:restart']],
 ['memory','npm run',['test:memory']],
 ['concurrency','npm run',['test:concurrency']],
 ['p24-world','npm run',['test:p24:world']],
 ['p26-learning','npm run',['test:p26:true-learning']],
 ['p28-plasticity','npm run',['test:p28:plasticity']],
 ['p29-governance','npm run',['test:p29:governance']],
 ['p30-continual','npm run',['test:p30:continual']],
 ['p31-consciousness','npm run',['test:p31:consciousness']],
 ['p31-lesion','npm run',['test:p31:lesion']],
 ['p32-causal-self','npm run',['test:p32:causal-self']],
 ['p33-personhood','npm run',['test:p33:personhood']],
 ['p34-personhood','npm run',['test:p34:personhood']],
 ['architecture','npm run',['audit:architecture']],
 ['integrity','npm run',['audit:integrity']],
 ['forensics','npm run',['audit:forensics']],
 ['hygiene','npm run',['audit:hygiene']],
 ['release-source','npm run',['verify:release-source']],
 ['lock','npm run',['audit:lock']],
 ['brain','npm run',['audit:brain']],
];
const results=[];
for(const [name,cmd,args] of steps){
  const log=`.audit-big-pass-172-${name}.log`;
  const r=spawnSync('bash',['-lc',`${[cmd,...args].join(' ')} > ${log} 2>&1`],{stdio:'inherit'});
  const ok=r.status===0; results.push({name,ok,status:r.status,error:r.error?.message??null,log});
  if(!ok){console.error(`BIG_PASS_172_STOP=${name}; log=${log}`); break;}
}
const failed=results.find(x=>!x.ok);
const out={pass:172,generatedAt:new Date().toISOString(),steps:results,passed:results.filter(x=>x.ok).length,total:steps.length,failed:failed?.name??null};
fs.writeFileSync('BIG_PASS_172_REGRESSION_RESULT.json',JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
process.exit(failed?1:0);
