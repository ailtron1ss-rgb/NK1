import { execFileSync } from 'node:child_process';
const commands=[
  ['npm',['run','typecheck']],
  ['npm',['run','test:big-pass-294']],
  ['npm',['run','test:big-pass-294:core']],
  ['npm',['run','audit:b294:reality']],
  ['npm',['run','audit:architecture']],
  ['npm',['run','audit:integrity']],
  ['npm',['run','audit:forensics']],
  ['npm',['run','audit:hygiene']],
  ['npm',['run','audit:contract']],
  ['npm',['run','audit:source-truth']],
  ['npm',['run','audit:full']],
  ['npm',['run','test:mobile:horizon:1000']],
];
for(const [cmd,args] of commands) execFileSync(cmd,args,{stdio:'inherit'});
console.log('RELEASE_B294=PASS');
