export interface MetaCognitiveState {
  version:1;
  confidenceOfConfidence:number;
  uncertaintyAboutDecision:number;
  predictionCalibration:number;
  metacognitiveAccuracy:number;
  knownUnknowns:number;
  revisionReadiness:number;
  samples:number;
  updatedAt:number;
}
export function defaultMetaCognitiveState():MetaCognitiveState{return{version:1,confidenceOfConfidence:0.5,uncertaintyAboutDecision:0.5,predictionCalibration:0.5,metacognitiveAccuracy:0.5,knownUnknowns:0.5,revisionReadiness:0.5,samples:0,updatedAt:Date.now()};}
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
export class MetaCognitiveMonitor{
  private state=defaultMetaCognitiveState();
  restore(v:MetaCognitiveState|undefined){const d=defaultMetaCognitiveState();const src:Record<string,unknown>=(v&&typeof v==='object')?v as unknown as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};this.state={version:1,confidenceOfConfidence:clamp(finN(read('confidenceOfConfidence'),d.confidenceOfConfidence)),uncertaintyAboutDecision:clamp(finN(read('uncertaintyAboutDecision'),d.uncertaintyAboutDecision)),predictionCalibration:clamp(finN(read('predictionCalibration'),d.predictionCalibration)),metacognitiveAccuracy:clamp(finN(read('metacognitiveAccuracy'),d.metacognitiveAccuracy)),knownUnknowns:clamp(finN(read('knownUnknowns'),d.knownUnknowns)),revisionReadiness:clamp(finN(read('revisionReadiness'),d.revisionReadiness)),samples:cnt(read('samples'),d.samples),updatedAt:Math.max(0,finN(read('updatedAt'),0))};}
  snapshot(){return structuredClone(this.state);}
  update(input:{confidence:number; outcomeSuccess:number; predictionError:number; worldUncertainty:number; identityDrift:number}){
    const c=clamp(input.confidence), success=clamp(input.outcomeSuccess), pe=clamp(input.predictionError), wu=clamp(input.worldUncertainty), drift=clamp(input.identityDrift);
    const calibration=1-Math.abs(c-success);
    this.state.predictionCalibration=clamp(this.state.predictionCalibration*0.82+calibration*0.18);
    this.state.metacognitiveAccuracy=clamp(this.state.metacognitiveAccuracy*0.84+calibration*0.16);
    this.state.uncertaintyAboutDecision=clamp(this.state.uncertaintyAboutDecision*0.78+(1-c)*0.12+wu*0.10+pe*0.10);
    this.state.knownUnknowns=clamp(wu*0.55+pe*0.35+(1-c)*0.10);
    this.state.confidenceOfConfidence=clamp(this.state.predictionCalibration*0.7+(1-this.state.uncertaintyAboutDecision)*0.3);
    this.state.revisionReadiness=clamp(pe*0.46+drift*0.34+wu*0.20);
    this.state.samples+=1; this.state.updatedAt=Date.now();
  }
}
