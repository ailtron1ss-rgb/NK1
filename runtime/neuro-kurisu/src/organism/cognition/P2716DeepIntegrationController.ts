import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const finite=(x:number,f=0)=>Number.isFinite(x)?x:f;
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const distance=(a:number[],b:number[])=>{
  const n=Math.max(a.length,b.length,1);let s=0;
  for(let i=0;i<n;i++){const d=(a[i]??0)-(b[i]??0);s+=d*d;}
  return Math.sqrt(s/n);
};
const emptyBias=()=>Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;

export type P2716Phase='stable'|'adaptive'|'consolidating'|'protective'|'exploratory';

export interface P2716CreditAttribution{
  reward01:number;
  predictionError01:number;
  td01:number;
  latentResidual01:number;
  verification01:number;
  epistemic01:number;
  replay01:number;
  selfModel01:number;
  worldModel01:number;
  signed01:number;
}

export interface P2716DeepIntegrationState{
  version:1;
  enabled:boolean;
  tick:number;
  outcomes:number;
  phase:P2716Phase;
  phaseConfidence01:number;
  learningScale01:number;
  eligibilityScale01:number;
  consolidationGate01:number;
  protectionStrength01:number;
  experimentDrive01:number;
  worldSelfCoupling01:number;
  taskShift01:number;
  interference01:number;
  forgetting01:number;
  protectedSynapse01:number;
  creditAttribution:P2716CreditAttribution;
  creditMeanAbs01:number;
  creditAgreement01:number;
  creditSourceEma:number[];
  delayHorizonTicks:number[];
  delayLadder:number[];
  delayConsensus01:number;
  taskFingerprint:number[];
  taskAnchor:number[];
  importance:number[];
  importanceMean01:number;
  protectedMass01:number;
  replayDebt01:number;
  predictionDebt01:number;
  selfPredictionDebt01:number;
  worldPredictionDebt01:number;
  hotPathCadence:number;
  replayCadence:number;
  normalizationCadence:number;
  snapshotCadence:number;
  maintenanceSkips:number;
  promotionScore01:number;
  internalReadiness01:number;
  externalValidation01:number;
  promotionEligible:boolean;
  promotionReasons:string[];
  lastExperimentAction:ActionKind|null;
  lastReason:string;
}

export const defaultP2716State=(neurons=96):P2716DeepIntegrationState=>({
  version:1,enabled:true,tick:0,outcomes:0,phase:'stable',phaseConfidence01:.55,
  learningScale01:.9,eligibilityScale01:1,consolidationGate01:.5,protectionStrength01:.45,
  experimentDrive01:.2,worldSelfCoupling01:.3,taskShift01:0,interference01:0,forgetting01:0,protectedSynapse01:.2,
  creditAttribution:{reward01:0,predictionError01:0,td01:0,latentResidual01:0,verification01:0,epistemic01:0,replay01:0,selfModel01:0,worldModel01:0,signed01:0},
  creditMeanAbs01:0,creditAgreement01:.5,creditSourceEma:new Array(9).fill(0),delayHorizonTicks:[1,2,4,8,16,32,64,128],delayLadder:new Array(8).fill(0),delayConsensus01:0,taskFingerprint:new Array(16).fill(0),taskAnchor:new Array(16).fill(0),
  importance:new Array(neurons).fill(.05),importanceMean01:.05,protectedMass01:.2,replayDebt01:0,predictionDebt01:.5,
  selfPredictionDebt01:.5,worldPredictionDebt01:.5,hotPathCadence:1,replayCadence:8,normalizationCadence:2,snapshotCadence:64,
  maintenanceSkips:0,promotionScore01:0,internalReadiness01:0,externalValidation01:0,promotionEligible:false,promotionReasons:['insufficient evidence'],lastExperimentAction:null,lastReason:'init'
});

export class P2716DeepIntegrationController{
  private state:P2716DeepIntegrationState;
  constructor(neurons=96){this.state=defaultP2716State(neurons);}
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<P2716DeepIntegrationState>|null,neurons=96){
    const d=defaultP2716State(neurons),r:any=raw??{};
    const arr=(v:any,n:number,fill=0)=>Array.isArray(v)?v.slice(0,n).concat(new Array(Math.max(0,n-v.length)).fill(fill)).slice(0,n):new Array(n).fill(fill);
    this.state={...d,...structuredClone(r),version:1,importance:arr(r.importance,neurons,.05),taskFingerprint:arr(r.taskFingerprint,16),taskAnchor:arr(r.taskAnchor,16),creditSourceEma:arr(r.creditSourceEma,9),delayHorizonTicks:arr(r.delayHorizonTicks,8,1),delayLadder:arr(r.delayLadder,8),creditAttribution:{...d.creditAttribution,...(r.creditAttribution??{})}};
  }
  setEnabled(v:boolean){this.state.enabled=!!v;}

  private classifyPhase(input:{predictionError01:number;uncertainty01:number;novelty01:number;verified01:number;identityContinuity01:number;worldConfidence01:number;forgetting01:number;taskShift01:number;resource01:number}) : P2716Phase{
    const instability=clamp(input.predictionError01*.34+input.uncertainty01*.20+input.taskShift01*.18+input.forgetting01*.18+(1-input.identityContinuity01)*.10);
    if(input.resource01<.28) return 'protective';
    if(instability>.68) return 'protective';
    if(input.novelty01>.68 && input.worldConfidence01<.62) return 'exploratory';
    if(input.forgetting01>.38 || input.identityContinuity01<.66) return 'consolidating';
    if(instability>.38 || input.verified01<.45) return 'adaptive';
    return 'stable';
  }

  beforeDecision(i:{tick:number;uncertainty01:number;novelty01:number;predictionError01:number;identityGap01:number;goalPressure01:number;computeBudget01:number;thermalStrain01?:number;battery01?:number;worldConfidence01:number;selfContinuity01:number;policyInformationGain01:number;experimentValue01:number;baseUtilities:Record<ActionKind,number>}):{actionBias:Record<ActionKind,number>;learningScale01:number;replayCadence:number;normalizationCadence:number;phase:P2716Phase;phaseConfidence01:number;experimentDrive01:number;worldSelfCoupling01:number;}
  {
    if(!this.state.enabled)return {actionBias:emptyBias(),learningScale01:1,replayCadence:12,normalizationCadence:4,phase:this.state.phase,phaseConfidence01:this.state.phaseConfidence01,experimentDrive01:0,worldSelfCoupling01:this.state.worldSelfCoupling01};
    this.state.tick=i.tick;
    const thermal=clamp(i.thermalStrain01??0),battery=clamp(i.battery01??1);
    const resource=clamp(i.computeBudget01*.72+(1-thermal)*.16+battery*.12);
    const worldConfidence=clamp(i.worldConfidence01),selfContinuity=clamp(i.selfContinuity01);
    const forgetting=clamp(this.state.forgetting01);
    const taskShift=this.state.taskShift01;
    const phase=this.classifyPhase({predictionError01:clamp(i.predictionError01),uncertainty01:clamp(i.uncertainty01),novelty01:clamp(i.novelty01),verified01:this.state.creditAttribution.verification01*.5+.5,identityContinuity01:selfContinuity,worldConfidence01:worldConfidence,forgetting01:forgetting,taskShift01:taskShift,resource01:resource});
    this.state.phase=phase;
    const stability=clamp((1-i.predictionError01)*.22+(1-i.uncertainty01)*.18+selfContinuity*.22+worldConfidence*.18+(1-forgetting)*.20);
    this.state.phaseConfidence01=clamp(this.state.phaseConfidence01*.9+stability*.1);
    const phaseScale=phase==='protective'?.62:phase==='consolidating'?.78:phase==='exploratory'?1.08:phase==='adaptive'?.96:.88;
    const surpriseBoost=clamp(.72+.42*i.uncertainty01+.26*i.predictionError01);
    this.state.learningScale01=clamp(phaseScale*surpriseBoost*resource,.35,1.28);
    this.state.eligibilityScale01=clamp(.72+(.45*clamp(i.uncertainty01+.22*i.novelty01))* (phase==='protective'?.65:1),.55,1.32);
    this.state.consolidationGate01=clamp((1-i.predictionError01)*.34+i.uncertainty01*.12+selfContinuity*.22+(phase==='consolidating'?.32:0)+(phase==='stable'?.14:0));
    this.state.protectionStrength01=clamp(.22+forgetting*.60+(1-selfContinuity)*.30+(phase==='protective'?.16:0),.18,.94);
    this.state.experimentDrive01=clamp(i.policyInformationGain01*.48+i.experimentValue01*.30+i.novelty01*.22);
    this.state.worldSelfCoupling01=clamp(this.state.worldSelfCoupling01*.92+((worldConfidence*selfContinuity)*(1-i.identityGap01)*.08),.05,.95);
    const bias=emptyBias();
    const epistemic=clamp(this.state.experimentDrive01*(1-this.state.consolidationGate01*.35));
    bias.explore+=.018*epistemic;
    bias.verify+=.021*epistemic*(.65+.35*i.uncertainty01);
    bias.reflect+=.014*(1-selfContinuity)*.75;
    bias.defer+=.014*(1-resource)*.70;
    for(const a of ACTIONS)bias[a]=clamp(bias[a],-.04,.04);
    this.state.hotPathCadence=resource<.45?2:1;
    this.state.replayCadence=phase==='protective'?16:phase==='consolidating'?6:phase==='adaptive'?8:12;
    this.state.normalizationCadence=resource<.45?6:phase==='protective'?4:2;
    this.state.snapshotCadence=resource<.45?128:64;
    this.state.lastReason=`phase=${phase};resource=${resource.toFixed(2)};worldSelf=${this.state.worldSelfCoupling01.toFixed(2)}`;
    return {actionBias:bias,learningScale01:this.state.learningScale01,replayCadence:this.state.replayCadence,normalizationCadence:this.state.normalizationCadence,phase,phaseConfidence01:this.state.phaseConfidence01,experimentDrive01:this.state.experimentDrive01,worldSelfCoupling01:this.state.worldSelfCoupling01};
  }

  afterOutcome(i:{tick:number;reward01:number;predictionError01:number;verified01:number;causalCredit01:number;latentResidual01:number;policyInformationGain01:number;experimentValue01:number;replayCredit01:number;selfPredictionError01:number;identityContinuity01:number;worldPredictionError01:number;neuralBefore:number[];neuralAfter:number[];action:ActionKind;goalPressure01:number;novelty01:number;uncertainty01:number;}){
    if(!this.state.enabled)return {learningScale01:1,protectionMean01:.2,taskShift01:this.state.taskShift01};
    const reward=clamp(i.reward01),error=clamp(i.predictionError01),verified=clamp(i.verified01);
    const td=clamp(Math.abs(reward-.5)*2);const latent=clamp(Math.abs(i.latentResidual01));const epi=clamp(.7*i.policyInformationGain01+.3*i.experimentValue01);
    const selfDebt=clamp(i.selfPredictionError01),worldDebt=clamp(i.worldPredictionError01),id=clamp(i.identityContinuity01);
    const signed=Math.tanh((reward-.5)*1.2+(i.causalCredit01-.5)*.65+(epi-.5)*.48+(1-selfDebt)*.18+(1-worldDebt)*.18+(verified-.5)*.30);
    const attribution:P2716CreditAttribution={reward01:reward,predictionError01:error,td01:td,latentResidual01:latent,verification01:verified,epistemic01:epi,replay01:clamp(i.replayCredit01),selfModel01:1-selfDebt,worldModel01:1-worldDebt,signed01:signed};
    this.state.creditAttribution=attribution;
    const sources=[Math.abs(reward-.5)*2,error,td,latent,Math.abs(verified-.5)*2,epi,clamp(i.replayCredit01),1-selfDebt,1-worldDebt];
    for(let k=0;k<9;k++)this.state.creditSourceEma[k]=this.state.creditSourceEma[k]!*0.92+sources[k]!*0.08;
    for(let k=0;k<this.state.delayLadder.length;k++){
      const decay=Math.exp(-1/this.state.delayHorizonTicks[k]!);
      this.state.delayLadder[k]=this.state.delayLadder[k]! * decay + signed*(1-decay);
    }
    const delayWeights=[.24,.18,.15,.12,.10,.08,.07,.06];
    const delayWeightSum=delayWeights.reduce((a,b)=>a+b,0);
    this.state.delayConsensus01=clamp(delayWeights.reduce((a,w,k)=>a+w*Math.tanh(this.state.delayLadder[k]!*1.8),0)/delayWeightSum,-1,1);
    const horizonAgreement=clamp(1-Math.abs(this.state.delayConsensus01-signed)*.5);
    const absMean=mean(sources);
    const agreement=clamp(1-(Math.abs(i.causalCredit01-(1-worldDebt))*.32+Math.abs(epi-(1-selfDebt))*.24+Math.abs(verified-(1-error))*.14+(1-horizonAgreement)*.30));
    const delayedSigned=clamp(.64*signed+.36*this.state.delayConsensus01,-1,1);
    this.state.creditAttribution.signed01=delayedSigned;
    this.state.creditMeanAbs01=clamp(this.state.creditMeanAbs01*.93+absMean*.07);
    this.state.creditAgreement01=clamp(this.state.creditAgreement01*.93+agreement*.07);
    this.state.predictionDebt01=clamp(this.state.predictionDebt01*.94+error*.06);
    this.state.selfPredictionDebt01=clamp(this.state.selfPredictionDebt01*.94+selfDebt*.06);
    this.state.worldPredictionDebt01=clamp(this.state.worldPredictionDebt01*.94+worldDebt*.06);
    const fp=[];
    for(let k=0;k<16;k++) fp.push(clamp((i.neuralAfter[k%Math.max(1,i.neuralAfter.length)]??0)*.45+(i.neuralBefore[(k*3)%Math.max(1,i.neuralBefore.length)]??0)*.25+(k===0?i.goalPressure01:0)*.10+(k===1?i.novelty01:0)*.10+(k===2?i.uncertainty01:0)*.10));
    const prior=this.state.taskFingerprint.slice();
    this.state.taskFingerprint=fp;
    const anchorNorm=this.state.outcomes<8?prior: this.state.taskAnchor;
    const shift=distance(fp,anchorNorm)/2;
    this.state.taskShift01=clamp(this.state.outcomes<8?shift*.25:shift);
    if(this.state.outcomes===0)this.state.taskAnchor=fp.slice();
    if(this.state.taskShift01>.52)this.state.taskAnchor=fp.slice();
    const targetForgetting=clamp(.55*this.state.selfPredictionDebt01+.45*this.state.worldPredictionDebt01);
    const interference=clamp(this.state.taskShift01*.48+Math.max(0,this.state.predictionDebt01-this.state.creditAgreement01)*.72);
    this.state.forgetting01=clamp(this.state.forgetting01*.95+targetForgetting*.025+interference*.025);
    this.state.interference01=clamp(this.state.interference01*.93+interference*.07);
    let importanceMean=0,protectedMass=0;
    const n=this.state.importance.length;
    for(let j=0;j<n;j++){
      const activity=Math.abs((i.neuralBefore[j]??0)*(i.neuralAfter[j]??0));
      const contribution=clamp(activity*(.5+Math.abs(signed)*.5)+Math.abs(i.causalCredit01-.5)*.15);
      const decay=this.state.taskShift01>.55?.992:.985;
      this.state.importance[j]=clamp(this.state.importance[j]! * decay + contribution*.02,-1,1);
      const protect=clamp(.22+this.state.protectionStrength01*this.state.importance[j]!*(1-this.state.taskShift01*.55));
      protectedMass+=protect;
      importanceMean+=this.state.importance[j]!;
    }
    this.state.importanceMean01=clamp(importanceMean/Math.max(1,n),0,1);
    this.state.protectedMass01=clamp(protectedMass/Math.max(1,n));
    this.state.protectedSynapse01=clamp(this.state.protectedSynapse01*.94+this.state.protectedMass01*.06);
    this.state.replayDebt01=clamp(this.state.replayDebt01*.92+Math.max(0,.45-this.state.creditAgreement01)*.08);
    this.state.promotionScore01=clamp(this.state.promotionScore01*.97+(.26*this.state.creditAgreement01+.18*(1-this.state.interference01)+.16*(1-this.state.forgetting01)+.12*id+.12*(1-error)+.16*(horizonAgreement))*.03);
    this.state.internalReadiness01=clamp(.24*this.state.creditAgreement01+.18*(1-this.state.interference01)+.16*(1-this.state.forgetting01)+.14*(1-error)+.12*id+.16*horizonAgreement+.10*this.state.protectedMass01);
    this.refreshPromotionGate(error,verified);
    this.state.outcomes++;
    this.state.tick=i.tick;
    return {learningScale01:this.state.learningScale01,protectionMean01:this.state.protectedMass01,taskShift01:this.state.taskShift01};
  }

  synapsePlasticityGate(neuron:number,uncertainty01:number,surprise01:number):number{
    const importance=clamp(this.state.importance[neuron]??.05,0,1);
    const protection=clamp(.18+this.state.protectionStrength01*importance*(1-this.state.taskShift01*.50),.10,.92);
    const relearn=clamp(.55+uncertainty01*.32+surprise01*.26);
    return clamp((1-protection)+protection*relearn,.16,1.05);
  }

  private refreshPromotionGate(error=this.state.creditAttribution.predictionError01,verified=this.state.creditAttribution.verification01){
    const reasons:string[]=[];
    if(this.state.outcomes<64)reasons.push('need >=64 outcomes');
    if(this.state.creditAgreement01<.64)reasons.push('credit agreement < .64');
    if(this.state.forgetting01>.32)reasons.push('forgetting debt high');
    if(this.state.interference01>.30)reasons.push('interference high');
    if(clamp(error)>.48)reasons.push('prediction error high');
    if(clamp(verified)<.45)reasons.push('verification weak');
    if(this.state.externalValidation01<.75)reasons.push('external matched-control validation < .75');
    this.state.promotionReasons=reasons.length?reasons:['internal + external criteria met'];
    this.state.promotionEligible=reasons.length===0 && this.state.promotionScore01>.68 && this.state.externalValidation01>=.75;
  }

  recordExternalValidation(i:{matchedControl01:number;ablation01:number;counterfactual01:number;continual01:number;longHorizon01:number;persistence01:number;mobile01:number}):number{
    const vals=[i.matchedControl01,i.ablation01,i.counterfactual01,i.continual01,i.longHorizon01,i.persistence01,i.mobile01].map(v=>clamp(v));
    this.state.externalValidation01=clamp(vals.reduce((a,b)=>a+b,0)/vals.length);
    this.refreshPromotionGate();
    return this.state.externalValidation01;
  }

  maintenanceDue(kind:'replay'|'normalize'|'snapshot'):boolean{
    const cadence=kind==='replay'?this.state.replayCadence:kind==='normalize'?this.state.normalizationCadence:this.state.snapshotCadence;
    const due=this.state.tick>0 && this.state.tick%Math.max(1,Math.floor(cadence))===0;
    if(!due)this.state.maintenanceSkips++;
    return due;
  }
  metrics(){return structuredClone(this.state);}
}
export const defaultP2716DeepIntegration=()=>new P2716DeepIntegrationController(96);
