import { execFileSync } from 'node:child_process';
const steps=[
  ['npm','run','typecheck'],
  ['npm','run','test:b280:neural'],
  ['npm','run','test:b280:migration'],
  ['npm','run','test:b280:core'],
  ['npm','run','audit:architecture'],
  ['npm','run','audit:integrity'],
  ['npm','run','audit:hygiene'],
  ['npm','run','audit:forensics'],
  ['npm','run','audit:contract'],
  ['npm','run','audit:lock'],
  ['npm','run','verify:release-source'],
  ['npm','run','doctor'],
  ['npm','run','audit:syntax'],
  ['npm','run','audit:full']
];
for(const [cmd,...args] of steps) execFileSync(cmd,args,{stdio:'inherit'});
console.log('RELEASE_B280=PASS');
