import { spawnSync } from 'node:child_process';

const commands = [
  ['typecheck'],
  ['test:b259-canonical-brain'], ['test:big-pass-260'], ['test:big-pass-261'], ['test:big-pass-261-core'],
  ['test:b262:world'], ['test:b262:core'], ['test:b263:causal'], ['test:b263:core'],
  ['test:b264:policy'], ['test:b264:core'],
  ['test:big-pass-265'], ['test:big-pass-265:migration'], ['test:big-pass-265:core'],
  ['test:big-pass-266'], ['test:big-pass-266:migration'], ['test:big-pass-266:core'],
  ['test:big-pass-267'], ['test:big-pass-267:core'], ['test:big-pass-267:migration'],
  ['test:big-pass-268'], ['test:big-pass-268:core'],
  ['audit:full'], ['audit:architecture'], ['audit:integrity'], ['audit:hygiene'], ['audit:syntax'],
  ['audit:contract'], ['audit:forensics'], ['verify:release-source'], ['manifest:archive'], ['audit:archive']
];

for (const [script] of commands) {
  const result = spawnSync('npm', ['run', '-s', script], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('RELEASE_B268=PASS');
