import { spawnSync } from 'node:child_process';
const commands=[
  'typecheck',
  'test:big-pass-269','test:big-pass-269:migration','test:big-pass-269:core',
  'test:big-pass-270','test:big-pass-270:migration','test:big-pass-270:core','test:big-pass-270:cycle',
  'test:big-pass-271','test:big-pass-271:core','test:big-pass-271:cycle',
  'test:big-pass-272','test:big-pass-272:evaluator','test:big-pass-272:core','test:big-pass-272:migration','test:big-pass-272:cycle',
  'audit:full','audit:architecture','audit:integrity','audit:hygiene','audit:syntax','audit:contract','audit:forensics','audit:lock','verify:release-source','doctor','manifest:archive','audit:archive'
];
for(const script of commands){ const r=spawnSync('npm',['run','-s',script],{stdio:'inherit',env:process.env}); if(r.status!==0){console.error(`RELEASE_B272_FAILED=${script}`);process.exit(r.status??1);} }
console.log('RELEASE_B272=PASS');
