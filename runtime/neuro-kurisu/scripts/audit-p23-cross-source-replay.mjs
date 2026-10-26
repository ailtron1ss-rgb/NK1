import { spawnSync } from 'node:child_process';

const scripts = [
  'typecheck',
  'test:p23:verified-replay-admission',
  'test:p23:replay-selection-policy',
  'test:p23:learning',
  'test:workpass198:skill-transfer',
  'test:p23:verified-session-dataset',
  'test:workpass172:compound-revision-coordinator',
  'test:workpass203:independent-candidate-evaluator',
  'test:workpass206:independent-evaluation-provider',
  'test:workpass224:production-independent-evaluation-required',
  'test:workpass225:matched-independent-evaluation',
  'test:workpass227:bounded-independent-evaluation',
  'test:workpass243:host-owned-independent-evaluation-services',
  'test:p23:learning-process-supervisor',
  'test:p23:hermes-verified-evidence-binding',
  'test:p23:hermes-production-promotion-gate',
  'test:p23:trusted-skill-shadow-run-registry',
  'test:workpass239:durable-signed-promotion-e2e',
];

for (const script of scripts) {
  console.log('\n[AUDIT P23] npm run ' + script);
  const result = spawnSync('npm', ['run', script], { stdio: 'inherit' });
  if (result.error) { console.error('[AUDIT P23] failed to start ' + script + ': ' + result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('AUDIT_P23_CROSS_SOURCE_REPLAY=PASS steps=' + scripts.length);
