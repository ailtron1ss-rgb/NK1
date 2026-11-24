import { readFile } from 'node:fs/promises';

const files = [
  ['src/organism/system/UpstreamReplayPrimitives.ts', ['Avalanche', 'Tianshou', 'DreamerV3']],
  ['src/organism/cognition/B365UnifiedNeuroCausalCore.ts', ['BalancedReservoirSampler', 'PrioritizedReplaySampler', 'robustPercentileNormalize']],
  ['src/organism/cognition/NeuromodulatoryPlasticitySubstrate.ts', ['symlog', 'outputWeightImportance']],
  ['src/organism/learning/P30ContinualIntelligence.ts', ['BalancedReservoirSampler', 'transferReservoirStreamCount']],
  ['docs/UPSTREAM_INTEGRATIONS_R12_2026-09-25.md', ['Avalanche / ContinualAI', 'Tianshou', 'DreamerV3', 'MESU', 'LGPL-3.0', 'AGPL-3.0']],
];
let failures = 0;
for (const [path, needles] of files) {
  const content = await readFile(path, 'utf8');
  for (const needle of needles) {
    if (!content.includes(needle)) {
      console.error(`MISSING ${path}: ${needle}`);
      failures += 1;
    }
  }
}
const forbiddenVendoring = [/from ['"]norse\//, /from ['"]bindsnet/, /from ['"]avalanche/, /from ['"]tianshou/];
const runtime = await readFile('src/organism/system/UpstreamReplayPrimitives.ts', 'utf8');
for (const pattern of forbiddenVendoring) {
  if (pattern.test(runtime)) {
    console.error(`FORBIDDEN_VENDORING ${pattern}`);
    failures += 1;
  }
}
console.log(`UPSTREAM_AUDIT=${failures ? 'FAIL' : 'PASS'} checks=${files.length * 3 + forbiddenVendoring.length} failures=${failures}`);
if (failures) process.exit(1);
