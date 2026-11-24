import { spawnSync } from 'node:child_process';

const steps=[
  ['typecheck',['run','typecheck']],
  ['continuum-memory',['run','test:p2760:continuum']],
  ['p2750-core',['run','test:p2750']],
  ['p2750-interference',['run','test:p2750:interference']],
  ['p2750-fallback',['run','test:p2750:fallback']],
  ['p2750-mobile-compaction',['run','test:p2750:mobile']],
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
  ['organism-smoke',['run','test:smoke']],
  ['server-smoke',['run','server:smoke']],
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
  if(r.status!==0){console.error(`P2760_RELEASE_CHECK=FAIL step=${label} status=${r.status}`);process.exit(r.status??1);}
  console.log(`P2760_RELEASE_STEP=PASS ${label}`);
}
console.log(`P2760_RELEASE_CHECK=PASS steps=${steps.length}`);
