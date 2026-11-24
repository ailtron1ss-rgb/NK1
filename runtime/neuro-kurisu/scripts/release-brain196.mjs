import { spawnSync } from 'node:child_process';

const commands = [
  ['npm',['run','typecheck']],
  ['npm',['run','test:big-pass-196']],
  ['npm',['run','test:big-pass-196:core']],
  ['npm',['run','test:big-pass-195']],
  ['npm',['run','test:big-pass-195:core']],
  ['npm',['run','test:big-pass-195:learning-core']],
  ['npm',['run','test:big-pass-187']],
  ['npm',['run','test:big-pass-185']],
  ['npm',['run','test:big-pass-183']],
  ['npm',['run','test:p16']],
  ['npm',['run','test:p17']],
  ['npm',['run','test:p19']],
  ['npm',['run','test:p20:temporal']],
  ['npm',['run','test:p20:session']],
  ['npm',['run','test:p22:phone']],
  ['npm',['run','test:p25:science']],
  ['npm',['run','test:p26:true-learning']],
  ['npm',['run','audit:function-liveness']],
  ['npm',['run','audit:function-parameterized-safe']],
  ['npm',['run','audit:semantic-coverage']],
  ['npm',['run','audit:full']],
  ['npm',['run','audit:architecture']],
  ['npm',['run','audit:integrity']],
  ['npm',['run','audit:forensics']],
  ['npm',['run','audit:hygiene']],
  ['npm',['run','audit:syntax']],
  ['npm',['run','audit:contract']],
  ['npm',['run','verify:release-source']],
];

for (const [cmd,args] of commands) {
  const result = spawnSync(cmd,args,{stdio:'inherit',cwd:process.cwd(),env:process.env});
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('RELEASE_BRAIN196=PASS');
