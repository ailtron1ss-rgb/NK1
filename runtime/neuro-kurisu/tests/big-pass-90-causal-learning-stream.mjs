import assert from 'node:assert/strict';
import { CausalExperienceStream } from '../src/organism/learning/CausalExperienceStream.ts';

const mkState=(overrides={})=>({
  tick:1,at:1000,predictionError:.6,attentionBudget:.8,selfPredictionError:.2,autonomyScore:.6,
  needs:{energy:.7,cognitiveLoad:.3,uncertainty:.65,novelty:.7,goalPressure:.6,socialNeed:.4,identityCoherence:.82},
  ...overrides,
});
const trace={
  id:'trace-90',tick:1,createdAt:1000,candidates:[],selected:{action:'explore',goalId:'goal-1',predictedUtility:.6,confidence:.7,predictedCost:.3,reasons:[]},
  stateBefore:mkState(),reasoningSignals:{},userRequestedAction:null,autonomousOverride:true,predictedOutcomes:[]
};

const stream=new CausalExperienceStream(16);
stream.observe(trace);
const record=stream.recordOutcome(trace,mkState({
  tick:2,at:1100,lastAction:'explore',lastActionSuccess:.8,
  needs:{...mkState().needs,energy:.55,uncertainty:.4,novelty:.75},
}),{reward01:.8,success01:.8,surprise01:.7,novelty01:.75});

assert.ok(record);
assert.ok(record.causalStrength01>.3);
// Invalid state snapshots must not be clamped into apparently grounded outcomes.
assert.equal(stream.recordOutcome({
  ...trace, id: "invalid-before-state",
  stateBefore: mkState({ needs: { ...mkState().needs, energy: Number.NaN } }),
}, mkState({ tick: 3 }), { reward01: .8, success01: .8, surprise01: .7, novelty01: .75 }), null,
  "non-finite pre-action state must not mint grounded causal evidence");
assert.equal(stream.recordOutcome(trace, mkState({ tick: 1 }), {
  reward01: .8, success01: .8, surprise01: .7, novelty01: .75,
}), null, "an outcome without a later observed state transition must be rejected");

assert.equal(stream.recordOutcome({
  ...trace, id: "mismatched-pre-action-tick", tick: 0,
}, mkState({ tick: 3 }), {
  reward01: .8, success01: .8, surprise01: .7, novelty01: .75,
}), null, "a trace from a different world tick must not be attached to this observed transition");

assert.equal(stream.recordOutcome({ ...trace, id: "nan-outcome-reward" }, mkState({ tick: 3 }), {
  reward01: Number.NaN, success01: .8, surprise01: .7, novelty01: .75,
}), null, "non-finite outcome metrics must not be clamped into trusted evidence");
assert.equal(stream.recordOutcome({
  ...trace, id: "unsafe-outcome-task",
  selected: { ...trace.selected, goalId: "unsafe" + String.fromCharCode(10) + "task" },
}, mkState({ tick: 3 }), {
  reward01: .8, success01: .8, surprise01: .7, novelty01: .75,
}), null, "control-bearing task identity must not mint causal evidence");
assert.ok(stream.summary().rolling.learningOpportunity01>0);
const packet=stream.learningPacket(8);
assert.equal(packet.records.length,1);
assert.ok(packet.meanCausalStrength01>0);
const persisted=stream.snapshot();
const restored=new CausalExperienceStream(16);
restored.restore(persisted);
assert.deepEqual(restored.recent(8),stream.recent(8));
assert.equal(restored.recordOutcome(trace,mkState({tick:2,at:1100,lastAction:'explore',lastActionSuccess:.8}),{reward01:.8,success01:.8,surprise01:.7,novelty01:.75}),null,
  "restored trace identity must prevent recording the same runtime outcome twice");
assert.ok(Array.isArray(restored.snapshot().recordedTraceIds));
const consolidated=restored.consolidate(8,1200);
assert.equal(consolidated.length,1);
assert.equal(restored.summary().consolidated,1);

const ungrounded = new CausalExperienceStream(16);
ungrounded.recordExternalLearningEvent({
  tick: 3, taskId: "unverified-external", action: "explore",
  reward01: 1, success01: 1, surprise01: 1, novelty01: 1,
  traceId: "unverified-external-event", stateGrounded: false, causalStrength01: 1,
});
assert.equal(ungrounded.consolidate(8,1300).length,0,
  "high surprise/reward alone must not consolidate an ungrounded external event");

const externalStream = new CausalExperienceStream(64);
const externalInput = {
  tick: 4, taskId: "external-retry", action: "explore",
  reward01: .7, success01: .8, surprise01: .6, novelty01: .4,
  traceId: "  Ｅxternal-Source-17  ", stateGrounded: true, provenance: "runtime-outcome",
};
const externalFirst = externalStream.recordExternalLearningEvent(externalInput);
assert.ok(externalFirst);
assert.equal(externalFirst.provenance, "external",
  "public external intake must not allow callers to impersonate runtime provenance");
assert.equal(externalFirst.stateGrounded, false,
  "caller-supplied stateGrounded=true must not create trusted state-transition evidence");
assert.equal(externalFirst.replayEligible, false,
  "unverified imported events must not enter policy replay");
assert.equal(externalStream.consolidate(8, 1300).length, 0,
  "high-value caller-asserted external evidence must not consolidate as grounded memory");
const externalDuplicate = externalStream.recordExternalLearningEvent({
  ...externalInput, traceId: "External-Source-17",
});
assert.equal(externalDuplicate?.id, externalFirst?.id,
  "NFKC-normalized upstream retry must resolve to the same recorded outcome");
assert.equal(externalStream.summary().outcomes, 0,
  "unverified external events must never increment the trusted runtime-outcome total");
assert.equal(externalStream.summary().records, 1,
  "duplicate external evidence must not create a second retained record");
assert.throws(() => externalStream.recordExternalLearningEvent({
  ...externalInput, traceId: "External-Source-17", success01: .1,
}), /causal-external-trace-id-conflict/,
  "reusing a trace identity with a changed outcome must surface a conflict");
assert.equal(externalStream.summary().outcomes, 0,
  "conflicting external evidence must not mutate trusted outcome counts");
assert.equal(externalStream.summary().records, 1,
  "conflicting duplicate evidence must not mutate retained records");

assert.throws(() => externalStream.recordExternalLearningEvent({
  tick: Number.NaN, taskId: "bad-tick", action: "explore",
  reward01: .5, success01: .5, surprise01: .5, novelty01: .5,
}), /causal-external-tick-invalid/,
  "invalid external ticks must be rejected rather than coerced to zero");
assert.throws(() => externalStream.recordExternalLearningEvent({
  tick: 5, taskId: "bad-metric", action: "explore",
  reward01: Number.NaN, success01: .5, surprise01: .5, novelty01: .5,
}), /causal-external-metric-invalid/,
  "non-finite external metrics must be rejected rather than clamped into plausible evidence");
assert.throws(() => externalStream.recordExternalLearningEvent({
  tick: 5, taskId: "bad-source-id", action: "explore",
  reward01: .5, success01: .5, surprise01: .5, novelty01: .5,
  sourceMemoryId: "source" + String.fromCharCode(10) + "spoof",
}), /causal-external-source-memory-id-invalid/,
  "external provenance identifiers containing control characters must be rejected");
// Legacy persisted external rows may contain caller-forged provenance and
// grounding from before the intake contract was hardened. Restore must quarantine
// them rather than silently upgrading them into trusted memory.
const legacyForgedSnapshot = externalStream.snapshot();
legacyForgedSnapshot.records[0].provenance = "runtime-outcome";
legacyForgedSnapshot.records[0].stateGrounded = true;
delete legacyForgedSnapshot.records[0].policyFeatures01;
const legacyForgedRestore = new CausalExperienceStream(64);
legacyForgedRestore.restore(legacyForgedSnapshot);
assert.equal(legacyForgedRestore.recent(64)[0].provenance, "external");
assert.equal(legacyForgedRestore.recent(64)[0].stateGrounded, false);
assert.equal(legacyForgedRestore.recent(64)[0].replayEligible, false);
assert.equal(legacyForgedRestore.consolidate(8, 1300).length, 0,
  "legacy caller-forged provenance must not be upgraded into trusted consolidated memory");

const externalRestored = new CausalExperienceStream(64);
externalRestored.restore(externalStream.snapshot());
const restoredExternalDuplicate = externalRestored.recordExternalLearningEvent({
  ...externalInput, traceId: "External-Source-17",
});
assert.equal(restoredExternalDuplicate?.id, externalFirst?.id,
  "a restored external outcome must resolve to its original record");
assert.equal(externalRestored.summary().outcomes, 0,
  "a restored duplicate must not increment trusted outcome count");
assert.throws(() => externalRestored.recordExternalLearningEvent({
  ...externalInput, traceId: "External-Source-17", reward01: .05,
}), /causal-external-trace-id-conflict/,
  "the durable duplicate guard must also detect changed payload after restore");
assert.equal(externalRestored.summary().outcomes, 0);

// Legacy snapshots may contain Unicode variants that collapse under the current
// NFKC identity rule. Exact duplicate rows are deduplicated; conflicting rows
// sharing a normalized ID are quarantined and cannot be reintroduced by retry.
const exactDuplicateSnapshot = externalStream.snapshot();
exactDuplicateSnapshot.records.push({
  ...externalFirst, traceId: "Ｅxternal-Source-17",
});
const exactDuplicateRestore = new CausalExperienceStream(64);
exactDuplicateRestore.restore(exactDuplicateSnapshot);
assert.equal(exactDuplicateRestore.recent(64).filter(row => row.traceId === "External-Source-17").length, 1,
  "an exact normalized duplicate in a legacy snapshot must collapse to one record");

const conflictingSnapshot = externalStream.snapshot();
conflictingSnapshot.records.push({
  ...externalFirst, id: "conflicting-normalized-alias", traceId: "Ｅxternal-Source-17", success01: .1,
});
conflictingSnapshot.recordedTraceIds.push("Ｅxternal-Source-17");
const conflictRestore = new CausalExperienceStream(64);
conflictRestore.restore(conflictingSnapshot);
assert.equal(conflictRestore.recent(64).some(row => row.traceId === "External-Source-17"), false,
  "conflicting persisted rows that normalize to the same trace ID must be quarantined");
assert.ok(conflictRestore.snapshot().recordedTraceIds.includes("External-Source-17"),
  "the quarantined normalized identity must remain in the deduplication guard");
assert.equal(conflictRestore.recordExternalLearningEvent({
  ...externalInput, traceId: "External-Source-17",
}), null, "quarantined identity must not be accepted again as a new event");
assert.equal(conflictRestore.summary().outcomes, 0,
  "quarantine/retry must not change the trusted outcome count");

const cyclicSnapshot = externalStream.snapshot();
const cyclicRecord = { ...externalFirst, id: "cyclic-normalized-alias", traceId: "Ｅxternal-Source-17" };
cyclicRecord.corruption = cyclicRecord;
cyclicSnapshot.records.push(cyclicRecord);
const cycleSafeRestore = new CausalExperienceStream(64);
assert.doesNotThrow(() => cycleSafeRestore.restore(cyclicSnapshot),
  "a cyclic persisted row must be quarantined rather than crashing restore");
assert.equal(cycleSafeRestore.recent(64).some(row => row.traceId === "External-Source-17"), false,
  "a non-serializable collision must quarantine all rows for its normalized identity");
assert.ok(cycleSafeRestore.snapshot().recordedTraceIds.includes("External-Source-17"),
  "a cyclic collision must retain its normalized identity in the dedup guard");

assert.throws(() => externalStream.recordExternalLearningEvent({
  ...externalInput, taskId: "   ", traceId: "invalid-task",
}), /causal-external-task-id-required/);
assert.throws(() => externalStream.recordExternalLearningEvent({
  ...externalInput, action: "delete-all", traceId: "invalid-action",
}), /causal-external-action-invalid/);
assert.equal(externalStream.summary().outcomes, 0,
  "invalid external task/action data must not mutate trusted outcome counts");

// IDs are identity keys, not display strings: truncating an overlong value could
// collapse two independent tasks/events into one duplicate and silently lose data.
const longTaskPrefix = "t".repeat(120);
assert.throws(() => externalStream.recordExternalLearningEvent({
  ...externalInput, taskId: longTaskPrefix + "A", traceId: "long-task-A",
}), /causal-external-task-id-invalid/);
assert.throws(() => externalStream.recordExternalLearningEvent({
  ...externalInput, taskId: longTaskPrefix + "B", traceId: "long-task-B",
}), /causal-external-task-id-invalid/);
assert.throws(() => externalStream.recordExternalLearningEvent({
  ...externalInput, traceId: "x".repeat(181),
}), /causal-external-trace-id-invalid/);
assert.throws(() => externalStream.recordExternalLearningEvent({
  ...externalInput, traceId: ["invalid", "trace"].join(String.fromCharCode(10)),
}), /causal-external-trace-id-invalid/);
assert.throws(() => externalStream.recordExternalLearningEvent({
  ...externalInput, traceId: ["invalid", "trace"].join(String.fromCharCode(0x85)),
}), /causal-external-trace-id-invalid/,
  "C1 control characters must also be rejected in trace identities");
assert.throws(() => externalStream.recordExternalLearningEvent({
  ...externalInput, taskId: ["external", "task"].join(String.fromCharCode(1)), traceId: "control-task-id",
}), /causal-external-task-id-invalid/,
  "C0 control characters must be rejected in task identities");
assert.throws(() => externalStream.recordExternalLearningEvent({
  ...externalInput, traceId: String.fromCharCode(10) + "edge-trace",
}), /causal-external-trace-id-invalid/,
  "leading control characters must be rejected rather than trimmed away");
assert.throws(() => externalStream.recordExternalLearningEvent({
  ...externalInput, traceId: "edge-trace" + String.fromCharCode(9),
}), /causal-external-trace-id-invalid/,
  "trailing control characters must be rejected rather than trimmed away");
assert.throws(() => externalStream.recordExternalLearningEvent({
  ...externalInput, taskId: "edge-task" + String.fromCharCode(10), traceId: "control-task-edge",
}), /causal-external-task-id-invalid/,
  "task IDs with trailing control characters must not normalize into ordinary IDs");
assert.equal(externalStream.summary().outcomes, 0,
  "overlong or control-bearing identity keys must fail before mutating trusted outcome counts");

const overlongRuntimeTrace = { ...trace, id: "r".repeat(181) };
assert.equal(externalStream.recordOutcome(
  overlongRuntimeTrace, mkState({ tick: 22 }),
  { reward01: .5, success01: .5, surprise01: .5, novelty01: .5 },
), null, "an overlong runtime trace cannot be silently truncated into another identity");
assert.equal(externalStream.summary().outcomes, 0);

const corruptSnapshot = externalStream.snapshot();
corruptSnapshot.records.push({
  ...externalFirst, id: "corrupt-overlong-trace", traceId: "z".repeat(181),
});
corruptSnapshot.recordedTraceIds.push("z".repeat(181));
const sanitizedRestore = new CausalExperienceStream(64);
sanitizedRestore.restore(corruptSnapshot);
assert.equal(sanitizedRestore.recent(64).some(row => row.id === "corrupt-overlong-trace"), false,
  "restore must discard a persisted record whose trace identity violates the current bound");
assert.equal(sanitizedRestore.snapshot().recordedTraceIds.includes("z".repeat(181)), false,
  "restore must not reintroduce overlong deduplication identities");

// Even after the causal row is evicted from the bounded record window, the
// retained event-ID guard prevents a late retry from creating a second outcome.
const boundedDuplicateStream = new CausalExperienceStream(64);
const boundedOriginal = boundedDuplicateStream.recordExternalLearningEvent({
  ...externalInput, traceId: "retained-after-eviction", taskId: "bounded-original",
});
assert.ok(boundedOriginal);
for (let i = 0; i < 64; i++) {
  boundedDuplicateStream.recordExternalLearningEvent({
    ...externalInput, traceId: `bounded-fill-${i}`, taskId: `bounded-fill-task-${i}`, tick: 100 + i,
  });
}
assert.equal(boundedDuplicateStream.recent(64).some(row => row.traceId === "retained-after-eviction"), false,
  "the first causal record should be outside the bounded record window");
const outcomesBeforeEvictedRetry = boundedDuplicateStream.summary().outcomes;
assert.equal(boundedDuplicateStream.recordExternalLearningEvent({
  ...externalInput, traceId: "retained-after-eviction", taskId: "bounded-original",
}), null, "a retained ID with an evicted record must not be recorded a second time");
assert.equal(boundedDuplicateStream.summary().outcomes, outcomesBeforeEvictedRetry,
  "late duplicate after bounded eviction must not change outcome counts");

const replayDiversity = new CausalExperienceStream(64);
for (let i = 0; i < 3; i++) {
  replayDiversity.recordOutcome({
    ...trace, id: `replay-a-${i}`, tick: 10 + i,
    stateBefore: mkState({ tick: 10 + i }),
    selected: { ...trace.selected, goalId: "task-A" },
  }, mkState({ tick: 11 + i, lastAction: trace.selected.action, lastActionSuccess: .7 }), { reward01: .7, success01: .7, surprise01: .6, novelty01: .5 });
}
replayDiversity.recordOutcome({
  ...trace, id: "replay-b-0", tick: 20,
  stateBefore: mkState({ tick: 20 }),
  selected: { ...trace.selected, goalId: "task-B" },
}, mkState({ tick: 21, lastAction: trace.selected.action, lastActionSuccess: .7 }), { reward01: .7, success01: .7, surprise01: .6, novelty01: .5 });
const replayBatch = replayDiversity.prioritizedReplayCandidates(2);
assert.ok(replayBatch.some((row) => row.taskId === "task-A"));
assert.ok(replayBatch.some((row) => row.taskId === "task-B"),
  "a near-equal high-priority task should not be crowded out by one repeated task");
// A plausible feature vector is not enough to make transformed/repair evidence a
// runtime outcome. Only records minted by the observed runtime outcome path may
// enter replay or consolidation after restore.
const forgedDerivedSnapshot = externalStream.snapshot();
forgedDerivedSnapshot.records[0] = {
  ...forgedDerivedSnapshot.records[0],
  provenance: "skill-repair",
  stateGrounded: true,
  replayEligible: true,
  policyFeatures01: Array(16).fill(0.5),
};
const forgedDerivedRestore = new CausalExperienceStream(64);
forgedDerivedRestore.restore(forgedDerivedSnapshot);
assert.equal(forgedDerivedRestore.recent(64)[0].provenance, "external",
  "skill-repair evidence must not inherit runtime trust from a feature vector");
assert.equal(forgedDerivedRestore.prioritizedReplayCandidates(8).length, 0,
  "non-runtime provenance must never enter policy replay");
assert.equal(forgedDerivedRestore.consolidate(8, 1400).length, 0,
  "non-runtime provenance must never be consolidated as grounded memory");

// Persisted rows are also untrusted input: reject malformed schema values instead
// of allowing NaN/out-of-range metrics or invalid action/task identities downstream.
const malformedSnapshot = externalStream.snapshot();
malformedSnapshot.records.push({
  ...externalFirst, id: "malformed-nan-reward", traceId: "malformed-nan-reward",
  reward01: Number.NaN,
});
malformedSnapshot.records.push({
  ...externalFirst, id: "malformed-action", traceId: "malformed-action",
  action: "erase-memory",
});
malformedSnapshot.records.push({
  ...externalFirst, id: "malformed-task", traceId: "malformed-task",
  taskId: "unsafe" + String.fromCharCode(10) + "task",
});
const malformedRestore = new CausalExperienceStream(64);
malformedRestore.restore(malformedSnapshot);
assert.equal(malformedRestore.recent(64).some(row => row.traceId.startsWith("malformed-")), false,
  "restore must reject records with non-finite metrics, unsupported actions, or invalid task IDs");
assert.equal(malformedRestore.prioritizedReplayCandidates(64).length, 0,
  "malformed persisted records must not become replay candidates");


// Aggregate snapshot fields are also untrusted. Normalize poisoned counters and
// rolling metrics, and recompute behavioral aggregates from eligible runtime rows.
const poisonedAggregates = externalStream.snapshot();
poisonedAggregates.observations = Number.NaN;
poisonedAggregates.outcomes = -9;
poisonedAggregates.consolidated = Number.POSITIVE_INFINITY;
poisonedAggregates.lastConsolidatedAt = Number.NaN;
poisonedAggregates.rolling = {
  surprise01: Number.NaN, predictionError01: 2,
  causalStrength01: -1, learningOpportunity01: 0.4,
};
poisonedAggregates.behavioralImpact01 = 1;
poisonedAggregates.behavioralContextSamples = 999999;
poisonedAggregates.behavioralDivergence01 = 1;
const aggregateRestore = new CausalExperienceStream(64);
aggregateRestore.restore(poisonedAggregates);
const safeAggregateSnapshot = aggregateRestore.snapshot();
assert.equal(safeAggregateSnapshot.observations, 0, "invalid persisted observation count must be reset");
assert.equal(safeAggregateSnapshot.outcomes, 0,
  "aggregate restore must not promote external-only rows into trusted outcomes");
assert.equal(safeAggregateSnapshot.consolidated, safeAggregateSnapshot.records.filter(row => row.consolidated).length,
  "invalid persisted consolidation count must fall back to retained consolidated rows");
assert.equal(safeAggregateSnapshot.lastConsolidatedAt, 0, "invalid consolidation timestamp must be reset");
assert.deepEqual(safeAggregateSnapshot.rolling, {
  surprise01: 0, predictionError01: 0, causalStrength01: 0, learningOpportunity01: 0,
}, "rolling metrics must be finite and within normalized bounds");
assert.equal(safeAggregateSnapshot.behavioralImpact01, 0,
  "persisted behavioral impact must be recomputed instead of trusted");
assert.equal(safeAggregateSnapshot.behavioralContextSamples, 0,
  "persisted behavioral sample count must be recomputed instead of trusted");
assert.equal(safeAggregateSnapshot.behavioralDivergence01, 0,
  "persisted behavioral divergence must be recomputed instead of trusted");

// Imported records may inform later review, but must not masquerade as observed
// behavioral change in the runtime policy.
const externalBehaviorStream = new CausalExperienceStream(64);
for (const [i, action] of ["respond", "explore", "verify", "rest"].entries()) {
  externalBehaviorStream.recordExternalLearningEvent({
    ...externalInput, traceId: `external-behavior-${i}`, taskId: "same-external-task", action,
    tick: 200 + i, reward01: i / 3, success01: i / 3,
  });
}
assert.equal(externalBehaviorStream.summary().behavioralContextSamples, 0,
  "external-only action variation must not count as runtime behavioral adaptation");
assert.equal(externalBehaviorStream.summary().behavioralImpact01, 0,
  "untrusted imported evidence must not move the runtime behavioral-impact metric");

console.log('BIG_PASS_90_CAUSAL_STREAM=PASS');
