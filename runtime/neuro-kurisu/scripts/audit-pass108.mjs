import { execFileSync } from 'node:child_process';
const commands=[
 'typecheck','test:big-pass-108','test:big-pass-108:migration','test:big-pass-108:core','test:big-pass-107','test:big-pass-106','test:big-pass-105','test:big-pass-104','test:big-pass-103',
 'audit:cognitive-research-battery','audit:cognitive-battery-repro','audit:experimental-protocol','audit:evidence-gating','audit:pass104',
 'verify:release-source','audit:source-truth','audit:project-state','audit:architecture','audit:core-ownership','audit:component-conflicts','audit:hygiene','audit:forensics','audit:integrity','audit:syntax','server:smoke','manifest:archive','audit:archive'
];
for(const script of commands){console.log(`PASS108_STEP=${script}`);execFileSync('npm',['run',script],{stdio:'inherit'});}
console.log('AUDIT_PASS108_TARGETED=PASS');
