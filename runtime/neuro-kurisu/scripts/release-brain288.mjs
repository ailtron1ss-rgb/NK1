import { execFileSync } from 'node:child_process';

const steps = [
  ['typecheck', 'npm', ['run', 'typecheck']],
  ['social-brain', 'npm', ['run', 'test:big-pass-288:social-brain']],
  ['hidden-social', 'npm', ['run', 'test:big-pass-288:hidden']],
  ['core', 'npm', ['run', 'test:big-pass-288:core']],
  ['migration', 'npm', ['run', 'test:big-pass-288:migration']],
  ['consolidation', 'npm', ['run', 'test:big-pass-288:consolidation']],
  ['full-audit', 'npm', ['run', 'audit:full']],
  ['architecture', 'npm', ['run', 'audit:architecture']],
  ['integrity', 'npm', ['run', 'audit:integrity']],
  ['forensics', 'npm', ['run', 'audit:forensics']],
  ['hygiene', 'npm', ['run', 'audit:hygiene']],
  ['syntax', 'npm', ['run', 'audit:syntax']],
  ['contract', 'npm', ['run', 'audit:contract']],
  ['lock', 'npm', ['run', 'audit:lock']],
  ['release-source', 'npm', ['run', 'verify:release-source']],
  ['doctor', 'npm', ['run', 'doctor']],
  ['brain-audit', 'npm', ['run', 'audit:brain']],
  ['archive-manifest', 'npm', ['run', 'manifest:archive']],
  ['archive-audit', 'npm', ['run', 'audit:archive']],
];

for (const [name, cmd, args] of steps) {
  console.log(`B288_GATE=${name}`);
  execFileSync(cmd, args, { stdio: 'inherit' });
  console.log(`B288_GATE=${name}:PASS`);
}
