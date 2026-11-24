import { execFileSync } from 'node:child_process';
const steps=[
  ['typecheck',['run','-s','typecheck']],
  ['b274-standalone',['run','-s','test:big-pass-274']],
  ['b274-evaluator',['run','-s','test:big-pass-274:evaluator']],
  ['b274-core',['run','-s','test:big-pass-274:core']],
  ['b274-migration',['run','-s','test:big-pass-274:migration']],
  ['audit-full',['run','-s','audit:full']],
  ['audit-architecture',['run','-s','audit:architecture']],
  ['audit-integrity',['run','-s','audit:integrity']],
  ['audit-hygiene',['run','-s','audit:hygiene']],
  ['audit-syntax',['run','-s','audit:syntax']],
  ['audit-contract',['run','-s','audit:contract']],
  ['audit-forensics',['run','-s','audit:forensics']],
  ['audit-lock',['run','-s','audit:lock']],
  ['verify-release-source',['run','-s','verify:release-source']],
  ['manifest',['run','-s','manifest:archive']],
  ['archive',['run','-s','audit:archive']],
];
for(const [name,args] of steps){console.log(`\n=== ${name} ===`);execFileSync('npm',['-s',...args],{stdio:'inherit'});}
console.log('\nB274 RELEASE=PASS');
