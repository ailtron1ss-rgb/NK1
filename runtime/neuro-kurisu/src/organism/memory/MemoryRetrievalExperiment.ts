import {
  runMemoryOS2RetrievalBenchmark,
  type MemoryRetrievalBenchmarkExample,
  type MemoryRetrievalBenchmarkOptions,
} from './MemoryRetrievalBenchmark.ts';
import type { MemoryOSState2 } from '../developmental/MemoryOS2.ts';

export interface MemoryRetrievalExperimentOptions extends MemoryRetrievalBenchmarkOptions {
  /** Seeds only vary paired-bootstrap resampling; retrieval itself is deterministic. */
  seeds?: number[];
}

const DEFAULT_SEEDS = [11, 29, 47, 71, 101];
const boundedSeed = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= 0xffffffff ? number : null;
};

function qualitySignature(report: ReturnType<typeof runMemoryOS2RetrievalBenchmark>) {
  const metrics = (value: typeof report.metrics.candidate) => ({
    queries: value.queries,
    answerableQueries: value.answerableQueries,
    unanswerableQueries: value.unanswerableQueries,
    unsupportedRetrievalCount: value.unsupportedRetrievalCount,
    unsupportedRetrievalRate01: value.unsupportedRetrievalRate01,
    correctAbstentionRate01: value.correctAbstentionRate01,
    falseAbstentionCount: value.falseAbstentionCount,
    falseAbstentionRate01: value.falseAbstentionRate01,
    recallAtK01: value.recallAtK01,
    mrr01: value.mrr01,
    precisionAtK01: value.precisionAtK01,
    queryCoverage01: value.queryCoverage01,
    quarantinedResultCount: value.quarantinedResultCount,
    staleResultCount: value.staleResultCount,
    futureResultCount: value.futureResultCount,
    dormantResultCount: value.dormantResultCount,
    invalidEpistemicStatusResultCount: value.invalidEpistemicStatusResultCount,
    duplicateResultCount: value.duplicateResultCount,
    invalidResultRate01: value.invalidResultRate01,
  });
  const languageSlices: Record<string, unknown> = {};
  for (const language of ['en', 'ru', 'other'] as const) {
    const slice = report.languageStratification.slices[language];
    if (!slice) continue;
    languageSlices[language] = {
      trainQueries: slice.trainQueries,
      holdoutQueries: slice.holdoutQueries,
      answerableHoldoutQueries: slice.answerableHoldoutQueries,
      unanswerableHoldoutQueries: slice.unanswerableHoldoutQueries,
      baseline: metrics(slice.metrics.baseline),
      candidate: metrics(slice.metrics.candidate),
      trainBaseline: metrics(slice.metrics.train.baseline),
      trainCandidate: metrics(slice.metrics.train.candidate),
      deltas: slice.deltas,
    };
  }
  // Timing is deliberately excluded from the deterministic quality signature.
  // p95 latency is measured separately; host scheduling and cache warmth vary.
  const stableMetrics = (value: any) => ({
    queries: value.queries, answerableQueries: value.answerableQueries, unanswerableQueries: value.unanswerableQueries,
    unsupportedRetrievalCount: value.unsupportedRetrievalCount, unsupportedRetrievalRate01: value.unsupportedRetrievalRate01,
    correctAbstentionRate01: value.correctAbstentionRate01, falseAbstentionCount: value.falseAbstentionCount,
    falseAbstentionRate01: value.falseAbstentionRate01, recallAtK01: value.recallAtK01, mrr01: value.mrr01,
    precisionAtK01: value.precisionAtK01, queryCoverage01: value.queryCoverage01,
    quarantinedResultCount: value.quarantinedResultCount, staleResultCount: value.staleResultCount,
    futureResultCount: value.futureResultCount, dormantResultCount: value.dormantResultCount,
    invalidEpistemicStatusResultCount: value.invalidEpistemicStatusResultCount, duplicateResultCount: value.duplicateResultCount,
    invalidResultRate01: value.invalidResultRate01,
  });
  const taskCategorySlices = Object.fromEntries(Object.entries(report.taskCategoryStratification?.slices ?? {}).map(([category, rawSlice]) => {
    const slice = rawSlice as any;
    return [category, { holdoutQueries: slice.holdoutQueries, answerableHoldoutQueries: slice.answerableHoldoutQueries,
      unanswerableHoldoutQueries: slice.unanswerableHoldoutQueries, baseline: stableMetrics(slice.baseline),
      candidate: stableMetrics(slice.candidate), deltas: slice.deltas }];
  }));
  const taskCategorySignature = { enabled: report.taskCategoryStratification?.enabled,
    annotationsComplete: report.taskCategoryStratification?.annotationsComplete,
    categories: report.taskCategoryStratification?.categories, slices: taskCategorySlices };
  const conversationIntegritySignature = {
    annotationUsed: report.datasetIntegrity.conversationAnnotationUsed,
    annotationComplete: report.datasetIntegrity.conversationAnnotationComplete,
    trainGroups: report.datasetIntegrity.uniqueTrainConversationGroups,
    holdoutGroups: report.datasetIntegrity.uniqueHoldoutConversationGroups,
    crossSplitLeakage: report.datasetIntegrity.crossSplitConversationLeakageCount,
    multiSessionComplete: report.datasetIntegrity.multiSessionConversationAnnotationComplete,
  };
  return JSON.stringify({ baseline: metrics(report.metrics.baseline), candidate: metrics(report.metrics.candidate), trainBaseline: metrics(report.metrics.train.baseline), trainCandidate: metrics(report.metrics.train.candidate), baselineConfigurationFingerprint: report.baselineConfigurationFingerprint, deltas: report.deltas, languageStratification: { enabled: report.languageStratification.enabled, annotationsComplete: report.languageStratification.annotationsComplete, slices: languageSlices }, taskCategoryStratification: taskCategorySignature, conversationIntegrity: conversationIntegritySignature });
}

/**
 * Offline benchmark experiment. It repeats the same fixed corpus/labels over several
 * bootstrap seeds to check interval sensitivity and retrieval-metric determinism.
 * Seeds are not model-training seeds: MemoryOS2 retrieval has no training step here.
 * This function never promotes the candidate or writes to live memory/policy state.
 */
export function runMemoryOS2RetrievalExperiment(
  snapshot: MemoryOSState2,
  examples: MemoryRetrievalBenchmarkExample[],
  options: MemoryRetrievalExperimentOptions = {},
) {
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const suppliedSeeds = Array.isArray(options.seeds) && options.seeds.length ? options.seeds : DEFAULT_SEEDS;
  const seeds = [...new Set(suppliedSeeds.map(boundedSeed).filter((value): value is number => value !== null))].slice(0, 9);
  if (seeds.length < 3) throw new Error('experiment-requires-at-least-3-distinct-bootstrap-seeds');

  const benchmarkOptions: MemoryRetrievalBenchmarkOptions = { ...options, now, maxExamples: Math.max(64, Math.min(512, Math.floor(Number(options.maxExamples ?? 512)))) };
  delete (benchmarkOptions as MemoryRetrievalExperimentOptions).seeds;
  const runs = seeds.map(seed => runMemoryOS2RetrievalBenchmark(snapshot, examples, { ...benchmarkOptions, seed }));
  const signatures = runs.map(qualitySignature);
  const metricsDeterministic = signatures.every(signature => signature === signatures[0]);
  const recallIntervals = runs.map(run => run.confidence.recallAtK01);
  const mrrIntervals = runs.map(run => run.confidence.mrr01);
  const requestedUplift = Number(runs[0]?.promotion.minimumRecallUplift01 ?? .02);
  const allRecallIntervalsPositive = recallIntervals.every(interval => interval.lowerBound01 > 0);
  const allRecallIntervalsSupportPracticalUplift = recallIntervals.every(interval => interval.lowerBound01 >= requestedUplift);
  const maximumMrrRegression = Number(runs[0]?.promotion.maximumMrrRegression01 ?? .01);
  const allMrrIntervalsNonInferior = mrrIntervals.every(interval => interval.lowerBound01 >= -maximumMrrRegression);
  const allSingleRunsEligible = runs.every(run => run.promotion.allowed);
  const provenanceConsistent = runs.every(run => run.datasetFingerprint === runs[0]?.datasetFingerprint && run.corpusFingerprint === runs[0]?.corpusFingerprint && run.retrievalConfigurationFingerprint === runs[0]?.retrievalConfigurationFingerprint);
  const independentReviewEligible = metricsDeterministic && provenanceConsistent && allSingleRunsEligible && allRecallIntervalsSupportPracticalUplift && allMrrIntervalsNonInferior;

  const min = (values: number[]) => Number(Math.min(...values).toFixed(4));
  const max = (values: number[]) => Number(Math.max(...values).toFixed(4));
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return Number((sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2).toFixed(4));
  };
  const perSeed = runs.map((run, index) => ({
    seed: seeds[index],
    recallDelta01: run.deltas.recallAtK01,
    mrrDelta01: run.deltas.mrr01,
    recallConfidence: run.confidence.recallAtK01,
    mrrConfidence: run.confidence.mrr01,
    candidateHoldout: run.metrics.candidate,
    languageStratification: run.languageStratification,
    taskCategoryStratification: run.taskCategoryStratification,
    conversationGrouping: {
      samplingUnit: run.confidence.samplingUnit,
      independentHoldoutGroups: run.confidence.independentHoldoutGroups,
      trainGroups: run.datasetIntegrity.uniqueTrainConversationGroups,
      conversationAnnotationsComplete: run.datasetIntegrity.conversationAnnotationComplete,
      crossSplitLeakageCount: run.datasetIntegrity.crossSplitConversationLeakageCount,
    },
    singleRunPromotionStatus: run.promotion.status,
    singleRunPromotionReason: run.promotion.reason,
    mrrConfidenceNonInferioritySupported: run.promotion.mrrNonInferioritySupported,
    failedPromotionGates: Object.entries(run.promotion.gates ?? {}).filter(([, passed]) => passed === false).map(([gate]) => gate),
  }));

  return {
    schemaVersion: 1 as const,
    experiment: 'memoryos2-retrieval-bootstrap-seed-sensitivity',
    mode: 'offline-clone; no-live-state-mutation; no-automatic-promotion' as const,
    seedSemantics: 'Seeds vary paired-bootstrap resampling only; they do not train or randomize the retrieval algorithm.',
    now,
    seedCount: seeds.length,
    seeds,
    bootstrapSamplesPerSeed: runs[0]?.confidence.recallAtK01.samples ?? 0,
    corpusSize: runs[0]?.corpusSize ?? 0,
    trainQueries: runs[0]?.trainQueries ?? 0,
    holdoutQueries: runs[0]?.holdoutQueries ?? 0,
    datasetFingerprint: runs[0]?.datasetFingerprint ?? '',
    corpusFingerprint: runs[0]?.corpusFingerprint ?? '',
    retrievalConfigurationFingerprint: runs[0]?.retrievalConfigurationFingerprint ?? '',
    corpusIntegrity: runs[0]?.corpusIntegrity ?? null,
    datasetIntegrity: runs[0]?.datasetIntegrity ?? null,
    datasetProvenance: runs[0]?.datasetProvenance ?? null,
    determinism: {
      retrievalQualityMetricsStableAcrossSeeds: metricsDeterministic,
      datasetCorpusAndRetrievalConfigurationFingerprintsStableAcrossSeeds: provenanceConsistent,
      qualityMetricsFingerprint: signatures[0] ?? '',
    },
    sensitivity: {
      recallLowerBoundMin01: min(recallIntervals.map(x => x.lowerBound01)),
      recallLowerBoundMedian01: median(recallIntervals.map(x => x.lowerBound01)),
      recallUpperBoundMax01: max(recallIntervals.map(x => x.upperBound01)),
      mrrLowerBoundMin01: min(mrrIntervals.map(x => x.lowerBound01)),
      mrrUpperBoundMax01: max(mrrIntervals.map(x => x.upperBound01)),
      positiveRecallIntervals: recallIntervals.filter(x => x.lowerBound01 > 0).length,
      practicalUpliftSupportedAcrossAllSeeds: allRecallIntervalsSupportPracticalUplift,
      mrrNonInferioritySupportedAcrossAllSeeds: allMrrIntervalsNonInferior,
      maximumMrrRegression01: maximumMrrRegression,
    },
    taskCategoryStratification: runs[0]?.taskCategoryStratification ?? null,
    runs: perSeed,
    promotion: {
      allowed: false,
      status: independentReviewEligible ? 'candidate-eligible-for-independent-review' : 'not-promoted',
      reason: !metricsDeterministic ? 'retrieval-metrics-not-deterministic' : !provenanceConsistent ? 'fingerprint-instability' : !allRecallIntervalsPositive ? 'recall-uplift-not-confidence-supported-across-seeds' : !allRecallIntervalsSupportPracticalUplift ? 'practical-recall-uplift-not-supported-across-seeds' : !allMrrIntervalsNonInferior ? 'mrr-regression-not-confidence-bounded-across-seeds' : !allSingleRunsEligible ? 'one-or-more-seed-runs-failed-existing-gates' : 'all-experiment-gates-passed-independent-review-still-required',
      requiresIndependentHumanOrCIReview: true,
      liveStateChanged: false,
      candidateAutomaticallyPromoted: false,
    },
  };
}
