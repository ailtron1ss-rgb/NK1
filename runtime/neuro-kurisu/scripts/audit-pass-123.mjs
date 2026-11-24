import { spawnSync } from 'node:child_process';
const commands = [
  ['node',['--experimental-strip-types','tests/big-pass-116-predictive-transfer.mjs']],
  ['node',['--experimental-strip-types','tests/big-pass-117-causal-development.mjs']],
  ['node',['--experimental-strip-types','tests/big-pass-117-core-learning-loop.mjs']],
  ['node',['--experimental-strip-types','tests/big-pass-118-long-horizon-learning.mjs']],
  ['node',['--experimental-strip-types','tests/big-pass-119-developmental-synthesis.mjs']],
  ['node',['--experimental-strip-types','tests/big-pass-119-core-development-loop.mjs']],
  ['node',['--experimental-strip-types','tests/big-pass-120-developmental-executive.mjs']],
  ['node',['--experimental-strip-types','tests/big-pass-120-core-development-executive.mjs']],
  ['node',['--experimental-strip-types','tests/big-pass-121-meta-developmental.mjs']],
  ['node',['--experimental-strip-types','tests/big-pass-121-core-meta-developmental.mjs']],
  ['node',['--experimental-strip-types','tests/big-pass-122-personal-curriculum.mjs']],
  ['node',['--experimental-strip-types','tests/big-pass-122-core-personal-curriculum.mjs']],
  ['node',['--experimental-strip-types','tests/big-pass-123-developmental-portfolio.mjs']],
  ['node',['--experimental-strip-types','tests/big-pass-123-context-history.mjs']],
  ['node',['--experimental-strip-types','tests/big-pass-123-core-portfolio.mjs']],
];
for (const [cmd,args] of commands) {
  const r=spawnSync(cmd,args,{stdio:'inherit'});
  if (r.status!==0) process.exit(r.status??1);
}
console.log('AUDIT_PASS_123=PASS tests=15');
