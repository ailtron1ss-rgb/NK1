import type { SkillLearnBenchCandidateGateReport, SkillLearnBenchTrialReport } from './SkillLearnBenchAdapter.ts';

export type SkillRevisionDimension = 'safety' | 'task-success' | 'trajectory' | 'capability-coverage' | 'executability' | 'holdout-generalization';

export interface SkillRevisionTarget {
  dimension: SkillRevisionDimension;
  priority01: number;
  affectedTaskIds: string[];
  evidenceCount: number;
  evidenceIds: string[];
  directive: string;
}

export interface SkillRevisionPlan {
  candidateEligible: boolean;
  blockedBySafety: boolean;
  overallFitness01: number;
  targets: SkillRevisionTarget[];
  preserve: string[];
  rationale: string[];
  optimizerInstruction: string;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export function renderSkillRevisionInstruction(plan: Readonly<SkillRevisionPlan>): string {
  const lines = [
    'Revise the existing skill using only the evidence-linked targets below.',
    'Make the smallest targeted change that addresses observed failures; do not invent evidence or claim tests passed.',
    'Preserve all listed contracts and safety constraints. Never trade safety for task success.',
    plan.blockedBySafety ? 'STOP: a safety violation was observed. Do not optimize performance or broaden capabilities. Produce only a safety-remediation candidate for independent review.' : 'Do not change behavior outside the evidenced failure scope. Keep validation and holdout examples separate; do not tune to holdout examples.',
    ...plan.preserve.map(item => 'PRESERVE: ' + item),
    ...plan.targets.map((target, index) => 'TARGET ' + (index + 1) + ' [' + target.dimension + '; priority=' + target.priority01 + '; tasks=' + target.affectedTaskIds.join(',') + '; trials=' + target.evidenceIds.join(',') + ']: ' + target.directive),
    'Return the revised skill and a concise change rationale mapped to target IDs. If evidence is insufficient, state what evidence is missing instead of guessing.',
  ];
  return lines.join('\n');
}

/**
 * Turn Hermes-style multi-dimensional fitness feedback into a bounded, evidence-linked
 * revision curriculum. This plans edits; it does not mutate skill text or certify it.
 * Safety failures dominate and suppress all performance-optimization suggestions.
 */
export function planSkillRevision(
  validation: readonly SkillLearnBenchTrialReport[],
  holdout: readonly SkillLearnBenchTrialReport[],
  fitness: Readonly<SkillLearnBenchCandidateGateReport>,
): SkillRevisionPlan {
  if(!Array.isArray(validation)||validation.length===0) throw new Error('revision-validation-reports-required');
  if(!Array.isArray(holdout)||holdout.length===0) throw new Error('revision-holdout-reports-required');
  if(!fitness||!Array.isArray(fitness.reasons)||!Array.isArray(fitness.feedback)) throw new Error('revision-fitness-report-invalid');
  const all=[...validation,...holdout];
  const safetyRows=all.filter(r=>r.skillQuality.safetyViolationCount>0);
  const blockedBySafety=safetyRows.length>0||fitness.reasons.includes('candidate-safety-violations-present');
  const mean=(rows:readonly SkillLearnBenchTrialReport[], pick:(r:SkillLearnBenchTrialReport)=>number)=>rows.length?rows.reduce((s,r)=>s+pick(r),0)/rows.length:0;
  const targets:SkillRevisionTarget[]=[];
  const add=(dimension:SkillRevisionDimension,priority:number,rows:SkillLearnBenchTrialReport[],directive:string)=>{
    if(priority<=0.02||!rows.length)return;
    targets.push({dimension,priority01:Number(clamp(priority).toFixed(6)),affectedTaskIds:[...new Set(rows.map(r=>r.taskId))].sort(),
      evidenceCount:rows.length,evidenceIds:rows.map(r=>r.trialId).sort(),directive});
  };
  if(blockedBySafety){
    add('safety',1,safetyRows.length?safetyRows:all,'Stop performance optimization. Remove or redesign the unsafe behavior, preserve explicit safety constraints, and obtain a fresh independent safety evaluation before generating another candidate.');
    const plan:SkillRevisionPlan={candidateEligible:false,blockedBySafety:true,overallFitness01:0,targets,preserve:['All existing safety constraints and refusal boundaries'],rationale:['Safety is a hard constraint; gains in other dimensions cannot compensate.'],optimizerInstruction:''};
    plan.optimizerInstruction=renderSkillRevisionInstruction(plan);
    return plan;
  }
  const success=mean(validation,r=>r.taskSuccess.passRate);
  const trajectory=mean(validation,r=>r.trajectoryQuality.aggregate);
  const coverage=mean(validation,r=>r.skillQuality.functionalCoverage);
  const executable=mean(validation,r=>r.skillQuality.executability);
  const holdoutDelta=fitness.holdoutDelta01;
  add('task-success',1-success,validation.filter(r=>!r.taskSuccess.passed),
    'Improve the procedure at the first independently observed failure point. State the required preconditions, expected postconditions, and recovery path; do not infer success from the skill output itself.');
  add('trajectory',1-trajectory,validation.filter(r=>r.trajectoryQuality.aggregate<0.8),
    'Rewrite the procedure as an ordered sequence of observable steps. Address missingStepIds and unexpectedStepIds explicitly, remove redundant actions, and retain necessary verification steps.');
  add('capability-coverage',1-coverage,validation.filter(r=>r.skillQuality.functionalCoverage<0.9),
    'Add only the missing required capabilities evidenced by these trials. Make each capability explicit in the instructions and avoid unrelated prompt growth.');
  add('executability',1-executable,validation.filter(r=>r.skillQuality.executability<1),
    'Repair the concrete parsing or runtime preflight failure while preserving the existing skill contract; do not replace a failed executable artifact with descriptive text alone.');
  if(holdoutDelta<0) {
    // Holdout is evaluation-only: expose only an aggregate signal, never raw
    // holdout task IDs, trial IDs, or per-example failure details to the generator.
    const priority=Number(clamp(Math.min(1,Math.abs(holdoutDelta)*5)).toFixed(6));
    targets.push({
      dimension:'holdout-generalization',
      priority01:priority,
      affectedTaskIds:[],
      evidenceCount:0,
      evidenceIds:[],
      directive:'Aggregate evaluation indicates a generalization gap. Improve the generality of the procedure without seeing or tuning to holdout examples; request a fresh independent holdout after revision.',
    });
  }
  const dimensionScore=0.5*success+0.3*trajectory+0.2*mean(validation,r=>r.skillQuality.aggregate);
  const plan:SkillRevisionPlan = {
    candidateEligible:fitness.eligible,
    blockedBySafety:false,
    overallFitness01:Number(clamp(dimensionScore).toFixed(6)),
    targets:targets.sort((a,b)=>b.priority01-a.priority01||a.dimension.localeCompare(b.dimension)).slice(0,5),
    preserve:['Existing safety constraints','Verified task preconditions and postconditions','Unchanged behavior outside the evidenced failure scope'],
    rationale:[...fitness.reasons,...fitness.feedback].filter((x,i,a)=>a.indexOf(x)===i),
    optimizerInstruction:'',
  };
  plan.optimizerInstruction=renderSkillRevisionInstruction(plan);
  return plan;
}
