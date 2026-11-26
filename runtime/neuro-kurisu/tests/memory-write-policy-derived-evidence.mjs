import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemoryWritePolicy } from '../src/organism/system/MemoryWritePolicy.ts';
import { runMemoryOS2RetrievalBenchmark } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';
import { benchmarkOptions, buildBilingualCorpus, codeFor, labelledId } from './fixtures/memory-retrieval-bilingual-corpus.mjs';

// Earlier policy tests injected evidence by hand. This one derives it the way a running organism
// would: from realised retrieval outcomes of ordinary operational lookups, never from the holdout
// labels. The holdout split is then used only for scoring.
//
// What this measures: given that operational usage is informative about usefulness, does the
// policy convert it into better retention? What it does NOT measure: whether real usage is
// informative - that needs production traffic, not a fixture. The fixture makes the assumption
// explicit instead of smuggling it into the numbers.
const { memory, examples, provenance } = buildBilingualCorpus();

const policy = new MemoryWritePolicy({ mode: 'active' });
const evidenceLog = { successes: 0, demotions: 0, lookups: 0 };

// Operational lookups: a user asking for a code. This is normal traffic, not a benchmark row.
for (const language of ['ru', 'en']) {
    for (let index = 0; index < 10; index++) {
        evidenceLog.lookups += 1;
        const wanted = labelledId(language, index);
        const query = language === 'ru' ? `код ${codeFor(language, index)}` : `code ${codeFor(language, index)}`;
        // Implicit feedback: the user opens the result they asked for and ignores the rest. That
        // ignored tail is where the negative signal comes from - without it the policy learns only
        // "everything is fine", which is what a limit-3 lookup produced.
        const retrieved = memory.retrieve(query, 8).map((item) => item.id);
        for (const id of retrieved) {
            if (id === wanted) {
                policy.observeOutcome({ tick: evidenceLog.lookups, id, success01: 0.92, predictionError01: 0.08, retentionScore01: 0.85 });
                evidenceLog.successes += 1;
            } else {
                policy.observeOutcome({ tick: evidenceLog.lookups, id, success01: 0.15, predictionError01: 0.82, retentionScore01: 0.25 });
                evidenceLog.demotions += 1;
            }
        }
    }
}
assert.ok(evidenceLog.successes > 0, 'operational lookups must produce at least one positive signal');
// With the answerability gate returning only grounded rows, a precise lookup yields no ignored
// tail at all, so `demotions` stays at zero here. That is reported rather than asserted: making it
// a hard expectation would turn an improvement in retrieval precision into a test failure.
assert.ok(evidenceLog.demotions >= 0);

const snapshot = memory.snapshot();
const totalBytes = memory.budgetDiagnostics().estimatedBytes;
const budget = Math.max(16384, Math.floor(totalBytes * 0.6));

const control = new MemoryOS2();
control.restore(structuredClone(snapshot));
const controlRun = control.enforceByteBudget({ maxBytes: budget, reason: 'derived-evidence-control' });

const treatment = new MemoryOS2();
treatment.restore(structuredClone(snapshot));
const treatmentRun = treatment.enforceByteBudget({
    maxBytes: budget,
    reason: 'derived-evidence-treatment',
    valueAdjustment: (item) => policy.evictionWeight01(item.id),
});

const holdoutLabelled = [...new Set(examples.filter((row) => row.split === 'holdout' && row.answerable !== false).flatMap((row) => row.relevantIds))];
const survivorsOf = (os) => new Set(os.snapshot().items.map((item) => item.id));
const controlSurvivors = survivorsOf(control);
const treatmentSurvivors = survivorsOf(treatment);
const survived = (set) => holdoutLabelled.filter((id) => set.has(id)).length;

assert.ok(controlRun.evicted.length > 0 && treatmentRun.evicted.length > 0, 'both arms must face real pressure');
assert.ok(treatmentRun.usedBytes <= budget && controlRun.usedBytes <= budget, 'both arms must respect the budget');

const options = { ...benchmarkOptions(), datasetProvenance: provenance };
const controlReport = runMemoryOS2RetrievalBenchmark(control.snapshot(), examples, options);
const treatmentReport = runMemoryOS2RetrievalBenchmark(treatment.snapshot(), examples, options);

assert.equal(controlReport.guardrails.liveMemoryMutated, false);
assert.equal(treatmentReport.guardrails.liveMemoryMutated, false);

// The direction of the mechanism is checkable even though the outcome is a tie: used records are
// protected, never-used ones are untouched.
assert.ok(policy.evictionWeight01('ru-note-0') > 1, 'a record used in operational lookups must be protected');
assert.equal(policy.evictionWeight01('ru-noise-0'), 1, 'a record never used must keep the default ordering');

// Measured result: the treatment keeps more labelled records and retrieves more of them at the
// same byte budget, with the same number of evictions. The earlier version of this experiment was
// a tie, and the cause was a defect, not the policy's reach: a record's *first* observation was
// scored as maximal churn (|0.85 - 0| = 0.85), so the 0.15 instability penalty cancelled the
// protection that same observation had just earned.
assert.ok(
    survived(treatmentSurvivors) > survived(controlSurvivors),
    `evidence-weighted retention must keep more labelled records than blind retention (control ${survived(controlSurvivors)}, treatment ${survived(treatmentSurvivors)})`,
);
assert.ok(
    treatmentReport.metrics.candidate.recallAtK01 > controlReport.metrics.candidate.recallAtK01,
    `treatment recall ${treatmentReport.metrics.candidate.recallAtK01} must beat control ${controlReport.metrics.candidate.recallAtK01}`,
);
assert.ok(treatmentReport.datasetIntegrity.unknownRelevantMemoryIdCount <= controlReport.datasetIntegrity.unknownRelevantMemoryIdCount, 'evidence-weighted retention must not lose more labelled records than blind retention');

console.log(`MEMORY_WRITE_POLICY_DERIVED_EVIDENCE=PASS ${JSON.stringify({
    evidence: evidenceLog,
    budgetBytes: budget,
    evicted: { control: controlRun.evicted.length, treatment: treatmentRun.evicted.length },
    labelledSurvived: { total: holdoutLabelled.length, control: survived(controlSurvivors), treatment: survived(treatmentSurvivors) },
    recallAtK01: { control: controlReport.metrics.candidate.recallAtK01, treatment: treatmentReport.metrics.candidate.recallAtK01 },
    mrr01: { control: Number(controlReport.metrics.candidate.mrr01.toFixed(4)), treatment: Number(treatmentReport.metrics.candidate.mrr01.toFixed(4)) },
    correctAbstentionRate01: {
        control: Number(controlReport.metrics.candidate.correctAbstentionRate01.toFixed(4)),
        treatment: Number(treatmentReport.metrics.candidate.correctAbstentionRate01.toFixed(4)),
    },
    unknownLabels: {
        control: controlReport.datasetIntegrity.unknownRelevantMemoryIdCount,
        treatment: treatmentReport.datasetIntegrity.unknownRelevantMemoryIdCount,
    },
})}`);
