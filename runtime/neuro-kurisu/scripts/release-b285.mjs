import {execFileSync} from 'node:child_process';
const commands=[
  ['npm',['run','typecheck']],
  ['npm',['run','test:big-pass-285:life']],
  ['npm',['run','test:big-pass-285:future']],
  ['npm',['run','test:big-pass-285:core']],
  ['npm',['run','test:big-pass-285:migration']],
  ['npm',['run','audit:full']],
  ['npm',['run','audit:architecture']],
  ['npm',['run','audit:integrity']],
  ['npm',['run','audit:forensics']],
  ['npm',['run','audit:hygiene']],
  ['npm',['run','audit:syntax']],
  ['npm',['run','audit:contract']],
  ['npm',['run','audit:lock']],
  ['npm',['run','verify:release-source']],
  ['npm',['run','doctor']],
  ['npm',['run','audit:brain']],
  ['npm',['run','manifests']],
  ['npm',['run','manifest:archive']],
  ['npm',['run','audit:archive']],
];
for(const [cmd,args] of commands){console.log(`\n>>> ${cmd} ${args.join(' ')}`);execFileSync(cmd,args,{stdio:'inherit'});}
console.log('\nB285_RELEASE=PASS');
