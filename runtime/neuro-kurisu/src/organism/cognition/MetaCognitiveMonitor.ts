export type MetacognitiveOutcomeSource = 'verified-observed' | 'simulated' | 'unverified' | 'unknown';

export interface MetaCognitiveState {
  version:1;
  confidenceOfConfidence:number;
  uncertaintyAboutDecision:number;
  predictionCalibration:number;
  metacognitiveAccuracy:number;
  knownUnknowns:number;
  revisionReadiness:number;
  samples:number;
  /** Numeric outcomes received with a known non-unknown provenance. */
  outcomeSamples:number;
  /** Outcomes independently verified by the trusted external feedback path. */
  calibrationSamples:number;
  /** Simulated outcomes retained for diagnostics, never used as external calibration. */
  simulatedOutcomeSamples:number;
  /** Numeric outcomes that lack sufficient verification/independence. */
  unverifiedOutcomeSamples:number;
  updatedAt:number;
}
export function defaultMetaCognitiveState():MetaCognitiveState {
  return {
    version:1,confidenceOfConfidence:0.5,uncertaintyAboutDecision:0.5,
    predictionCalibration:0.5,metacognitiveAccuracy:0.5,knownUnknowns:0.5,
    revisionReadiness:0.5,samples:0,outcomeSamples:0,calibrationSamples:0,
    simulatedOutcomeSamples:0,unverifiedOutcomeSamples:0,updatedAt:Date.now(),
  };
}
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const count=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.floor(n as number)):0;

export class MetaCognitiveMonitor {
  private state=defaultMetaCognitiveState();

  restore(v:Partial<MetaCognitiveState>|undefined) {
    const restored={...defaultMetaCognitiveState(),...(v||{})};
    restored.outcomeSamples=count(restored.outcomeSamples);
    restored.calibrationSamples=count(restored.calibrationSamples);
    restored.simulatedOutcomeSamples=count(restored.simulatedOutcomeSamples);
    restored.unverifiedOutcomeSamples=count(restored.unverifiedOutcomeSamples);
    this.state=restored;
  }

  snapshot(){return structuredClone(this.state);}

  update(input:{
    confidence:number;
    outcomeSuccess?:number|null;
    outcomeSource?:MetacognitiveOutcomeSource;
    predictionError:number;
    worldUncertainty:number;
    identityDrift:number;
  }) {
    const c=clamp(input.confidence);
    const pe=clamp(input.predictionError);
    const wu=clamp(input.worldUncertainty);
    const drift=clamp(input.identityDrift);
    const source:MetacognitiveOutcomeSource=
      input.outcomeSource==='verified-observed' ||
      input.outcomeSource==='simulated' ||
      input.outcomeSource==='unverified'
        ? input.outcomeSource
        : 'unknown';
    const hasNumericOutcome=typeof input.outcomeSuccess==='number'&&Number.isFinite(input.outcomeSuccess);

    // Unknown is not neutral success. Only an independently verified external
    // result may enter the calibration denominator or change calibration metrics.
    if(hasNumericOutcome&&source!=='unknown') {
      this.state.outcomeSamples+=1;
      if(source==='verified-observed') {
        const observed=clamp(input.outcomeSuccess as number);
        const calibration=1-Math.abs(c-observed);
        this.state.predictionCalibration=clamp(this.state.predictionCalibration*0.82+calibration*0.18);
        this.state.metacognitiveAccuracy=clamp(this.state.metacognitiveAccuracy*0.84+calibration*0.16);
        this.state.calibrationSamples+=1;
      } else if(source==='simulated') {
        this.state.simulatedOutcomeSamples+=1;
      } else {
        this.state.unverifiedOutcomeSamples+=1;
      }
    }

    this.state.uncertaintyAboutDecision=clamp(this.state.uncertaintyAboutDecision*0.78+(1-c)*0.12+wu*0.10+pe*0.10);
    this.state.knownUnknowns=clamp(wu*0.55+pe*0.35+(1-c)*0.10);
    this.state.confidenceOfConfidence=clamp(this.state.predictionCalibration*0.7+(1-this.state.uncertaintyAboutDecision)*0.3);
    this.state.revisionReadiness=clamp(pe*0.46+drift*0.34+wu*0.20);
    this.state.samples+=1;
    this.state.updatedAt=Date.now();
  }
}
