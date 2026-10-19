import { execFileSync } from 'node:child_process';
const steps=[
  ['typecheck',['run','-s','typecheck']],
  ['b281-neural',['run','-s','test:b281:neural']],
  ['b281-hidden',['run','-s','test:b281:hidden']],
  ['b281-core',['run','-s','test:b281:core']],
  ['b281-migration',['run','-s','test:b281:migration']],
  ['b280-neural',['run','-s','test:b280:neural']],
  ['b280-core',['run','-s','test:b280:core']],
  ['b280-migration',['run','-s','test:b280:migration']],
  ['b279-neural',['exec','node','--experimental-strip-types','tests/big-pass-279-neural-attractor.mjs']],
  ['b279-hidden',['exec','node','--experimental-strip-types','tests/big-pass-279-hidden-attractor.mjs']],
  ['b279-lifecycle',['exec','node','--experimental-strip-types','tests/big-pass-279-lifecycle.mjs']],
  ['b279-migration',['exec','node','--experimental-strip-types','tests/big-pass-279-migration.mjs']],
  ['audit-architecture',['run','-s','audit:architecture']],
  ['audit-integrity',['run','-s','audit:integrity']],
  ['audit-forensics',['run','-s','audit:forensics']],
  ['audit-hygiene',['run','-s','audit:hygiene']],
  ['audit-contract',['run','-s','audit:contract']],
  ['audit-lock',['run','-s','audit:lock']],
  ['release-source',['run','-s','verify:release-source']],
  ['doctor',['run','-s','doctor']],
  ['manifest',['run','-s','manifest:archive']],
  ['archive',['run','-s','audit:archive']],
];
for(const [name,args] of steps){console.log(`\n=== ${name} ===`);execFileSync('npm',['-s',...args],{stdio:'inherit'});}
console.log('\nB281 RELEASE FUNCTIONAL+STATIC=PASS');
