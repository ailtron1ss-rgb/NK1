import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemoryWritePolicy } from '../src/organism/system/MemoryWritePolicy.ts';
import { fingerprintMemoryRetrievalDataset, runMemoryOS2RetrievalBenchmark } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';

// Offline A/B of the write policy's eviction weight, measured with the project's canonical
// retrieval benchmark instead of an ad-hoc counter. Both arms start from the same snapshot and
// are cut to the same byte budget; only the retention rule differs.
//
// Two fixtures, because the honest question has two halves:
//   1. fair fixture - equal salience, equal size, only the evidence differs. Does the policy's
//                     information add value where the base ranking is blind?
//   2. salience gap - noise rows look important (salience .95). The weight is bounded to
//                     0.85..1.2, so it must NOT be able to invert that. This pins the limit.
const now = 2_000_000_000_000;
const STRONG = 8;
const WEAK = 8;
const NOISE = 48;

const buildCorpus = (noiseSalience) => {
    const encodeInto = (corpus) => (id, content, extras = {}) => corpus.encode({
        id, content, kind: 'episodic', source: 'policy-ab-fixture', tags: ['policy-ab'],
        context: { fixture: 'policy-ab' },
        salience: .5, emotionalWeight: .2, identityRelevance: .2, goalRelevance: .2, socialRelevance: .1,
        predictionError: .1, confidence: .9, epistemicStatus: 'fact',
        entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
        validFromAt: now - 10_000, provenanceClass: 'external', sourceAuthority01: .9, observedAt: now - 1_000,
        ...extras,
    });
    const corpus = new MemoryOS2();
    const encode = encodeInto(corpus);
    const strongIds = [];
    const weakIds = [];
    const noiseIds = [];
    for (let i = 0; i < STRONG; i++) { strongIds.push(`lab-s${i}`); encode(`lab-s${i}`, `protocol zeta reading KXS${i} note`); }
    for (let i = 0; i < WEAK; i++) { weakIds.push(`lab-w${i}`); encode(`lab-w${i}`, `protocol zeta reading KXW${i} note`); }
    for (let i = 0; i < NOISE; i++) { noiseIds.push(`noise-${i}`); encode(`noise-${i}`, `hallway chatter report ${i} relay`, { salience: noiseSalience }); }
    // The budget is derived from the noise rows alone, so the pressure is sized to exhaust them:
    // otherwise the many noise rows would absorb the cut and the arms would never compete.
    const noiseOnly = new MemoryOS2();
    const encodeNoise = encodeInto(noiseOnly);
    for (let i = 0; i < NOISE; i++) encodeNoise(`noise-${i}`, `hallway chatter report ${i} relay`, { salience: noiseSalience });
    return { corpus, strongIds, weakIds, noiseIds, noiseBytes: noiseOnly.budgetDiagnostics().estimatedBytes };
};

const evidencePolicy = ({ strongIds, weakIds, noiseIds }) => {
    const policy = new MemoryWritePolicy({ mode: 'active' });
    for (let observation = 0; observation < 3; observation++) {
        for (const id of strongIds) policy.observeOutcome({ tick: observation, id, success01: 0.92, predictionError01: 0.08, retentionScore01: 0.85 });
        for (const id of weakIds) policy.observeOutcome({ tick: observation, id, success01: 0.5, predictionError01: 0.5, retentionScore01: 0.5 });
        for (const id of noiseIds) policy.observeOutcome({ tick: observation, id, success01: 0.15, predictionError01: 0.85, retentionScore01: 0.25 });
    }
    return policy;
};

const runArms = (fixture) => {
    const { corpus, strongIds, weakIds, noiseBytes } = fixture;
    const snapshot = corpus.snapshot();
    const totalBytes = corpus.budgetDiagnostics().estimatedBytes;
    // Pressure large enough to consume ~85% of the noise rows, so eviction must decide between
    // noise and labelled memories instead of quietly deleting the cheapest noise forever.
    const budget = Math.max(16384, Math.floor(totalBytes - 0.85 * noiseBytes));
    const policy = evidencePolicy(fixture);

    const control = new MemoryOS2();
    control.restore(structuredClone(snapshot));
    const controlRun = control.enforceByteBudget({ maxBytes: budget, reason: 'policy-ab-control' });

    const treatment = new MemoryOS2();
    treatment.restore(structuredClone(snapshot));
    const treatmentRun = treatment.enforceByteBudget({
        maxBytes: budget,
        reason: 'policy-ab-treatment',
        valueAdjustment: (item) => policy.evictionWeight01(item.id),
    });

    const survivors = (os) => new Set(os.snapshot().items.map((item) => item.id));
    const count = (set, ids) => ids.filter((id) => set.has(id)).length;
    const controlSurvivors = survivors(control);
    const treatmentSurvivors = survivors(treatment);

    assert.ok(controlRun.evicted.length > 0 && treatmentRun.evicted.length > 0, 'both arms must face real pressure');
    assert.ok(controlRun.usedBytes <= budget, 'control must respect the budget');
    assert.ok(treatmentRun.usedBytes <= budget, 'treatment must respect the budget');

    return {
        control, treatment, budget, policy, controlRun, treatmentRun, strongIds, weakIds,
        controlStrong: count(controlSurvivors, strongIds),
        treatmentStrong: count(treatmentSurvivors, strongIds),
        controlWeak: count(controlSurvivors, weakIds),
        treatmentWeak: count(treatmentSurvivors, weakIds),
    };
};

// --- 1. fair fixture: evidence is the only signal ---------------------------------------
const fair = buildCorpus(0.55);
const arms = runArms(fair);
assert.ok(arms.policy.evictionWeight01(fair.strongIds[0]) > 1, 'good evidence must protect');
assert.ok(arms.policy.evictionWeight01(fair.noiseIds[0]) < 1, 'bad evidence must demote even when the channel is healthy');
assert.ok(arms.controlStrong < STRONG, `control must lose well-evidenced rows when only evidence differs, kept ${arms.controlStrong}`);
assert.equal(arms.treatmentStrong, STRONG, `treatment must keep every well-evidenced row, kept ${arms.treatmentStrong}`);

// Same instrument, same queries, same k: only the retained corpus differs.
const examples = [];
for (let i = 0; i < STRONG; i++) examples.push({ id: `h-s${i}`, query: `protocol zeta reading KXS${i}`, relevantIds: [`lab-s${i}`], split: 'holdout', answerable: true });
for (let i = 0; i < 4; i++) examples.push({ id: `h-w${i}`, query: `protocol zeta reading KXW${i}`, relevantIds: [`lab-w${i}`], split: 'holdout', answerable: true });
for (let i = 0; i < 4; i++) examples.push({ id: `t-${i}`, query: `protocol zeta reading KXS${i}`, relevantIds: [`lab-s${i}`], split: 'train', answerable: true });
for (let i = 0; i < 4; i++) examples.push({ id: `u-${i}`, query: `quasar banana ordinance zebra ${i}`, relevantIds: [], split: 'holdout', answerable: false });

const options = {
    now, k: 5, minHoldoutQueries: 12, minUnanswerableHoldoutQueries: 4, bootstrapSamples: 400, seed: 23,
    datasetProvenance: {
        datasetId: 'nk1-policy-ab-fixture',
        datasetVersion: 'fixture-v1',
        sourceRef: 'runtime/neuro-kurisu/tests/memory-write-policy-retrieval-benchmark-ab.mjs',
        labelingProtocol: 'Hand-authored synthetic labels; equal-salience fixture, not production evidence.',
        licenseId: 'LicenseRef-NK1-Synthetic-Fixture',
        contentSha256: fingerprintMemoryRetrievalDataset(examples),
    },
};

const controlReport = runMemoryOS2RetrievalBenchmark(arms.control.snapshot(), examples, options);
const treatmentReport = runMemoryOS2RetrievalBenchmark(arms.treatment.snapshot(), examples, options);

assert.equal(controlReport.guardrails.liveMemoryMutated, false);
assert.equal(treatmentReport.guardrails.liveMemoryMutated, false);
assert.equal(treatmentReport.datasetIntegrity.unknownRelevantMemoryIdCount, 0, 'every labelled row must survive in the treatment arm');
assert.ok(controlReport.datasetIntegrity.unknownRelevantMemoryIdCount > 0, 'the control arm is expected to lose labelled rows; the report says so instead of hiding it');
assert.equal(controlReport.promotion.allowed, false, 'a synthetic fixture never authorises promotion');
assert.equal(treatmentReport.promotion.allowed, false, 'a synthetic fixture never authorises promotion');
assert.ok(
    treatmentReport.metrics.candidate.recallAtK01 > controlReport.metrics.candidate.recallAtK01,
    `treatment recall ${treatmentReport.metrics.candidate.recallAtK01} must beat control ${controlReport.metrics.candidate.recallAtK01}`,
);
assert.ok(treatmentReport.metrics.candidate.mrr01 >= controlReport.metrics.candidate.mrr01, 'treatment must not lose ranking quality');

// --- 2. salience gap: the bounded weight must not pretend to override importance ---------
const skewed = buildCorpus(0.95);
const skewedArms = runArms(skewed);
assert.ok(skewedArms.controlStrong < STRONG, 'with a salience gap the control also loses labelled rows');
assert.ok(skewedArms.treatmentStrong < STRONG, 'a bounded weight must not invert a large salience gap; if this fails the bounds were widened silently');

console.log(`MEMORY_WRITE_POLICY_RETRIEVAL_BENCHMARK_AB=PASS ${JSON.stringify({
    budgetBytes: arms.budget,
    weights: {
        strong: Number(arms.policy.evictionWeight01(fair.strongIds[0]).toFixed(3)),
        noise: Number(arms.policy.evictionWeight01(fair.noiseIds[0]).toFixed(3)),
    },
    fair: {
        evicted: { control: arms.controlRun.evicted.length, treatment: arms.treatmentRun.evicted.length },
        strongSurvived: { control: arms.controlStrong, treatment: arms.treatmentStrong },
        weakSurvived: { control: arms.controlWeak, treatment: arms.treatmentWeak },
        recallAtK01: { control: controlReport.metrics.candidate.recallAtK01, treatment: treatmentReport.metrics.candidate.recallAtK01 },
        mrr01: { control: Number(controlReport.metrics.candidate.mrr01.toFixed(4)), treatment: Number(treatmentReport.metrics.candidate.mrr01.toFixed(4)) },
        unknownLabels: { control: controlReport.datasetIntegrity.unknownRelevantMemoryIdCount, treatment: treatmentReport.datasetIntegrity.unknownRelevantMemoryIdCount },
    },
    salienceGap: { strongSurvived: { control: skewedArms.controlStrong, treatment: skewedArms.treatmentStrong } },
})}`);
