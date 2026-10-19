import { spawnSync } from 'node:child_process';

const commands = [
  ['typecheck'],
  ['test:big-pass-273'],
  ['test:big-pass-273:evaluator'],
  ['test:big-pass-273:migration'],
  ['test:big-pass-273:core'],
  ['test:big-pass-273:cycle'],
  ['audit:full'],
  ['audit:architecture'],
  ['audit:integrity'],
  ['audit:forensics'],
  ['audit:hygiene'],
  ['audit:syntax'],
  ['audit:contract'],
  ['audit:lock'],
  ['verify:release-source'],
  ['manifest:archive'],
  ['audit:archive']
];

for (const [script] of commands) {
  const result = spawnSync('npm', ['run', script], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
