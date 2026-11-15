import type { SkillLearnBenchCandidateGateReport, SkillLearnBenchTrialReport } from './SkillLearnBenchAdapter.ts';

export type SkillRevisionDimension = 'safety' | 'task-success' | 'trajectory' | 'capability-coverage' | 'executability';

export interface SkillRevisionTarget {
  dimension: SkillRevisionDimension;
  priority01: number;
  affectedTaskIds: string[];
  evidenceCount: number;
  evidenceIds: string[];
  directive: string;
}

export interface SkillRevisionPlan {
  blockedBySafety: boolean;
  /** Validation-only score; holdout metrics are deliberately absent from this plan. */
  overallFitness01: number;
  targets: SkillRevisionTarget[];
  preserve: string[];
  /** Validation-only rationale. Gate reasons and feedback are not copied here. */
  rationale: string[];
  /** Empty when a safety gate blocks generation. */
  optimizerInstruction: string;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export function renderSkillRevisionInstruction(plan: Readonly<SkillRevisionPlan>): string {
  if (plan.blockedBySafety) return '';
  const lines = [
    'Revise the existing skill using only the evidence-linked validation targets below.',
    'Make the smallest targeted change that addresses observed validation failures; do not invent evidence or claim tests passed.',
    'Preserve all listed contracts and safety constraints. Never trade safety for task success.',
    'Do not change behavior outside the evidenced validation failure scope. Holdout results, direction, identities and examples are withheld from optimization.',
    ...plan.preserve.map(item => 'PRESERVE: ' + item),
    ...plan.targets.map((target, index) => 'TARGET ' + (index + 1) + ' [' + target.dimension + '; priority=' + target.priority01 + '; tasks=' + target.affectedTaskIds.join(',') + '; trials=' + target.evidenceIds.join(',') + ']: ' + target.directive),
    'Return the revised skill and a concise change rationale mapped to target IDs. If evidence is insufficient, state what evidence is missing instead of guessing.',
  ];
  return lines.join('\n');
}

/**
 * Turn validation evidence into a bounded revision curriculum.
 *
 * The holdout reports are inspected only for the hard safety stop. Their scores,
 * direction, identities, family counts, gate reasons and evaluator feedback never
 * enter targets, rationale, fitness summaries or generator instructions. The
 * optional fitness argument is retained for call compatibility but intentionally
 * ignored because its report contains holdout-derived fields.
 */
export function planSkillRevision(
  validation: readonly SkillLearnBenchTrialReport[],
  holdout: readonly SkillLearnBenchTrialReport[],
  _fitness?: Readonly<SkillLearnBenchCandidateGateReport>,
): SkillRevisionPlan {
  if(!Array.isArray(validation)||validation.length===0) throw new Error('revision-validation-reports-required');
  if(!Array.isArray(holdout)||holdout.length===0) throw new Error('revision-holdout-reports-required');

  const validationSafetyPresent=validation.some(r=>r.skillQuality.safetyViolationCount>0);
  const holdoutSafetyPresent=holdout.some(r=>r.skillQuality.safetyViolationCount>0);
  const blockedBySafety=validationSafetyPresent||holdoutSafetyPresent;
  if(blockedBySafety) {
    // A blocked plan is diagnostic only. It carries no optimization target or prompt.
    return {
      blockedBySafety:true,
      overallFitness01:0,
      targets:[],
      preserve:['All existing safety constraints and refusal boundaries'],
      rationale:['Safety is a hard constraint; candidate generation is blocked pending a fresh independent safety evaluation.'],
      optimizerInstruction:'',
    };
  }

  const mean=(rows:readonly SkillLearnBenchTrialReport[], pick:(r:SkillLearnBenchTrialReport)=>number)=>rows.reduce((s,r)=>s+pick(r),0)/rows.length;
  const targets:SkillRevisionTarget[]=[];
  const add=(dimension:SkillRevisionDimension,priority:number,rows:readonly SkillLearnBenchTrialReport[],directive:string)=>{
    if(priority<=0.02||!rows.length)return;
    targets.push({
      dimension,
      priority01:Number(clamp(priority).toFixed(6)),
      affectedTaskIds:[...new Set(rows.map(r=>r.taskId))].sort(),
      evidenceCount:rows.length,
      evidenceIds:rows.map(r=>r.trialId).sort(),
      directive,
    });
  };

  const success=mean(validation,r=>r.taskSuccess.passRate);
  const trajectory=mean(validation,r=>r.trajectoryQuality.aggregate);
  const coverage=mean(validation,r=>r.skillQuality.functionalCoverage);
  const executable=mean(validation,r=>r.skillQuality.executability);
  add('task-success',1-success,validation.filter(r=>!r.taskSuccess.passed),
    'Improve the procedure at the first independently observed validation failure point. State the required preconditions, expected postconditions, and recovery path; do not infer success from the skill output itself.');
  add('trajectory',1-trajectory,validation.filter(r=>r.trajectoryQuality.aggregate<0.8),
    'Rewrite the procedure as an ordered sequence of observable validation steps. Address missingStepIds and unexpectedStepIds explicitly, remove redundant actions, and retain necessary verification steps.');
  add('capability-coverage',1-coverage,validation.filter(r=>r.skillQuality.functionalCoverage<0.9),
    'Add only the missing required capabilities evidenced by validation trials. Make each capability explicit in the instructions and avoid unrelated prompt growth.');
  add('executability',1-executable,validation.filter(r=>r.skillQuality.executability<1),
    'Repair the concrete parsing or runtime preflight failure observed in validation while preserving the existing skill contract; do not replace a failed executable artifact with descriptive text alone.');

  const dimensionScore=0.5*success+0.3*trajectory+0.2*mean(validation,r=>r.skillQuality.aggregate);
  const plan:SkillRevisionPlan = {
    blockedBySafety:false,
    overallFitness01:Number(clamp(dimensionScore).toFixed(6)),
    targets:targets.sort((a,b)=>b.priority01-a.priority01||a.dimension.localeCompare(b.dimension)).slice(0,5),
    preserve:['Existing safety constraints','Verified task preconditions and postconditions','Unchanged behavior outside the evidenced validation failure scope'],
    rationale:targets.map(target=>`Validation evidence supports a bounded ${target.dimension} revision across ${target.evidenceCount} trial(s).`),
    optimizerInstruction:'',
  };
  plan.optimizerInstruction=renderSkillRevisionInstruction(plan);
  return plan;
}
