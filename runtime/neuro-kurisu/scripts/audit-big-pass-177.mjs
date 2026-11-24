import { spawnSync } from 'node:child_process';
const steps = [
  ['typecheck', 'npm', ['run','typecheck']],
  ['big-pass-177', 'npm', ['run','test:big-pass-177']],
  ['parameterized', 'npm', ['run','audit:function-parameterized-safe']],
  ['semantic', 'npm', ['run','audit:semantic-coverage']],
  ['zero-arg', 'npm', ['run','test:core-zero-arg-surface']],
  ['smoke', 'npm', ['run','test:smoke']],
  ['restart', 'npm', ['run','test:restart']],
  ['memory', 'npm', ['run','test:memory']],
  ['concurrency', 'npm', ['run','test:concurrency']],
  ['p24', 'npm', ['run','test:p24:world']],
  ['p26', 'npm', ['run','test:p26:true-learning']],
  ['p28', 'npm', ['run','test:p28:plasticity']],
  ['p29', 'npm', ['run','test:p29:governance']],
  ['p30', 'npm', ['run','test:p30:continual']],
  ['p31', 'npm', ['run','test:p31:consciousness']],
  ['p31-lesion', 'npm', ['run','test:p31:lesion']],
  ['p32', 'npm', ['run','test:p32:causal-self']],
  ['p33', 'npm', ['run','test:p33:personhood']],
  ['p34', 'npm', ['run','test:p34:personhood']],
  ['p35', 'npm', ['run','test:p35:semantic-body']],
  ['p37', 'npm', ['run','test:p37:integration']],
  ['p41', 'npm', ['run','test:p41:integration']],
  ['architecture', 'npm', ['run','audit:architecture']],
  ['integrity', 'npm', ['run','audit:integrity']],
  ['forensics', 'npm', ['run','audit:forensics']],
  ['hygiene', 'npm', ['run','audit:hygiene']],
  ['release-source', 'npm', ['run','verify:release-source']],
  ['lock', 'npm', ['run','audit:lock']],
];
for (const [name, cmd, args] of steps) {
  console.log(`\n[${name}]`);
  const r = spawnSync(cmd,args,{stdio:'inherit',timeout:45000,env:process.env});
  if (r.error?.code === 'ETIMEDOUT') { console.error(`${name}=TIMEOUT`); process.exitCode=2; break; }
  if (r.status !== 0) { console.error(`${name}=FAIL status=${r.status}`); process.exit(r.status ?? 1); }
  console.log(`${name}=PASS`);
}
console.log(process.exitCode ? `BIG_PASS_177_GATE=NOT_COMPLETE:${process.exitCode}` : 'BIG_PASS_177_GATE=PASS');
