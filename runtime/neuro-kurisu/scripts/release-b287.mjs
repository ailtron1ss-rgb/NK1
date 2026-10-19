import { execFileSync } from 'node:child_process';

const commands = [
  ['npm', ['run', 'typecheck']],
  ['npm', ['run', 'test:big-pass-287']],
  ['npm', ['run', 'test:big-pass-287:hidden']],
  ['npm', ['run', 'test:big-pass-287:core']],
  ['npm', ['run', 'test:big-pass-287:migration']],
  ['npm', ['run', 'test:big-pass-286']],
  ['npm', ['run', 'test:big-pass-286:core']],
  ['npm', ['run', 'test:big-pass-286:migration']],
  ['npm', ['run', 'test:big-pass-285:life']],
  ['npm', ['run', 'test:big-pass-285:future']],
  ['npm', ['run', 'test:big-pass-285:core']],
  ['npm', ['run', 'test:big-pass-285:migration']],
  ['npm', ['run', 'audit:full']],
  ['npm', ['run', 'audit:architecture']],
  ['npm', ['run', 'audit:integrity']],
  ['npm', ['run', 'audit:forensics']],
  ['npm', ['run', 'audit:hygiene']],
  ['npm', ['run', 'audit:syntax']],
  ['npm', ['run', 'audit:contract']],
  ['npm', ['run', 'audit:lock']],
  ['npm', ['run', 'verify:release-source']],
  ['npm', ['run', 'doctor']],
  ['npm', ['run', 'audit:brain']],
  ['npm', ['run', 'manifests']],
  ['npm', ['run', 'manifest:archive']],
  ['npm', ['run', 'audit:archive']],
];

for (const [cmd, args] of commands) {
  console.log(`\n>>> ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit' });
}

console.log('\nB287_RELEASE=PASS');
