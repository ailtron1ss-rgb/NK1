import { spawnSync } from 'node:child_process';

const steps=[
  ['typecheck',['run','typecheck']],
  ['p2750',['run','test:p2750']],
  ['interference',['run','test:p2750:interference']],
  ['fallback',['run','test:p2750:fallback']],
  ['mobile-compaction',['run','test:p2750:mobile']],
  ['p2742',['run','test:p2742:causal']],
  ['p2734',['run','test:p2734']],
  ['p2726',['run','test:p2726']],
  ['p2720',['run','test:p2720:lifelong']],
  ['p2716-deep',['run','test:p2716:deep']],
  ['p2716-continual',['run','test:p2716:continual']],
  ['audit-full',['run','audit:full']],
  ['audit-architecture',['run','audit:architecture']],
  ['audit-integrity',['run','audit:integrity']],
  ['audit-forensics',['run','audit:forensics']],
  ['audit-hygiene',['run','audit:hygiene']],
  ['audit-syntax',['run','audit:syntax']],
  ['audit-contract',['run','audit:contract']],
  ['release-source',['run','verify:release-source']],
  ['manifests',['run','manifests']],
  ['archive-manifest',['run','manifest:archive']],
  ['archive-verify',['run','audit:archive']],
];
for(const [label,args] of steps){
  const r=spawnSync('npm',args,{stdio:'inherit',shell:false,env:{...process.env,NPM_CONFIG_UPDATE_NOTIFIER:'false'}});
  if(r.status!==0){console.error(`P2750_RELEASE_CHECK=FAIL step=${label} status=${r.status}`);process.exit(r.status??1);}
  console.log(`P2750_RELEASE_STEP=PASS ${label}`);
}
console.log(`P2750_RELEASE_CHECK=PASS steps=${steps.length}`);
