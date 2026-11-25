export interface P81Candidate { action:string; score:number; predictedUtility:number; confidence:number; }
export interface P81WorldStateSignal {
  revision:number;
  evidenceClass:'observed'|'mixed'|'inferred'|'unknown';
  evidenceConfidence01:number;
  uncertainty01:number;
  changeMagnitude01:number;
  conflict01:number;
  unresolved01:number;
  modelDisagreement01:number;
  predictionError01:number;
}
export interface P81Input {
  tick:number; candidates:P81Candidate[]; uncertainty01:number; predictionError01:number;
  goalPressure01:number; noveltyPressure01:number; attentionBudget01:number; externalInput:boolean;
  worldState?:P81WorldStateSignal;
}
export interface P81State {
  version:1; cycles:number; selectedAction:string; attentionFocus:string; expectedInformationGain01:number;
  exploitation01:number; exploration01:number; uncertainty01:number; recentFocus:string[];
  worldRevision:number; worldEvidenceClass:'observed'|'mixed'|'inferred'|'unknown';
  worldConflict01:number; worldDisagreement01:number; worldUnresolved01:number; worldChange01:number;
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const isValidWorldSignal=(value:unknown):value is P81WorldStateSignal=>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const world=value as Partial<P81WorldStateSignal>;
 if(!Number.isSafeInteger(world.revision)||Number(world.revision)<0)return false;
 if(world.evidenceClass!=='observed'&&world.evidenceClass!=='mixed'&&world.evidenceClass!=='inferred'&&world.evidenceClass!=='unknown')return false;
 return ['evidenceConfidence01','uncertainty01','changeMagnitude01','conflict01','unresolved01','modelDisagreement01','predictionError01']
  .every(key=>typeof (world as any)[key]==='number'&&Number.isFinite((world as any)[key])&&(world as any)[key]>=0&&(world as any)[key]<=1);
};
export const defaultP81=():P81State=>({
  version:1,cycles:0,selectedAction:'wait',attentionFocus:'none',expectedInformationGain01:0.2,
  exploitation01:.5,exploration01:.5,uncertainty01:.35,recentFocus:[],
  worldRevision:0,worldEvidenceClass:'unknown',worldConflict01:0,worldDisagreement01:0,
  worldUnresolved01:0,worldChange01:0,
});
export class P81PredictiveAttention {
 private state=defaultP81();
 restore(raw:Partial<P81State>|undefined){
  if(!raw)return;
  const d=defaultP81();
  const evidenceClass=raw.worldEvidenceClass==='observed'||raw.worldEvidenceClass==='mixed'||raw.worldEvidenceClass==='inferred'||raw.worldEvidenceClass==='unknown'
    ? raw.worldEvidenceClass : d.worldEvidenceClass;
  this.state={
   ...d,...raw,
   recentFocus:Array.isArray(raw.recentFocus)?raw.recentFocus.filter((x):x is string=>typeof x==='string').slice(-24):[],
   worldRevision:Number.isSafeInteger(raw.worldRevision)&&Number(raw.worldRevision)>=0?Number(raw.worldRevision):d.worldRevision,
   worldEvidenceClass:evidenceClass,
   worldConflict01:clamp(Number(raw.worldConflict01??0)),
   worldDisagreement01:clamp(Number(raw.worldDisagreement01??0)),
   worldUnresolved01:clamp(Number(raw.worldUnresolved01??0)),
   worldChange01:clamp(Number(raw.worldChange01??0)),
  };
 }
 snapshot(){return JSON.parse(JSON.stringify(this.state)) as P81State;}
 evaluate(i:P81Input){
  const candidates=i.candidates;
  const uncertainty=clamp(i.uncertainty01); const novelty=clamp(i.noveltyPressure01); const attention=clamp(i.attentionBudget01);
  // Never let a delayed or malformed observation roll the attention system back to an older world.
  const incomingWorld=isValidWorldSignal(i.worldState)?i.worldState:undefined;
  const world=incomingWorld&&incomingWorld.revision>=this.state.worldRevision
   ? incomingWorld
   : {
      revision:this.state.worldRevision,evidenceClass:this.state.worldEvidenceClass,
      evidenceConfidence01:0,uncertainty01:this.state.uncertainty01,
      changeMagnitude01:this.state.worldChange01,conflict01:this.state.worldConflict01,
      unresolved01:this.state.worldUnresolved01,modelDisagreement01:this.state.worldDisagreement01,
      predictionError01:0,
     };
  const worldConflict=clamp(world?.conflict01??0);
  const worldDisagreement=clamp(world?.modelDisagreement01??0);
  const worldUnresolved=clamp(world?.unresolved01??0);
  const worldChange=clamp(world?.changeMagnitude01??0);
  const worldPressure=clamp(worldChange*.30+worldConflict*.35+worldUnresolved*.15+worldDisagreement*.20);
  const expectedInfo=clamp(uncertainty*.45+i.predictionError01*.25+novelty*.2+(1-attention)*.1+Math.min(.12,worldPressure*.12));
  const exploration=clamp(expectedInfo*.72+novelty*.18+Math.min(.03,worldChange*.03)); const exploitation=clamp(1-exploration);
  const ranked=[...candidates].sort((a,b)=>{
    const ai=a.score*.62+a.predictedUtility*.18+a.confidence*.08+(a.action==='explore'?exploration*.08:0)+(a.action==='verify'?expectedInfo*.08:0);
    const bi=b.score*.62+b.predictedUtility*.18+b.confidence*.08+(b.action==='explore'?exploration*.08:0)+(b.action==='verify'?expectedInfo*.08:0);
    return bi-ai;
  });
  const selected=ranked[0]?.action??'wait';
  const focus = worldConflict>.35?'world-conflict'
    : worldDisagreement>.45?'model-disagreement'
      : worldUnresolved>.45?'world-unresolved'
        : worldChange>.55?'world-change'
          : uncertainty>.65?'uncertainty':i.goalPressure01>.62?'goal':i.predictionError01>.55?'prediction':novelty>.65?'novelty':'current';
  this.state.cycles++; this.state.selectedAction=selected; this.state.attentionFocus=focus;
  this.state.expectedInformationGain01=expectedInfo; this.state.exploitation01=exploitation; this.state.exploration01=exploration;
  this.state.uncertainty01=clamp(Math.max(uncertainty,clamp(world?.uncertainty01??0)));
  this.state.recentFocus=[...this.state.recentFocus,focus].slice(-24);
  if(world){
   this.state.worldRevision=world.revision;
   this.state.worldEvidenceClass=world.evidenceClass;
   this.state.worldConflict01=worldConflict; this.state.worldDisagreement01=worldDisagreement;
   this.state.worldUnresolved01=worldUnresolved; this.state.worldChange01=worldChange;
  }
  return {selectedAction:selected,attentionFocus:focus,expectedInformationGain01:expectedInfo,exploration01:exploration,exploitation01:exploitation};
 }
 actionBias(action:string):number {
  const explorationBoost=(this.state.exploration01-(this.state.exploitation01))*0.055;
  if(action==='explore') return explorationBoost;
  if(action==='verify') {
    const worldVerifyBoost=Math.min(.04,this.state.worldConflict01*.024+this.state.worldDisagreement01*.016+this.state.worldUnresolved01*.008);
    return this.state.expectedInformationGain01*.045+worldVerifyBoost;
  }
  if(action==='reflect') {
    const worldFocus=this.state.attentionFocus==='world-conflict'||this.state.attentionFocus==='model-disagreement';
    return (this.state.attentionFocus==='uncertainty'||worldFocus) ? .025 : 0;
  }
  return 0;
 }
}
