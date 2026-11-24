import type { EvaluationSplit, TaskManifestEntry, VerifiedTaskOutcome } from './VerifiedOutcomeLedger.ts';
import { VerifiedOutcomeLedger } from './VerifiedOutcomeLedger.ts';
import { evaluateContinualLearning, type ContinualLearningMetrics, type ContinualTask } from './ContinualLearningMetrics.ts';

export interface ContinualStage {
  /** A stable label for this checkpoint, e.g. "context-only" or "replay-32". */
  stageId: string;
  /** Exact method value written by the outcome recorder. */
  method: string;
}
export interface ContinualOutcomeCell {
  taskId: string;
  family: string;
  stageId: string;
  method: string;
  sampleCount: number;
  passedCount: number;
  passRate: number;
  /** Wilson score interval for a binomial pass rate; descriptive, not a causal guarantee. */
  wilson95CI: [number, number];
}
export interface ContinualFamilySummary {
  family: string;
  taskCount: number;
  /** Family-level pooled outcomes per checkpoint; do not infer independence across tasks. */
  stages: Array<{ stageId: string; method: string; sampleCount: number; passedCount: number; passRate: number }>;
  finalPassRate: number;
  averageForgetting: number;
  averageBackwardTransfer: number;
}

/** Counts for matched sample-level pass/fail transitions between two checkpoints. */
export interface SampleTransitionSummary {
  fromStageId: string;
  toStageId: string;
  fromMethod: string;
  toMethod: string;
  sampleCount: number;
  passedToFailed: number;
  failedToPassed: number;
  retainedPass: number;
  retainedFail: number;
  /** Pass -> fail divided by samples passing at the source checkpoint; null if denominator is zero. */
  forgettingRate: number | null;
  /** Fail -> pass divided by samples failing at the source checkpoint; null if denominator is zero. */
  recoveryRate: number | null;
  /** Net pass transition divided by matched samples; descriptive, not causal. */
  netTransferRate: number;
}
export interface TaskSampleTransitionSummary extends SampleTransitionSummary {
  taskId: string;
  family: string;
}
export interface FamilySampleTransitionSummary extends SampleTransitionSummary {
  family: string;
}
export interface ContinualOutcomeMatrix {
  manifestFingerprint: string;
  split: EvaluationSplit;
  stages: ContinualStage[];
  seedCount: number;
  taskCount: number;
  tasks: ContinualTask[];
  /** Per-task/per-stage outcome detail, including sample counts and uncertainty. */
  cells: ContinualOutcomeCell[];
  familySummaries: ContinualFamilySummary[];
  /** Matched sample transitions: baseline-to-first checkpoint (when available) and adjacent checkpoints. */
  sampleTransitions: SampleTransitionSummary[];
  /** Same transitions broken down by task, without treating tasks as independent seeds. */
  taskSampleTransitions: TaskSampleTransitionSummary[];
  /** Same transition counts stratified by task family. */
  familySampleTransitions: FamilySampleTransitionSummary[];
  metrics: ContinualLearningMetrics;
  evidence: {
    outcomeCount: number;
    authorityCounts: Record<'independent-verifier' | 'human-review', number>;
    seedIds: number[];
    taskVersions: Record<string, string>;
    taskFamilies: Record<string, string>;
  };
}

/**
 * Build a sequential task-by-checkpoint matrix from the durable evidence ledger.
 * Each cell is a pass-rate over the *same* seed set. Only independently verified
 * or human-reviewed outcomes from the requested split are eligible. Attempt 1 is
 * used deliberately so retries cannot inflate success rates. This adapter does
 * not run the learner, fetch evidence, or authenticate the verifier itself.
 */
function wilsonInterval(passedCount: number, sampleCount: number): [number, number] {
  if (!Number.isInteger(sampleCount) || sampleCount < 1 || !Number.isInteger(passedCount) || passedCount < 0 || passedCount > sampleCount) {
    throw new Error('Wilson interval requires valid binomial counts');
  }
  const z = 1.96;
  const z2 = z * z;
  const p = passedCount / sampleCount;
  const denominator = 1 + z2 / sampleCount;
  const center = (p + z2 / (2 * sampleCount)) / denominator;
  const margin = z * Math.sqrt(p * (1 - p) / sampleCount + z2 / (4 * sampleCount * sampleCount)) / denominator;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

export function buildContinualOutcomeMatrix(
  ledger: VerifiedOutcomeLedger,
  stages: ContinualStage[],
  options: { split?: EvaluationSplit; referenceScore?: number; preTrainingMethod?: string } = {},
): ContinualOutcomeMatrix {
  if (!Array.isArray(stages) || stages.length < 1) throw new Error('at least one stage is required');
  const stageIds = new Set<string>();
  const methods = new Set<string>();
  for (const [i, stage] of stages.entries()) {
    if (!stage || typeof stage.stageId !== 'string' || !stage.stageId.trim() ||
        typeof stage.method !== 'string' || !stage.method.trim()) throw new Error(`stage ${i} requires stageId and method`);
    if (stageIds.has(stage.stageId)) throw new Error(`duplicate stageId: ${stage.stageId}`);
    if (methods.has(stage.method)) throw new Error(`duplicate stage method: ${stage.method}`);
    stageIds.add(stage.stageId); methods.add(stage.method);
  }
  if (options.preTrainingMethod !== undefined && (!options.preTrainingMethod.trim() || methods.has(options.preTrainingMethod))) {
    throw new Error('pre-training method must be non-empty and distinct from checkpoint methods');
  }
  const split = options.split ?? 'holdout';
  const snapshot = ledger.snapshot();
  const manifest = snapshot.manifest as TaskManifestEntry[];
  const outcomes = snapshot.outcomes as VerifiedTaskOutcome[];
  const tasksInSplit = manifest.filter(task => task.split === split).sort((a,b) => a.taskId.localeCompare(b.taskId));
  if (!tasksInSplit.length) throw new Error(`no manifest tasks in split: ${split}`);
  if (stages.length !== tasksInSplit.length) throw new Error('stage count must equal task count for a sequential task matrix');
  const selectedMethods = new Set([
    ...stages.map(stage => stage.method),
    ...(options.preTrainingMethod ? [options.preTrainingMethod] : []),
  ]);
  const eligible = outcomes.filter(outcome =>
    outcome.attempt === 1 &&
    (outcome.authority === 'independent-verifier' || outcome.authority === 'human-review') &&
    tasksInSplit.some(task => task.taskId === outcome.taskId) &&
    selectedMethods.has(outcome.method));
  const cell = new Map<string, Map<number, boolean>>();
  for (const outcome of eligible) {
    const key = JSON.stringify([outcome.taskId, outcome.method]);
    const seeds = cell.get(key) ?? new Map<number, boolean>();
    if (seeds.has(outcome.seed)) throw new Error(`duplicate eligible seed cell: ${outcome.taskId}/${outcome.method}/${outcome.seed}`);
    seeds.set(outcome.seed, outcome.passed);
    cell.set(key, seeds);
  }
  const seedSets = stages.flatMap(stage => tasksInSplit.map(task => {
    const values = cell.get(JSON.stringify([task.taskId, stage.method]));
    if (!values || values.size === 0) throw new Error(`missing outcomes for task ${task.taskId}, method ${stage.method}`);
    return [...values.keys()].sort((a,b) => a-b);
  }));
  const canonicalSeeds = seedSets[0]!;
  for (const seeds of seedSets) {
    if (seeds.length !== canonicalSeeds.length || seeds.some((seed,i) => seed !== canonicalSeeds[i])) {
      throw new Error('all task/stage cells must use the exact same seed set');
    }
  }
  const referenceScore = options.referenceScore ?? 0;
  const tasks: ContinualTask[] = tasksInSplit.map(task => {
    const scoreByStage = stages.map(stage => {
      const values = cell.get(JSON.stringify([task.taskId, stage.method]))!;
      return [...values.values()].reduce((sum, passed) => sum + Number(passed), 0) / values.size;
    });
    let preTrainingScore: number | undefined;
    if (options.preTrainingMethod) {
      const baseline = cell.get(JSON.stringify([task.taskId, options.preTrainingMethod]));
      if (!baseline || baseline.size !== canonicalSeeds.length ||
          [...baseline.keys()].sort((a,b) => a-b).some((seed,i) => seed !== canonicalSeeds[i])) {
        throw new Error(`pre-training method lacks matched seeds for task ${task.taskId}`);
      }
      preTrainingScore = [...baseline.values()].reduce((sum, passed) => sum + Number(passed), 0) / baseline.size;
    }
    return { taskId: task.taskId, ...(preTrainingScore === undefined ? {} : { preTrainingScore }), scoreByStage };
  });
  const cells: ContinualOutcomeCell[] = tasksInSplit.flatMap(task => stages.map(stage => {
    const values = cell.get(JSON.stringify([task.taskId, stage.method]))!;
    const passedCount = [...values.values()].filter(Boolean).length;
    return {
      taskId: task.taskId, family: task.family, stageId: stage.stageId, method: stage.method,
      sampleCount: values.size, passedCount, passRate: passedCount / values.size,
      wilson95CI: wilsonInterval(passedCount, values.size),
    };
  }));
  const authorityCounts = { 'independent-verifier': 0, 'human-review': 0 };
  for (const outcome of eligible) authorityCounts[outcome.authority as keyof typeof authorityCounts]++;
  const taskVersions: Record<string,string> = {}, taskFamilies: Record<string,string> = {};
  for (const task of tasksInSplit) { taskVersions[task.taskId] = task.version; taskFamilies[task.taskId] = task.family; }
  const metrics = evaluateContinualLearning(tasks, referenceScore);

  const transitionPairs:Array<{fromStageId:string;fromMethod:string;toStageId:string;toMethod:string}>=[
    ...(options.preTrainingMethod?[{
      fromStageId:options.preTrainingMethod,fromMethod:options.preTrainingMethod,
      toStageId:stages[0]!.stageId,toMethod:stages[0]!.method,
    }]:[]),
    ...stages.slice(1).map((stage,index)=>({
      fromStageId:stages[index]!.stageId,fromMethod:stages[index]!.method,
      toStageId:stage.stageId,toMethod:stage.method,
    })),
  ];
  const withTransitionRates=(pair:{fromStageId:string;fromMethod:string;toStageId:string;toMethod:string},counts:{
    sampleCount:number;passedToFailed:number;failedToPassed:number;retainedPass:number;retainedFail:number;
  }):SampleTransitionSummary=>{
    const sourcePass=counts.passedToFailed+counts.retainedPass;
    const sourceFail=counts.failedToPassed+counts.retainedFail;
    return {
      ...pair,...counts,
      forgettingRate:sourcePass?counts.passedToFailed/sourcePass:null,
      recoveryRate:sourceFail?counts.failedToPassed/sourceFail:null,
      netTransferRate:counts.sampleCount?(counts.failedToPassed-counts.passedToFailed)/counts.sampleCount:0,
    };
  };
  const taskSampleTransitions:TaskSampleTransitionSummary[]=transitionPairs.flatMap(pair=>tasksInSplit.map(task=>{
    const before=cell.get(JSON.stringify([task.taskId,pair.fromMethod]));
    const after=cell.get(JSON.stringify([task.taskId,pair.toMethod]));
    if(!before||!after)throw new Error(`missing matched sample transitions for ${task.taskId}: ${pair.fromMethod} -> ${pair.toMethod}`);
    let sampleCount=0,passedToFailed=0,failedToPassed=0,retainedPass=0,retainedFail=0;
    for(const seed of canonicalSeeds){
      const was=before.get(seed),now=after.get(seed);
      if(typeof was!=='boolean'||typeof now!=='boolean')throw new Error(`incomplete matched sample transition for ${task.taskId}/${seed}`);
      sampleCount++;
      if(was&&!now)passedToFailed++;
      else if(!was&&now)failedToPassed++;
      else if(was&&now)retainedPass++;
      else retainedFail++;
    }
    return {taskId:task.taskId,family:task.family,...withTransitionRates(pair,{sampleCount,passedToFailed,failedToPassed,retainedPass,retainedFail})};
  }));
  const aggregateTransitions=(pair:{fromStageId:string;fromMethod:string;toStageId:string;toMethod:string},rows:SampleTransitionSummary[]):SampleTransitionSummary=>{
    const sum=(key:'sampleCount'|'passedToFailed'|'failedToPassed'|'retainedPass'|'retainedFail')=>rows.reduce((total,row)=>total+row[key],0);
    return withTransitionRates(pair,{
      sampleCount:sum('sampleCount'),passedToFailed:sum('passedToFailed'),failedToPassed:sum('failedToPassed'),
      retainedPass:sum('retainedPass'),retainedFail:sum('retainedFail'),
    });
  };
  const sampleTransitions=transitionPairs.map(pair=>aggregateTransitions(pair,
    taskSampleTransitions.filter(row=>row.fromMethod===pair.fromMethod&&row.toMethod===pair.toMethod)));
  const families=[...new Set(tasksInSplit.map(task=>task.family))].sort();
  const familySampleTransitions:FamilySampleTransitionSummary[]=transitionPairs.flatMap(pair=>families.map(family=>({
    family,
    ...aggregateTransitions(pair,taskSampleTransitions.filter(row=>
      row.family===family&&row.fromMethod===pair.fromMethod&&row.toMethod===pair.toMethod)),
  })));
  const taskMetricById = new Map(metrics.perTask.map(item => [item.taskId, item]));
  const familySummaries: ContinualFamilySummary[] = [...new Set(tasksInSplit.map(task => task.family))].sort().map(family => {
    const familyTasks = tasksInSplit.filter(task => task.family === family);
    const familyCells = cells.filter(item => item.family === family);
    const familyStages = stages.map(stage => {
      const stageCells = familyCells.filter(item => item.stageId === stage.stageId);
      const sampleCount = stageCells.reduce((sum, item) => sum + item.sampleCount, 0);
      const passedCount = stageCells.reduce((sum, item) => sum + item.passedCount, 0);
      return { stageId: stage.stageId, method: stage.method, sampleCount, passedCount, passRate: sampleCount ? passedCount / sampleCount : 0 };
    });
    const familyMetrics = familyTasks.map(task => taskMetricById.get(task.taskId)!);
    const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    return {
      family, taskCount: familyTasks.length, stages: familyStages,
      finalPassRate: familyStages.at(-1)?.passRate ?? 0,
      averageForgetting: mean(familyMetrics.map(item => item.forgetting)),
      averageBackwardTransfer: mean(familyMetrics.map(item => item.backwardTransfer)),
    };
  });
  return {
    manifestFingerprint: ledger.manifestFingerprint(), split, stages: stages.map(stage => ({...stage})),
    seedCount: canonicalSeeds.length, taskCount: tasks.length, tasks, cells, familySummaries,
    sampleTransitions, taskSampleTransitions, familySampleTransitions,
    metrics,
    evidence: { outcomeCount: eligible.length, authorityCounts, seedIds: canonicalSeeds, taskVersions, taskFamilies },
  };
}
