const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

export interface WorldCalibrationRecord {
  predictionId: string;
  action: string;
  predicted01: number;
  actual01: number;
  error01: number;
  intervention: boolean;
  confidence01: number;
  verified01: number;
  independent01: number;
  evidence01: number;
  matchedContextKey?: string;
  at: number;
}

export interface WorldCausalCalibrationState {
  version: 1;
  predictions: number;
  resolved: number;
  interventions: number;
  observations: number;
  meanAbsError01: number;
  brier01: number;
  calibrationGap01: number;
  lastAt: number;
  records: WorldCalibrationRecord[];
  byAction: Record<string, { n: number; error01: number; verified01: number; independent01: number; evidence01: number; readiness01: number }>;
  byContext: Record<string, { n: number; error01: number; empirical01: number; readiness01: number }>;
}

export const defaultWorldCausalCalibration = (): WorldCausalCalibrationState => ({
  version: 1,
  predictions: 0,
  resolved: 0,
  interventions: 0,
  observations: 0,
  meanAbsError01: 0.5,
  brier01: 0.25,
  calibrationGap01: 0.5,
  lastAt: 0,
  records: [],
  byAction: {},
  byContext: {},
});

export class WorldCausalCalibration {
  private state = defaultWorldCausalCalibration();

  private pending = new Map<
    string,
    { action: string; pred: number; confidence: number; intervention: boolean; at: number }
  >();

  restore(raw?: Partial<WorldCausalCalibrationState> | null) {
    const defaults = defaultWorldCausalCalibration();
    const value = raw ?? {};
    this.state = {
      ...defaults,
      ...value,
      records: Array.isArray(value.records) ? value.records.slice(-256) : [],
      byAction: { ...(value.byAction ?? {}) },
      byContext: { ...(value.byContext ?? {}) },
    };
    this.pending.clear();
  }

  snapshot() {
    return structuredClone(this.state);
  }

  track(input: {
    predictionId: string;
    action: string;
    predicted01: number;
    confidence01: number;
    intervention?: boolean;
    at?: number;
  }) {
    const at = input.at ?? Date.now();
    this.pending.set(input.predictionId, {
      action: input.action,
      pred: clamp(input.predicted01),
      confidence: clamp(input.confidence01),
      intervention: Boolean(input.intervention),
      at,
    });
    this.state.predictions += 1;
    this.state.lastAt = at;
  }

  observe(input: {
    predictionId?: string;
    action: string;
    actual01: number;
    source: 'intervention' | 'observation' | 'feedback';
    confidence01?: number;
    verified01?: number;
    independent01?: number;
    evidence01?: number;
    matchedContextKey?: string;
    at?: number;
  }) {
    const at = input.at ?? Date.now();
    let prediction = input.predictionId
      ? this.pending.get(input.predictionId)
      : undefined;

    if (!prediction) {
      prediction = {
        action: input.action,
        pred: 0.5,
        confidence: 0.5,
        intervention: input.source === 'intervention',
        at,
      };
    }

    const actual = clamp(input.actual01);
    const error = Math.abs(prediction.pred - actual);
    const record: WorldCalibrationRecord = {
      predictionId:
        input.predictionId ?? `implicit:${at}:${this.state.observations + 1}`,
      action: input.action,
      predicted01: prediction.pred,
      actual01: actual,
      error01: error,
      intervention:
        prediction.intervention || input.source === 'intervention',
      confidence01: clamp(input.confidence01 ?? prediction.confidence),
      verified01: clamp(input.verified01 ?? (input.source === 'intervention' ? 0 : .25)),
      independent01: clamp(input.independent01 ?? 0),
      evidence01: clamp(input.evidence01 ?? (input.source === 'feedback' ? .2 : .45)),
      matchedContextKey: input.matchedContextKey,
      at,
    };

    this.state.records = [record, ...this.state.records].slice(0, 256);
    this.state.resolved += 1;
    if (input.source === 'observation') this.state.observations += 1;
    if (record.intervention) this.state.interventions += 1;
    this.state.meanAbsError01 = clamp(
      this.state.meanAbsError01 * 0.9 + error * 0.1,
    );
    this.state.brier01 = clamp(
      this.state.brier01 * 0.92 + (prediction.pred - actual) ** 2 * 0.08,
    );

    const confidenceBucket = Math.round(prediction.confidence * 10) / 10;
    const empiricalAccuracy = 1 - error;
    this.state.calibrationGap01 = clamp(
      this.state.calibrationGap01 * 0.94 +
        Math.abs(confidenceBucket - empiricalAccuracy) * 0.06,
    );

    const actionStats = this.state.byAction[input.action] ?? {
      n: 0,
      error01: 0,
      verified01: 0,
      independent01: 0,
      evidence01: 0,
      readiness01: 0,
    };
    actionStats.n += 1;
    actionStats.error01 = clamp(actionStats.error01 * 0.9 + error * 0.1);
    actionStats.verified01 = clamp(actionStats.verified01 * 0.9 + record.verified01 * 0.1);
    actionStats.independent01 = clamp(actionStats.independent01 * 0.9 + record.independent01 * 0.1);
    actionStats.evidence01 = clamp(actionStats.evidence01 * 0.9 + record.evidence01 * 0.1);
    const coverage01 = clamp(Math.min(1, actionStats.n / 6));
    const actionRows = this.state.records.filter((row) => row.action === input.action).slice(0, 64);
    const historyError01 = actionRows.length ? actionRows.reduce((sum, row) => sum + row.error01, 0) / actionRows.length : actionStats.error01;
    const historyVerified01 = actionRows.length ? actionRows.reduce((sum, row) => sum + row.verified01, 0) / actionRows.length : actionStats.verified01;
    const historyIndependent01 = actionRows.length ? actionRows.reduce((sum, row) => sum + row.independent01, 0) / actionRows.length : actionStats.independent01;
    const historyEvidence01 = actionRows.length ? actionRows.reduce((sum, row) => sum + row.evidence01, 0) / actionRows.length : actionStats.evidence01;
    actionStats.readiness01 = clamp(
      coverage01 * (
        .28 * (1 - historyError01) +
        .27 * historyVerified01 +
        .23 * historyIndependent01 +
        .22 * historyEvidence01
      ),
    );
    this.state.byAction[input.action] = actionStats;
    if(input.matchedContextKey){
      const key=`${input.action}|${input.matchedContextKey}`;
      const ctx=this.state.byContext[key]??{n:0,error01:0,empirical01:0.5,readiness01:0};
      ctx.n+=1;ctx.error01=clamp(ctx.error01*.9+error*.1);ctx.empirical01=clamp(ctx.empirical01*.9+(1-error)*.1);
      ctx.readiness01=clamp(clamp(ctx.n/6)*(.65*(1-ctx.error01)+.35*ctx.empirical01));
      this.state.byContext[key]=ctx;
    }
    this.state.lastAt = at;

    if (input.predictionId) this.pending.delete(input.predictionId);
    return structuredClone(record);
  }

  calibratedConfidence(action:string, rawConfidence01:number, matchedContextKey?:string){
    const raw=clamp(rawConfidence01); if(!matchedContextKey)return raw; const ctx=this.state.byContext[`${action}|${matchedContextKey}`];
    if(!ctx||ctx.n<4||ctx.readiness01<.35)return raw; const blend=clamp(.2+.55*Math.min(1,ctx.n/12)*ctx.readiness01); return clamp(raw*(1-blend)+ctx.empirical01*blend);
  }
  contextDiagnostics(){return structuredClone(this.state.byContext);}

  actionReadiness(action: string, minTrials = 6, matchedContextKey?: string) {
    const rows = this.state.records.filter((row) => row.action === action && (!matchedContextKey || row.matchedContextKey === matchedContextKey));
    if (!rows.length) return 0;
    const coverage01 = clamp(rows.length / Math.max(1, minTrials));
    const error01 = rows.reduce((sum, row) => sum + row.error01, 0) / rows.length;
    const verified01 = rows.reduce((sum, row) => sum + row.verified01, 0) / rows.length;
    const independent01 = rows.reduce((sum, row) => sum + row.independent01, 0) / rows.length;
    const evidence01 = rows.reduce((sum, row) => sum + row.evidence01, 0) / rows.length;
    return clamp(coverage01 * (
      .28 * (1 - error01) +
      .27 * verified01 +
      .23 * independent01 +
      .22 * evidence01
    ));
  }
}
