import type { ActionKind } from '../core/types.ts';

export type EvidenceLevel = 'unverified'|'observed'|'repeated'|'controlled'|'longitudinal'|'device-verified';
export type CampaignStage = 'design'|'running'|'analysis'|'completed'|'paused';

export interface RuntimeOutcomeAggregate {
  action: ActionKind;
  samples: number;
  successMean01: number;
  lastAt: number;
}

export interface ControlledExperimentRecord {
  id: string;
  name: string;
  controlLabel: string;
  treatmentLabel: string;
  metric: string;
  controlValue: number;
  treatmentValue: number;
  delta: number;
  standardizedEffect: number;
  sampleSize: number;
  independentConditions: boolean;
  interpretation: string;
  at: number;
}

export interface ExternalEvaluationRecord {
  id: string;
  taskId: string;
  suite: string;
  phase: 'holdout'|'device'|'longitudinal'|'regression';
  score01: number;
  criteriaPassed: number;
  criteriaTotal: number;
  evaluator: string;
  evidenceLevel: EvidenceLevel;
  at: number;
}

export interface AblationStudyRecord {
  id: string;
  module: string;
  baselineScore01: number;
  ablatedScore01: number;
  delta01: number;
  changed: boolean;
  sampleSize: number;
  interpretation: string;
  at: number;
}

export interface CapabilityClaim {
  name: string;
  evidenceLevel: EvidenceLevel;
  evidenceCount: number;
  lastEvidenceAt: number;
  blockedReason: string;
}

export interface ResearchCampaign {
  id: string;
  objective: string;
  stage: CampaignStage;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  linkedEvidenceIds: string[];
}

export interface P25ScientificDevelopmentState {
  version: 1;
  runtimeOutcomes: RuntimeOutcomeAggregate[];
  controlledExperiments: ControlledExperimentRecord[];
  evaluations: ExternalEvaluationRecord[];
  ablations: AblationStudyRecord[];
  claims: CapabilityClaim[];
  campaigns: ResearchCampaign[];
  metrics: {
    runtimeSamples: number;
    controlledExperiments: number;
    evaluations: number;
    ablations: number;
    repeatedEvaluationPassRate01: number;
    meanEvaluationScore01: number;
    lastEvidenceAt: number;
  };
}

const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const now = () => Date.now();
const safe = (x: unknown, max = 240) => String(x ?? '').trim().slice(0, max);
const id = (prefix: string) => `${prefix}-${now()}-${Math.random().toString(36).slice(2, 8)}`;

export const defaultP25ScientificDevelopment = (): P25ScientificDevelopmentState => ({
  version: 1,
  runtimeOutcomes: [],
  controlledExperiments: [],
  evaluations: [],
  ablations: [],
  claims: [],
  campaigns: [],
  metrics: {
    runtimeSamples: 0,
    controlledExperiments: 0,
    evaluations: 0,
    ablations: 0,
    repeatedEvaluationPassRate01: 0,
    meanEvaluationScore01: 0,
    lastEvidenceAt: 0,
  },
});

function evidenceRank(level: EvidenceLevel): number {
  return ({unverified:0, observed:1, repeated:2, controlled:3, longitudinal:4, 'device-verified':5})[level];
}

export class P25ScientificDevelopmentEngine {
  private state = defaultP25ScientificDevelopment();

  restore(raw?: Partial<P25ScientificDevelopmentState> | null): void {
    const d = defaultP25ScientificDevelopment();
    this.state = {
      ...d,
      ...(raw ?? {}),
      runtimeOutcomes: Array.isArray(raw?.runtimeOutcomes) ? raw!.runtimeOutcomes.slice(0, 32) : [],
      controlledExperiments: Array.isArray(raw?.controlledExperiments) ? raw!.controlledExperiments.slice(-256) : [],
      evaluations: Array.isArray(raw?.evaluations) ? raw!.evaluations.slice(-512) : [],
      ablations: Array.isArray(raw?.ablations) ? raw!.ablations.slice(-256) : [],
      claims: Array.isArray(raw?.claims) ? raw!.claims.slice(0, 256) : [],
      campaigns: Array.isArray(raw?.campaigns) ? raw!.campaigns.slice(0, 64) : [],
      metrics: { ...d.metrics, ...(raw?.metrics ?? {}) },
    };
    this.recomputeMetrics();
  }

  snapshot(): P25ScientificDevelopmentState { return structuredClone(this.state); }

  observeRuntimeOutcome(action: ActionKind, success01: number, at = now()): void {
    const actionName = action;
    const existing = this.state.runtimeOutcomes.find(x => x.action === actionName);
    if (!existing) this.state.runtimeOutcomes.unshift({ action: actionName, samples: 1, successMean01: clamp(success01), lastAt: at });
    else {
      existing.successMean01 = clamp(existing.successMean01 * 0.95 + clamp(success01) * 0.05);
      existing.samples += 1;
      existing.lastAt = at;
    }
    this.state.runtimeOutcomes = this.state.runtimeOutcomes.slice(0, 32);
    this.state.metrics.runtimeSamples += 1;
  }

  recordControlledExperiment(input: {
    name: string;
    controlLabel: string;
    treatmentLabel: string;
    metric: string;
    controlValue: number;
    treatmentValue: number;
    sampleSize: number;
    independentConditions: boolean;
    interpretation?: string;
  }): ControlledExperimentRecord {
    if (!safe(input.name) || !safe(input.metric)) throw new Error('controlled experiment requires name and metric');
    if (input.controlLabel === input.treatmentLabel) throw new Error('control and treatment labels must differ');
    if (!input.independentConditions) throw new Error('controlled experiment requires independent conditions');
    const control = clamp(input.controlValue);
    const treatment = clamp(input.treatmentValue);
    const delta = treatment - control;
    const pooled = Math.max(0.05, Math.sqrt((control * (1-control) + treatment * (1-treatment)) / 2));
    const record: ControlledExperimentRecord = {
      id: id('exp'), name: safe(input.name), controlLabel: safe(input.controlLabel, 80), treatmentLabel: safe(input.treatmentLabel, 80),
      metric: safe(input.metric, 120), controlValue: control, treatmentValue: treatment, delta,
      standardizedEffect: delta / pooled, sampleSize: Math.max(1, Math.floor(input.sampleSize)),
      independentConditions: true, interpretation: safe(input.interpretation ?? (Math.abs(delta) < 0.02 ? 'no material difference observed' : delta > 0 ? 'treatment improved measured metric' : 'treatment reduced measured metric')), at: now(),
    };
    this.state.controlledExperiments = [record, ...this.state.controlledExperiments].slice(0, 256);
    this.state.metrics.controlledExperiments += 1;
    this.state.metrics.lastEvidenceAt = record.at;
    return structuredClone(record);
  }

  recordEvaluation(input: {
    taskId: string;
    suite: string;
    phase: ExternalEvaluationRecord['phase'];
    score01: number;
    criteriaPassed: number;
    criteriaTotal: number;
    evaluator: string;
    evidenceLevel?: EvidenceLevel;
  }): ExternalEvaluationRecord {
    const total = Math.max(0, Math.floor(input.criteriaTotal));
    const passed = Math.max(0, Math.min(total, Math.floor(input.criteriaPassed)));
    const score = clamp(input.score01);
    const record: ExternalEvaluationRecord = {
      id: id('eval'), taskId: safe(input.taskId, 120), suite: safe(input.suite, 120), phase: input.phase,
      score01: score, criteriaPassed: passed, criteriaTotal: total, evaluator: safe(input.evaluator, 120),
      evidenceLevel: input.evidenceLevel ?? 'observed', at: now(),
    };
    this.state.evaluations = [record, ...this.state.evaluations].slice(0, 512);
    this.state.metrics.evaluations += 1;
    this.state.metrics.lastEvidenceAt = record.at;
    this.recomputeMetrics();
    return structuredClone(record);
  }

  recordAblation(input: {
    module: string;
    baselineScore01: number;
    ablatedScore01: number;
    sampleSize: number;
    interpretation?: string;
  }): AblationStudyRecord {
    const baseline = clamp(input.baselineScore01);
    const ablated = clamp(input.ablatedScore01);
    const delta = baseline - ablated;
    const record: AblationStudyRecord = {
      id: id('ablate'), module: safe(input.module, 120), baselineScore01: baseline, ablatedScore01: ablated,
      delta01: delta, changed: Math.abs(delta) >= 0.02, sampleSize: Math.max(1, Math.floor(input.sampleSize)),
      interpretation: safe(input.interpretation ?? (Math.abs(delta) < 0.02 ? 'ablation produced no measurable change' : delta > 0 ? 'module contribution detected' : 'ablated condition outperformed baseline')), at: now(),
    };
    this.state.ablations = [record, ...this.state.ablations].slice(0, 256);
    this.state.metrics.ablations += 1;
    this.state.metrics.lastEvidenceAt = record.at;
    return structuredClone(record);
  }

  upsertClaim(name: string, level: EvidenceLevel, reason = ''): CapabilityClaim {
    const key = safe(name, 160);
    if (!key) throw new Error('claim name is required');
    let claim = this.state.claims.find(x => x.name === key);
    if (!claim) {
      claim = { name: key, evidenceLevel: 'unverified', evidenceCount: 0, lastEvidenceAt: 0, blockedReason: 'no evidence recorded' };
      this.state.claims.unshift(claim);
    }
    if (evidenceRank(level) >= evidenceRank(claim.evidenceLevel)) claim.evidenceLevel = level;
    claim.evidenceCount += 1;
    claim.lastEvidenceAt = now();
    claim.blockedReason = safe(reason || (level === 'device-verified' ? '' : 'requires stronger or independent evidence'), 220);
    this.state.claims = this.state.claims.slice(0, 256);
    this.state.metrics.lastEvidenceAt = claim.lastEvidenceAt;
    return structuredClone(claim);
  }

  claimStatus(name: string): CapabilityClaim {
    return structuredClone(this.state.claims.find(x => x.name === safe(name, 160)) ?? { name: safe(name,160), evidenceLevel:'unverified', evidenceCount:0, lastEvidenceAt:0, blockedReason:'no evidence recorded' });
  }

  startCampaign(objective: string): ResearchCampaign {
    const at = now();
    const campaign: ResearchCampaign = { id: id('campaign'), objective: safe(objective, 300), stage:'design', createdAt:at, updatedAt:at, completedAt:null, linkedEvidenceIds:[] };
    this.state.campaigns = [campaign, ...this.state.campaigns].slice(0, 64);
    return structuredClone(campaign);
  }

  updateCampaign(idValue: string, stage: CampaignStage, evidenceIds: string[] = []): ResearchCampaign {
    const campaign = this.state.campaigns.find(x => x.id === idValue);
    if (!campaign) throw new Error('research campaign not found');
    campaign.stage = stage;
    campaign.updatedAt = now();
    campaign.linkedEvidenceIds = [...new Set([...campaign.linkedEvidenceIds, ...evidenceIds.map(String)])].slice(-96);
    if (stage === 'completed') campaign.completedAt = campaign.updatedAt;
    return structuredClone(campaign);
  }

  private recomputeMetrics(): void {
    const evals = this.state.evaluations;
    const scores = evals.map(x => x.score01);
    this.state.metrics.meanEvaluationScore01 = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : 0;
    const repeated = evals.filter(x => x.phase === 'holdout' || x.phase === 'longitudinal');
    this.state.metrics.repeatedEvaluationPassRate01 = repeated.length ? repeated.filter(x => x.criteriaTotal > 0 ? x.criteriaPassed / x.criteriaTotal >= 0.8 : x.score01 >= 0.8).length / repeated.length : 0;
  }
}
