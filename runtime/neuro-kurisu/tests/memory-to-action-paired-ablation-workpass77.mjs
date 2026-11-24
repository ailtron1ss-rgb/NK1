import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const CONFIG = {
  performanceProfile: 'mobile',
  cycleResultMode: 'operational',
  spineOnly: false,
  enableCompositionalExecution: true,
  enableHomeostasis: true,
  enableIntrinsicGoals: true,
  enableWorldModel: true,
  enableSelfPrediction: false,
  enableWorkspace: false,
  enableActiveInference: false,
  enableIntrinsicMotivation: false,
  enableValuePlasticity: false,
  enableSelfProjects: false,
  enableAgencyModel: false,
  enableValueEvolution: false,
  enableIdentityTrajectory: false,
  enableCognitiveNetwork: false,
  enableNeuromodulation: false,
  enableSemanticMemory: false,
  enableCognitiveField: false,
  enableContradictions: false,
  enableCognitiveBudget: false,
  enableCognitiveImmune: false,
  enableProceduralSkills: false,
  enableScientificMethod: false,
  enableLearnedResidualWorld: false,
  enableUnifiedMemory: false,
  enableSocialDevelopment: false,
  enablePerception: false,
  enableLifelongLearning: false,
};
const EMBODIMENT = {
  awake: true,
  bodyEnergy01: .88,
  cognitiveCapacity01: .86,
  thermalStrain01: .12,
  sensoryFreshness01: .8,
  battery01: .9,
  cpuLoad01: .15,
  ramPressure01: .14,
};
const QUERY = 'Evaluate the laboratory switch safety status and select a suitable next step from the archived context.';
const SEEDS = [3, 11, 29, 47, 83];
const ACTION_CUES = {
  respond: 'respond reply answer communicate respond reply answer',
  explore: 'explore exploration investigate search discover explore investigation',
};

function actionContent(cue, seed, index) {
  return [
    'laboratory switch safety status archived context',
    cue,
    'evidence record seed ' + seed + ' item ' + index,
    'retain this memory as an episodic operational lesson',
  ].join(' ');
}
function candidateScore(trace, action) {
  const row = trace.candidates.find(candidate => candidate.action === action);
  assert.ok(row, 'the Core decision must retain a ' + action + ' candidate');
  return Number(row.score);
}
async function buildBaseSnapshot() {
  const store = new MemoryStateStore();
  const core = new OrganismCore(store, CONFIG);
  await core.init();
  await core.flush();
  const snapshot = await store.load();
  assert.ok(snapshot, 'the deterministic pre-observation Core snapshot must be durable');
  return structuredClone(snapshot);
}
async function runArm(baseSnapshot, arm, seed) {
  const store = new MemoryStateStore({ initial: structuredClone(baseSnapshot) });
  const core = new OrganismCore(store, CONFIG);
  await core.init();
  const ids = [];
  const at = Date.now() - 30_000;
  for (let index = 0; index < 4; index++) {
    const id = 'workpass77-' + arm + '-' + seed + '-' + index;
    ids.push(id);
    core.memorySubsystem.fabric.encode({
      id,
      content: actionContent(ACTION_CUES[arm], seed, index),
      kind: 'episodic',
      source: 'workpass77-paired-core-memory-action-ablation',
      tags: ['laboratory', 'switch', 'safety', 'review', 'archived-context'],
      context: {
        experiment: 'workpass77-memory-action-ablation',
        arm,
        seed: String(seed),
        sessionId: 'workpass77-paired-' + seed,
      },
      salience: .98,
      emotionalWeight: .18,
      identityRelevance: .22,
      goalRelevance: .82,
      socialRelevance: .12,
      predictionError: .12,
      confidence: .98,
      epistemicStatus: 'fact',
      entities: ['laboratory-switch'],
      semanticLinks: [],
      temporalLinks: [],
      causalLinks: [],
      contradictionLinks: [],
      validFromAt: at,
      observedAt: at,
      evidenceFreshnessAt: at,
    }, { tick: 0, forceDistinct: true });
  }
  const previewIds = core.memorySubsystem.fabric.previewRetrieve(QUERY, 8).map(row => row.id);
  assert.deepEqual(
    ids.filter(id => previewIds.includes(id)).sort(),
    [...ids].sort(),
    'the pre-observation lexical memory preview must expose all four paired arm memories',
  );

  const result = await core.observe({ text: QUERY, novelty: .76, embodiment: EMBODIMENT }, 'operational');
  await core.flush();
  const snapshot = core.snapshot();
  const decision = snapshot.traces
    .filter(row => row.tick > 0)
    .sort((a, b) => b.tick - a.tick)[0];
  assert.ok(decision, 'Core must emit a canonical decision trace');
  assert.ok(decision.memoryEvidence, 'the decision must carry the WorkPass74 read receipt');
  assert.equal(decision.memoryEvidence.status, 'retrieved');
  assert.ok(decision.memoryEvidence.retrievedMemoryIds.length > 0);
  const seededRetrieved = decision.memoryEvidence.retrievedMemoryIds.filter(id => ids.includes(id));
  assert.ok(seededRetrieved.length >= 3,
    'the live cognitive retrieval must consume at least three arm-specific seeded memories');
  assert.equal(decision.memoryEvidence.tick, decision.tick);
  assert.equal(decision.reasoningSignals.memoryRetrievedCount, decision.memoryEvidence.retrievedCount);

  const scores = {
    respond: candidateScore(decision, 'respond'),
    explore: candidateScore(decision, 'explore'),
    verify: candidateScore(decision, 'verify'),
    reflect: candidateScore(decision, 'reflect'),
  };
  return {
    seed,
    arm,
    tick: decision.tick,
    selectedAction: decision.selected?.action ?? 'none',
    retrievedSeedIds: seededRetrieved,
    memoryCount: decision.memoryEvidence.retrievedCount,
    scores,
    respondVsExploreMargin: scores.respond - scores.explore,
    traceId: decision.id,
    memoryQueryHash: decision.memoryEvidence.queryHash,
  };
}

const baseSnapshot = await buildBaseSnapshot();
const rows = [];
for (const seed of SEEDS) {
  const [respondArm, exploreArm] = await Promise.all([
    runArm(baseSnapshot, 'respond', seed),
    runArm(baseSnapshot, 'explore', seed),
  ]);
  assert.equal(respondArm.tick, exploreArm.tick,
    'paired decisions must start from the same tick');
  assert.equal(respondArm.memoryCount, exploreArm.memoryCount,
    'paired arms must retrieve the same number of memories');
  assert.equal(respondArm.memoryQueryHash, exploreArm.memoryQueryHash,
    'matched arms must use the exact same observation/query so the only treatment difference is memory content');
  const shift = respondArm.respondVsExploreMargin - exploreArm.respondVsExploreMargin;
  assert.ok(shift > .08,
    'respond-cued memory must increase respond-vs-explore decision margin relative to explore-cued memory');
  rows.push({
    seed,
    respondSelected: respondArm.selectedAction,
    exploreSelected: exploreArm.selectedAction,
    respondMargin: Number(respondArm.respondVsExploreMargin.toFixed(6)),
    exploreMargin: Number(exploreArm.respondVsExploreMargin.toFixed(6)),
    pairedMarginShift: Number(shift.toFixed(6)),
    respondMemoryCount: respondArm.memoryCount,
    exploreMemoryCount: exploreArm.memoryCount,
    memoryIdsMatched: respondArm.retrievedSeedIds.length >= 3 && exploreArm.retrievedSeedIds.length >= 3,
  });
}

const meanShift = rows.reduce((sum, row) => sum + row.pairedMarginShift, 0) / rows.length;
const positivePairs = rows.filter(row => row.pairedMarginShift > .08).length;
assert.equal(positivePairs, SEEDS.length,
  'every matched state must show the predicted direction of memory-dependent score movement');

console.log('MEMORY_TO_ACTION_PAIRED_ABLATION_WORKPASS77=PASS', JSON.stringify({
  protocol: 'paired-organism-core-memory-content-ablation-v1',
  seeds: SEEDS,
  pairedCoreRuns: SEEDS.length * 2,
  sameInitialSnapshot: true,
  sameObservation: true,
  sameTickAndRetrievedCount: true,
  armDifference: 'four retrieved episodic memories contain respond cues versus explore cues',
  positivePairs,
  meanRespondVsExploreMarginShift: Number(meanShift.toFixed(6)),
  rows,
  interpretation: 'The test isolates direction of the retrieved-memory contribution to candidate scores under matched Core state. It does not establish a universal benefit, conscious free will, or real-world utility; selectedAction may remain unchanged under other stronger policy constraints.',
}));
