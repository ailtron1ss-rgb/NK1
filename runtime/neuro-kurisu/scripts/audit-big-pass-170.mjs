import {spawnSync} from 'node:child_process';
const commands = [
  ['typecheck'],
  ['test:big-pass-170:personality'],
  ['audit:function-parameterized-safe'],
  ['audit:semantic'],
  ['test:core-zero-arg-surface'],
  ['test:smoke'],
  ['test:restart'],
  ['test:memory'],
  ['test:concurrency'],
  ['test:p24:world'],
  ['test:p26:true-learning'],
  ['test:p28:plasticity'],
  ['test:p29:governance'],
  ['test:p30:continual'],
  ['test:p31:consciousness'],
  ['test:p31:lesion'],
  ['test:p32:causal-self'],
  ['test:p33:personhood'],
  ['test:p34:personhood'],
  ['test:p35:semantic-body'],
  ['test:p37'],
  ['test:p37:integration'],
  ['test:p41:semantic-perception'],
  ['test:p41:native'],
  ['test:p41:integration'],
  ['test:big-pass-168'],
  ['test:big-pass-169'],
  ['audit:architecture'],
  ['audit:integrity'],
  ['audit:forensics'],
  ['audit:hygiene'],
  ['verify:release-source'],
  ['audit:lock'],
  ['audit:brain'],
];
const results=[]; let failed=false;
for(const [script] of commands){
  const r=spawnSync('npm',['run',script],{stdio:'inherit'});
  const ok=r.status===0;
  results.push({script,status:r.status,ok});
  if(!ok){failed=true;break;}
}
console.log(JSON.stringify({pass:170,ok:!failed,completed:results.length,results},null,2));
process.exit(failed?1:0);
