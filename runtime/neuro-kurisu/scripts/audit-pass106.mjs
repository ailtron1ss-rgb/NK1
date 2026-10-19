import { execFileSync } from 'node:child_process';
const commands=[
  ['typecheck'],['test:big-pass-106'],['test:big-pass-106:migration'],['test:big-pass-105'],['test:big-pass-104'],['test:big-pass-103'],
  ['audit:evidence-gating'],['audit:pass104'],['audit:experimental-protocol'],['audit:contract'],['verify:release-source'],['audit:source-truth'],['audit:project-state'],
  ['audit:architecture'],['audit:core-ownership'],['audit:component-conflicts'],['audit:hygiene'],['audit:forensics'],['audit:integrity'],['audit:syntax'],['server:smoke'],
  ['test:mobile:1000'],['test:long-horizon:operational:500'],['test:long-horizon:operational:1000'],['manifest:archive'],['audit:archive']
];
for(const [script] of commands){console.log(`PASS106_STEP=${script}`);execFileSync('npm',['run',script],{stdio:'inherit'});}
console.log('AUDIT_PASS106=PASS');
