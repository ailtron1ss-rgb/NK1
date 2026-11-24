import { execFileSync } from 'node:child_process';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const steps = [
  ['run','-s','typecheck'],
  ['run','-s','test:big-pass-208'],['run','-s','test:big-pass-211'],['run','-s','test:big-pass-212'],
  ['run','-s','test:big-pass-213'],['run','-s','test:big-pass-214'],['run','-s','test:big-pass-215'],
  ['run','-s','test:big-pass-216'],['run','-s','test:big-pass-217'],['run','-s','test:big-pass-218'],
  ['run','-s','test:big-pass-219'],['run','-s','test:big-pass-220'],['run','-s','test:big-pass-221'],
  ['run','-s','test:big-pass-222'],['run','-s','test:big-pass-223'],['run','-s','test:big-pass-224'],
  ['run','-s','test:big-pass-225-228'],['run','-s','test:big-pass-229-233'],
  ['run','-s','audit:function-parameterized-safe'],['run','-s','audit:function-liveness'],
  ['run','-s','audit:semantic-coverage'],['run','-s','audit:architecture'],['run','-s','audit:integrity'],
  ['run','-s','audit:hygiene'],['run','-s','audit:syntax'],['run','-s','audit:contract'],['run','-s','audit:forensics'],
  ['run','-s','verify:release-source'],['run','-s','manifests'],['run','-s','manifest:archive'],['run','-s','audit:archive'],
];
for (const args of steps) execFileSync(npm,args,{stdio:'inherit'});
