import { spawnSync } from 'node:child_process';
const steps=[
  ['typecheck',['run','typecheck']],
  ['p2774',['run','test:p2774:model-time']],
  ['p2760',['run','test:p2760:continuum']],
  ['p2750',['run','test:p2750']],
  ['p2750-interference',['run','test:p2750:interference']],
  ['p2750-fallback',['run','test:p2750:fallback']],
  ['p2750-mobile',['run','test:p2750:mobile']],
  ['p2742',['run','test:p2742:causal']],
  ['p2734',['run','test:p2734']],
  ['p2726',['run','test:p2726']],
  ['p2720',['run','test:p2720:lifelong']],
  ['p2716-deep',['run','test:p2716:deep']],
  ['p2716-continual',['run','test:p2716:continual']],
  ['p2716-promotion',['run','test:p2716:promotion']],
  ['p2708-deep',['run','test:p2708:deep']],
  ['p2708-continual',['run','test:p2708:continual']],
  ['p2708-long',['run','test:p2708:long']],
  ['p2724-mobile',['run','test:p2724:mobile']],
];
for(const [label,args] of steps){
  const r=spawnSync('npm',args,{stdio:'inherit',shell:false,env:{...process.env,NPM_CONFIG_UPDATE_NOTIFIER:'false'}});
  if(r.status!==0){console.error(`P2774_RELEASE_CHECK=FAIL step=${label} status=${r.status}`);process.exit(r.status??1);}
  console.log(`P2774_RELEASE_STEP=PASS ${label}`);
}
console.log(`P2774_RELEASE_CHECK=PASS steps=${steps.length}`);
