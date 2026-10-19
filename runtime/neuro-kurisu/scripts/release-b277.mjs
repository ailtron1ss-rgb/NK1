import { execFileSync } from 'node:child_process';
const steps=[
  ['typecheck',['run','-s','typecheck']],
  ['b277-standalone',['run','-s','test:big-pass-277']],
  ['b277-independent',['run','-s','test:big-pass-277:independent']],
  ['b277-core',['run','-s','test:big-pass-277:core']],
  ['b277-migration',['run','-s','test:big-pass-277:migration']],
  ['b276-regression',['run','-s','test:big-pass-276']],
  ['b276-independent',['run','-s','test:big-pass-276:independent']],
  ['b276-core',['run','-s','test:big-pass-276:core']],
  ['b276-migration',['run','-s','test:big-pass-276:migration']],
  ['audit-full',['run','-s','audit:full']],
  ['audit-architecture',['run','-s','audit:architecture']],
  ['audit-integrity',['run','-s','audit:integrity']],
  ['audit-forensics',['run','-s','audit:forensics']],
  ['audit-hygiene',['run','-s','audit:hygiene']],
  ['audit-syntax',['run','-s','audit:syntax']],
  ['audit-contract',['run','-s','audit:contract']],
  ['audit-lock',['run','-s','audit:lock']],
  ['release-source',['run','-s','verify:release-source']],
  ['doctor',['run','-s','doctor']],
  ['manifest',['run','-s','manifest:archive']],
  ['archive',['run','-s','audit:archive']],
];
for(const [name,args] of steps){console.log(`\n=== ${name} ===`);execFileSync('npm',['-s',...args],{stdio:'inherit'});}
console.log('\nB277 RELEASE=PASS');
