export interface MotiveEcologyFrame {
  version: 1;
  epistemic01: number;
  exploratory01: number;
  competence01: number;
  coherence01: number;
  social01: number;
  care01: number;
  autonomy01: number;
  homeostatic01: number;
  responsibility01: number;
  overall01: number;
  dominant: 'epistemic'|'exploratory'|'competence'|'coherence'|'social'|'care'|'autonomy'|'homeostatic'|'responsibility';
  conflict01: number;
  valueAlignment01: number;
  actionBiases: Record<string, number>;
  reasons: string[];
  nonConsciousnessClaim: true;
}

const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const harmonic = (xs: number[]) => {
  const v = xs.map(clamp).map(x => Math.max(.04, x));
  return v.length ? v.length / v.reduce((s, x) => s + 1 / x, 0) : 0;
};
type Values = {curiosity:number;truth:number;autonomy:number;evidence:number;care:number;responsibility:number;social:number};

/** Derived-only integration of existing motivational/value/social/development signals. */
export class MotiveEcologyFabric {
  evaluate(input: {
    intrinsic: {epistemic:number;novelty:number;competence:number;coherence:number;social:number;homeostatic:number;overall:number};
    values: Values;
    goalPressure01:number;
    uncertainty01:number;
    predictionError01:number;
    energy01:number;
    socialNeed01:number;
    socialTrust01:number;
    socialPredictionError01:number;
    developmental:{phase:string;revisionReadiness01:number;identityPressure01:number;counterEvidencePressure01:number;integrity01:number};
    selfConsistency01:number;
    cognitiveConflict01:number;
    noveltyPressure01:number;
    agency01:number;
  }): MotiveEcologyFrame {
    const v = input.values;
    const repair = input.developmental.phase === 'repairing';
    const epistemic = clamp(input.intrinsic.epistemic*.62 + input.uncertainty01*.18 + input.predictionError01*.12 + v.evidence*.08);
    const exploratory = clamp(input.intrinsic.novelty*.52 + input.noveltyPressure01*.22 + input.uncertainty01*.12 + v.curiosity*.14);
    const competence = clamp(input.intrinsic.competence*.56 + (1-input.socialPredictionError01)*.08 + input.predictionError01*.12 + v.responsibility*.08 + v.autonomy*.16);
    const coherence = clamp(input.intrinsic.coherence*.48 + input.selfConsistency01*.22 + (1-input.cognitiveConflict01)*.12 + input.developmental.integrity01*.18);
    const social = clamp(input.intrinsic.social*.46 + input.socialNeed01*.26 + input.socialTrust01*.12 + v.social*.10 + (1-input.socialPredictionError01)*.06);
    const care = clamp(input.socialNeed01*.28 + input.socialTrust01*.18 + v.care*.32 + v.social*.12 + (repair ? .1 : 0));
    const autonomy = clamp(input.intrinsic.homeostatic*.10 + input.agency01*.34 + v.autonomy*.32 + input.goalPressure01*.12 + input.developmental.identityPressure01*.12);
    const homeostatic = clamp(input.intrinsic.homeostatic*.54 + (1-input.energy01)*.28 + input.goalPressure01*.10 + (repair ? .08 : 0));
    const responsibility = clamp(input.goalPressure01*.20 + input.developmental.revisionReadiness01*.16 + input.predictionError01*.14 + v.responsibility*.34 + v.truth*.08 + v.evidence*.08);
    const entries = {epistemic, exploratory, competence, coherence, social, care, autonomy, homeostatic, responsibility};
    const ranked = (Object.entries(entries) as Array<[MotiveEcologyFrame['dominant'], number]>).sort((a,b) => b[1]-a[1]);
    const dominant = ranked[0]?.[0] ?? 'coherence';
    const top = ranked[0]?.[1] ?? 0;
    const second = ranked[1]?.[1] ?? 0;
    const conflict = clamp(Math.abs(top-second)*.22 + input.cognitiveConflict01*.48 + input.socialPredictionError01*.16 + input.developmental.counterEvidencePressure01*.14);
    const valueAlignment = harmonic([v.truth, v.evidence, v.responsibility, input.selfConsistency01, input.developmental.integrity01]);
    const actionBiases: Record<string, number> = {
      explore: clamp((exploratory-.5)*.08 + (input.developmental.phase==='exploring'?.018:0) + (input.uncertainty01>.62?.016:0)),
      verify: clamp((epistemic-.5)*.08 + (input.developmental.phase==='revising'?.024:0) + (input.predictionError01>.55?.018:0)),
      reflect: clamp((coherence-.5)*.07 + (repair?.022:0) + (conflict>.45?.018:0)),
      respond: clamp((social-.5)*.06 + (care-.5)*.04),
      rest: clamp((homeostatic-.5)*.07),
      'send-message': clamp((social-.5)*.035 + (care-.5)*.02),
    };
    const reasons: string[] = [];
    if(epistemic>.62) reasons.push('epistemic-pressure');
    if(exploratory>.62) reasons.push('novelty-pressure');
    if(coherence<.52 || conflict>.5) reasons.push('coherence-repair');
    if(social>.62) reasons.push('social-need');
    if(homeostatic>.62) reasons.push('homeostatic-pressure');
    if(responsibility>.62) reasons.push('commitment-pressure');
    if(input.developmental.revisionReadiness01>.62) reasons.push('developmental-revision');
    return {version:1,epistemic01:epistemic,exploratory01:exploratory,competence01:competence,coherence01:coherence,social01:social,care01:care,autonomy01:autonomy,homeostatic01:homeostatic,responsibility01:responsibility,overall01:clamp(Math.max(...Object.values(entries))),dominant,conflict01:conflict,valueAlignment01:valueAlignment,actionBiases,reasons:[...new Set(reasons)].slice(0,10),nonConsciousnessClaim:true};
  }
}
