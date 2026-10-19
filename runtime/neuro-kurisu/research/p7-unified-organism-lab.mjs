import path from 'node:path';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

class MemoryStore {
  constructor() { this.value = null; }
  async load() { return this.value ? structuredClone(this.value) : null; }
  async save(value) { this.value = structuredClone(value); }
}

const base = {
  enableHomeostasis: true,
  enableIntrinsicGoals: true,
  enableWorldModel: true,
  enableSelfPrediction: true,
  enableWorkspace: true,
  enableActiveInference: true,
  enableIntrinsicMotivation: true,
  enableValuePlasticity: true,
  enableSelfProjects: true,
  enableAgencyModel: true,
  enableValueEvolution: true,
  enableIdentityTrajectory: true,
  enableCognitiveNetwork: true,
  enableNeuromodulation: true,
  enableSemanticMemory: true,
};

const conditions = [
  ['baseline', {}],
  ['network-lesion', { enableCognitiveNetwork: false }],
  ['neuromod-lesion', { enableNeuromodulation: false }],
  ['semantic-lesion', { enableSemanticMemory: false }],
];

const rows = [];

for (const [condition, flags] of conditions) {
  for (const seed of [1, 2]) {
    const core = new OrganismCore(new MemoryStore(), { ...base, ...flags });
    await core.init();
    for (let i = 0; i < 36; i += 1) {
      await core.beginBatch();
      await core.observe({
        text: i % 6 === 0 ? `Исследуй причинную связь ${seed}-${i}` : undefined,
        surprise: (i % 5) / 5,
        novelty: (i % 7) / 7,
        worldContext: {
          tick: i,
          location: i % 2 ? 'lab' : 'home',
          energy: 0.7,
          attention: 0.8,
          uncertainty: 0.45,
          facts: ['persistent-world'],
          objects: [],
          events: [],
        },
      });
      await core.feedback({ success: 0.62 + (i % 4) * 0.07, surprise: (i % 5) / 6, reward: 0.62 });
      await core.endBatch();
    }
    const snapshot = core.snapshot();
    const replayHash = createHash('sha256')
      .update(snapshot.system.replaySignature)
      .digest('hex');
    rows.push({
      condition,
      seed,
      ignitions: snapshot.facets.evolution.network.totalIgnitions,
      networkHistory: snapshot.facets.evolution.network.history.length,
      explorationBias: snapshot.facets.learning.neuromodulation.explorationBias01,
      semanticNodes: snapshot.facets.memory.semanticGraph.nodes.length,
      semanticEdges: snapshot.facets.memory.semanticGraph.edges.length,
      replayHash,
    });
  }
}

const by = Object.fromEntries(
  conditions.map(([name]) => [name, rows.filter((row) => row.condition === name)]),
);

const assertions = {
  networkIgnitionReduced:
    by.baseline.some((row) => row.ignitions > 0) &&
    by['network-lesion'].every((row) => row.ignitions === 0),
  neuromodChanged:
    Math.abs(
      by.baseline[0].explorationBias - by['neuromod-lesion'][0].explorationBias,
    ) > 0.001,
  semanticRemoved: by['semantic-lesion'].every((row) => row.semanticNodes === 0),
};

if (!assertions.networkIgnitionReduced || !assertions.neuromodChanged || !assertions.semanticRemoved) {
  throw new Error(`P7 lab assertions failed: ${JSON.stringify(assertions)}`);
}

const outDir = path.resolve('research/results');
await mkdir(outDir, { recursive: true });
await writeFile(
  path.join(outDir, 'p7-unified-organism-lab.json'),
  JSON.stringify({ rows, assertions }, null, 2),
);

console.log(
  'P7_UNIFIED_ORGANISM_LAB=PASS',
  JSON.stringify({ conditions: 4, seeds: 2, ...assertions }),
);
