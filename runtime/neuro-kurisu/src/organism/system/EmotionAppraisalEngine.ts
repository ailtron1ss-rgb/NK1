/**
 * BIG PASS 164 — Appraisal-based emotion episodes.
 *
 * This layer sits above interoceptive homeostasis and intrinsic motivation.
 * It deliberately models emotion as a time-bound appraisal episode instead of
 * a single scalar. It does not claim phenomenal feeling; it produces causal
 * control signals that can alter attention, memory salience and action tendency.
 */
export type EmotionLabel = 'curiosity'|'calm'|'joy'|'anxiety'|'frustration'|'sadness'|'anger'|'protective';
export type EmotionActionTendency = 'explore'|'engage'|'verify'|'reflect'|'rest'|'protect'|'withdraw'|'approach';

export interface EmotionEpisode {
  id:string; tick:number; at:number; label:EmotionLabel; actionTendency:EmotionActionTendency;
  valence01:number; arousal01:number; dominance01:number;
  appraisal:{relevance01:number; goalCongruence01:number; controllability01:number; novelty01:number; selfRelevance01:number; socialMeaning01:number; uncertainty01:number};
  interoceptiveDelta:{stress01:number; energy01:number; load01:number; attentionCapture01:number};
  memorySalienceMultiplier01:number;
  confidence01:number;
  cause:string;
}

export interface FeelingEpisode { id:string; tick:number; at:number; label:EmotionLabel; intensity01:number; interoceptiveMismatch01:number; selfAccessConfidence01:number; bodilyFocus01:number; causeEmotionId:string; }

export interface InteroceptiveAffectState {
  cycles:number;
  meanMismatch01:number;
  lastMismatch01:number;
  regulationPressure01:number;
  stability01:number;
  recovery01:number;
  predictionCalibration01:number;
  lastObserved:{energy01:number;thermal01:number;capacity01:number;load01:number};
  predicted:{energy01:number;thermal01:number;capacity01:number;load01:number};
}

export interface EmotionOutcomeCalibration {
  attempts:number;
  meanSuccess01:number;
  meanSurprise01:number;
  meanBenefit01:number;
}

export interface EmotionAppraisalState {
  version:2; episodes:number; lastTick:number; lastAt:number; lastLabel:EmotionLabel;
  meanArousal01:number; meanValence01:number; meanStress01:number; meanAttentionCapture01:number;
  history:EmotionEpisode[];
  feelings:FeelingEpisode[];
  interoception:InteroceptiveAffectState;
  outcomes:Record<string,EmotionOutcomeCalibration>;
}


const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const emptyInteroception=():InteroceptiveAffectState=>({
  cycles:0, meanMismatch01:.18, lastMismatch01:.18, regulationPressure01:.18, stability01:.72, recovery01:.5, predictionCalibration01:.5,
  lastObserved:{energy01:.68,thermal01:.2,capacity01:.72,load01:.38},
  predicted:{energy01:.68,thermal01:.2,capacity01:.72,load01:.38},
});
const empty=():EmotionAppraisalState=>({version:2,episodes:0,lastTick:-1,lastAt:0,lastLabel:'calm',meanArousal01:0.22,meanValence01:0.5,meanStress01:0.2,meanAttentionCapture01:0.2,history:[],feelings:[],interoception:emptyInteroception(),outcomes:{}});


// Restore boundaries must never invoke caller-controlled accessors. Proxy traps are
// treated as malformed persisted input and fail closed.
function readOwnDataRecord(value:unknown):Record<string,any>|null{
  if(value===null||typeof value!=="object"||Array.isArray(value))return null;
  try{
    const proto=Object.getPrototypeOf(value);
    if(proto!==Object.prototype&&proto!==null)return null;
    const keys=Reflect.ownKeys(value);
    if(keys.some(k=>typeof k!=="string"))return null;
    const out:Record<string,any>=Object.create(null);
    for(const key of keys as string[]){
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!descriptor||!("value" in descriptor))return null;
      out[key]=descriptor.value;
    }
    return out;
  }catch{return null;}
}
function safeDenseArray(value:unknown,limit:number):unknown[]{
  if(!Array.isArray(value))return [];
  try{
    const lengthDescriptor=Object.getOwnPropertyDescriptor(value,"length");
    if(!lengthDescriptor||!("value" in lengthDescriptor)||!Number.isSafeInteger(lengthDescriptor.value)||lengthDescriptor.value<0)return [];
    const length=Math.min(lengthDescriptor.value,limit),out:unknown[]=[];
    for(let i=0;i<length;i++){
      const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
      if(!descriptor||!("value" in descriptor))return [];
      out.push(descriptor.value);
    }
    return out;
  }catch{return [];}
}

export class EmotionAppraisalEngine {
  private state=empty();
  restore(raw?:Partial<EmotionAppraisalState>|null){
    const defaults=empty();
    const root=readOwnDataRecord(raw);
    if(!root){this.state=defaults;return;}
    const number=(value:unknown,fallback:number,min=-Number.MAX_VALUE,max=Number.MAX_VALUE)=>typeof value==="number"&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
    const unit=(value:unknown,fallback:number)=>number(value,fallback,0,1);
    const integer=(value:unknown,fallback:number,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof value==="number"&&Number.isSafeInteger(value)?Math.max(min,Math.min(max,value)):fallback;
    const labels:EmotionLabel[]=['curiosity','calm','joy','anxiety','frustration','sadness','anger','protective'];
    const tendencies:EmotionActionTendency[]=['explore','engage','verify','reflect','rest','protect','withdraw','approach'];
    const label=(v:unknown):EmotionLabel=>typeof v==="string"&&labels.includes(v as EmotionLabel)?v as EmotionLabel:"calm";
    const str=(v:unknown,fallback="",limit=512)=>typeof v==="string"?v.slice(0,limit):fallback;
    const appraisal=(v:unknown)=>{
      const r=readOwnDataRecord(v); if(!r)return null;
      return {relevance01:unit(r.relevance01,NaN),goalCongruence01:unit(r.goalCongruence01,NaN),controllability01:unit(r.controllability01,NaN),novelty01:unit(r.novelty01,NaN),selfRelevance01:unit(r.selfRelevance01,NaN),socialMeaning01:unit(r.socialMeaning01,NaN),uncertainty01:unit(r.uncertainty01,NaN)};
    };
    const delta=(v:unknown)=>{
      const r=readOwnDataRecord(v); if(!r)return null;
      return {stress01:unit(r.stress01,NaN),energy01:unit(r.energy01,NaN),load01:unit(r.load01,NaN),attentionCapture01:unit(r.attentionCapture01,NaN)};
    };
    const history=safeDenseArray(root.history,128).map(item=>{
      const r=readOwnDataRecord(item); if(!r)return null;
      const a=appraisal(r.appraisal),d=delta(r.interoceptiveDelta);
      if(!a||!d||Object.values(a).some(Number.isNaN)||Object.values(d).some(Number.isNaN))return null;
      if(typeof r.id!=="string"||!r.id||typeof r.tick!=="number"||!Number.isSafeInteger(r.tick)||r.tick<0||typeof r.at!=="number"||!Number.isFinite(r.at))return null;
      if(typeof r.actionTendency!=="string"||!tendencies.includes(r.actionTendency as EmotionActionTendency))return null;
      return {id:r.id.slice(0,192),tick:r.tick,at:r.at,label:label(r.label),actionTendency:r.actionTendency as EmotionActionTendency,valence01:unit(r.valence01,NaN),arousal01:unit(r.arousal01,NaN),dominance01:unit(r.dominance01,NaN),appraisal:a,interoceptiveDelta:d,memorySalienceMultiplier01:unit(r.memorySalienceMultiplier01,NaN),confidence01:unit(r.confidence01,NaN),cause:str(r.cause,"restored",128)} as EmotionEpisode;
    }).filter((x):x is EmotionEpisode=>!!x&&[x.valence01,x.arousal01,x.dominance01,x.memorySalienceMultiplier01,x.confidence01].every(Number.isFinite));
    const ids=new Set(history.map(x=>x.id));
    const feelings=safeDenseArray(root.feelings,128).map(item=>{
      const r=readOwnDataRecord(item); if(!r||typeof r.id!=="string"||typeof r.causeEmotionId!=="string"||!ids.has(r.causeEmotionId))return null;
      if(typeof r.tick!=="number"||!Number.isSafeInteger(r.tick)||r.tick<0||typeof r.at!=="number"||!Number.isFinite(r.at))return null;
      return {id:r.id.slice(0,192),tick:r.tick,at:r.at,label:label(r.label),intensity01:unit(r.intensity01,NaN),interoceptiveMismatch01:unit(r.interoceptiveMismatch01,NaN),selfAccessConfidence01:unit(r.selfAccessConfidence01,NaN),bodilyFocus01:unit(r.bodilyFocus01,NaN),causeEmotionId:r.causeEmotionId.slice(0,192)} as FeelingEpisode;
    }).filter((x):x is FeelingEpisode=>!!x&&[x.intensity01,x.interoceptiveMismatch01,x.selfAccessConfidence01,x.bodilyFocus01].every(Number.isFinite));
    const ir=readOwnDataRecord(root.interoception);
    const vector=(v:unknown,fallback:{energy01:number;thermal01:number;capacity01:number;load01:number})=>{
      const r=readOwnDataRecord(v); if(!r)return fallback;
      return {energy01:unit(r.energy01,fallback.energy01),thermal01:unit(r.thermal01,fallback.thermal01),capacity01:unit(r.capacity01,fallback.capacity01),load01:unit(r.load01,fallback.load01)};
    };
    const base=defaults.interoception;
    const interoception:InteroceptiveAffectState=ir?{
      cycles:integer(ir.cycles,0,0,Number.MAX_SAFE_INTEGER),meanMismatch01:unit(ir.meanMismatch01,base.meanMismatch01),lastMismatch01:unit(ir.lastMismatch01,base.lastMismatch01),regulationPressure01:unit(ir.regulationPressure01,base.regulationPressure01),stability01:unit(ir.stability01,base.stability01),recovery01:unit(ir.recovery01,base.recovery01),predictionCalibration01:unit(ir.predictionCalibration01,base.predictionCalibration01),lastObserved:vector(ir.lastObserved,base.lastObserved),predicted:vector(ir.predicted,base.predicted)
    }:base;
    const outcomes:Record<string,EmotionOutcomeCalibration>={};
    const outcomeRecord=readOwnDataRecord(root.outcomes);
    if(outcomeRecord){
      for(const key of Object.keys(outcomeRecord).slice(0,64)){
        if(!/^[a-z][a-z0-9:_-]{0,63}$/i.test(key))continue;
        const row=readOwnDataRecord(outcomeRecord[key]); if(!row)continue;
        const attempts=integer(row.attempts,-1,0,Number.MAX_SAFE_INTEGER);
        const success=unit(row.meanSuccess01,NaN),surprise=unit(row.meanSurprise01,NaN),benefit=unit(row.meanBenefit01,NaN);
        if(attempts>=0&&[success,surprise,benefit].every(Number.isFinite))outcomes[key]={attempts,meanSuccess01:success,meanSurprise01:surprise,meanBenefit01:benefit};
      }
    }
    this.state={
      version:2,episodes:integer(root.episodes,history.length,history.length,Number.MAX_SAFE_INTEGER),
      lastTick:integer(root.lastTick,-1,-1,Number.MAX_SAFE_INTEGER),lastAt:number(root.lastAt,0),
      lastLabel:label(root.lastLabel),meanArousal01:unit(root.meanArousal01,defaults.meanArousal01),
      meanValence01:unit(root.meanValence01,defaults.meanValence01),meanStress01:unit(root.meanStress01,defaults.meanStress01),
      meanAttentionCapture01:unit(root.meanAttentionCapture01,defaults.meanAttentionCapture01),
      history,feelings,interoception,outcomes
    };
  }
  snapshot(){return structuredClone(this.state);}

  observeInteroception(input:{energy01:number;thermal01:number;capacity01:number;load01:number;homeostaticPressure01?:number}):InteroceptiveAffectState{
    const st=this.state.interoception;
    const actual={energy01:c(input.energy01),thermal01:c(input.thermal01),capacity01:c(input.capacity01),load01:c(input.load01)};
    const errors=[Math.abs(actual.energy01-st.predicted.energy01),Math.abs(actual.thermal01-st.predicted.thermal01),Math.abs(actual.capacity01-st.predicted.capacity01),Math.abs(actual.load01-st.predicted.load01)];
    const mismatch=c(errors[0]*.28+errors[1]*.18+errors[2]*.30+errors[3]*.24);
    const pressure=c(mismatch*.46+c(input.homeostaticPressure01??0)*.54);
    const stable=c(1-mismatch);
    const recovery=c((actual.energy01*.35+actual.capacity01*.35+(1-actual.thermal01)*.15+(1-actual.load01)*.15));
    const nextPred={
      energy01:c(st.predicted.energy01*.82+actual.energy01*.18),
      thermal01:c(st.predicted.thermal01*.82+actual.thermal01*.18),
      capacity01:c(st.predicted.capacity01*.82+actual.capacity01*.18),
      load01:c(st.predicted.load01*.82+actual.load01*.18),
    };
    const n=st.cycles+1;
    this.state.interoception={...st,cycles:n,meanMismatch01:c(st.meanMismatch01*.94+mismatch*.06),lastMismatch01:mismatch,regulationPressure01:c(st.regulationPressure01*.9+pressure*.1),stability01:c(st.stability01*.94+stable*.06),recovery01:c(st.recovery01*.9+recovery*.1),predictionCalibration01:c(st.predictionCalibration01*.94+(1-mismatch)*.06),lastObserved:actual,predicted:nextPred};
    return structuredClone(this.state.interoception);
  }

  recordOutcome(input:{emotionId?:string;action:string;success01:number;surprise01:number;regulationCost01?:number}):EmotionOutcomeCalibration{
    const key=String(input.action); const prev=this.state.outcomes[key]??{attempts:0,meanSuccess01:.5,meanSurprise01:.5,meanBenefit01:.5};
    const benefit=c(input.success01*.62+(1-input.surprise01)*.24+(1-c(input.regulationCost01??0))*.14);
    const n=prev.attempts+1; const row={attempts:n,meanSuccess01:c(prev.meanSuccess01*(n-1)/n+c(input.success01)/n),meanSurprise01:c(prev.meanSurprise01*(n-1)/n+c(input.surprise01)/n),meanBenefit01:c(prev.meanBenefit01*(n-1)/n+benefit/n)};
    this.state.outcomes={...this.state.outcomes,[key]:row}; return structuredClone(row);
  }

  outcomeCalibration(action:string):EmotionOutcomeCalibration|null{return this.state.outcomes[String(action)]?structuredClone(this.state.outcomes[String(action)]):null;}
  appraise(input:{tick:number;at?:number;goalPressure01?:number;goalCongruence01?:number;controllability01?:number;novelty01?:number;selfRelevance01?:number;socialMeaning01?:number;uncertainty01?:number;predictionError01?:number;homeostaticPressure01?:number;energy01?:number;success01?:number;external?:boolean}):EmotionEpisode{
    const a={relevance01:c(Math.max(input.goalPressure01??0,input.predictionError01??0,input.homeostaticPressure01??0)),goalCongruence01:c(input.goalCongruence01??(input.success01??.5)),controllability01:c(input.controllability01??(1-(input.uncertainty01??.35))),novelty01:c(input.novelty01??.35),selfRelevance01:c(input.selfRelevance01??.5),socialMeaning01:c(input.socialMeaning01??0),uncertainty01:c(input.uncertainty01??.35)};
    const arousal=c(a.relevance01*.20+a.novelty01*.19+a.uncertainty01*.20+(input.predictionError01??0)*.17+(input.homeostaticPressure01??0)*.15+this.state.interoception.regulationPressure01*.09);
    const valence=c(.5+(a.goalCongruence01-.5)*.48+a.controllability01*.10-(a.uncertainty01*.16)+((input.success01??.5)-.5)*.45);
    const stress=c((1-a.controllability01)*.30+a.uncertainty01*.20+(input.predictionError01??0)*.22+(input.homeostaticPressure01??0)*.18+this.state.interoception.lastMismatch01*.10);
    const dominance=c(a.controllability01*.62+a.selfRelevance01*.18+(input.success01??.5)*.20);
    let label:EmotionLabel='calm'; let actionTendency:EmotionActionTendency='engage';
    if(stress>.72 && a.controllability01<.4){label='anxiety';actionTendency='verify';}
    else if(stress>.58 && a.controllability01>.55){label='protective';actionTendency='protect';}
    else if((input.predictionError01??0)>.62 && a.controllability01<.45){label='frustration';actionTendency='reflect';}
    else if(a.socialMeaning01>.72 && valence<.38){label='sadness';actionTendency='withdraw';}
    else if(a.socialMeaning01>.72 && valence>.66){label='joy';actionTendency='approach';}
    else if(a.novelty01>.64 && a.uncertainty01>.35){label='curiosity';actionTendency='explore';}
    else if(valence<.34 && dominance>.65){label='anger';actionTendency='protect';}
    const attentionCapture=c(arousal*.55+a.relevance01*.25+a.selfRelevance01*.20);
    const n=this.state.episodes+1;
    const episode:EmotionEpisode={id:`emo:${Math.max(0,Math.floor(input.tick))}:${Number(input.at??Date.now())}:${n}`,tick:Math.max(0,Math.floor(input.tick)),at:Number(input.at??Date.now()),label,actionTendency,valence01:valence,arousal01:arousal,dominance01:dominance,appraisal:a,interoceptiveDelta:{stress01:stress,energy01:c(-stress*.12+((input.success01??.5)-.5)*.08+0.06),load01:c(arousal*.24),attentionCapture01:attentionCapture},memorySalienceMultiplier01:c(.8+attentionCapture*.7),confidence01:c(.45+a.relevance01*.35+a.controllability01*.20),cause:input.external?'external-experience':'internal-state'};
    this.state={...this.state,episodes:n,lastTick:episode.tick,lastAt:episode.at,lastLabel:episode.label,meanArousal01:c(this.state.meanArousal01*(n-1)/n+episode.arousal01/n),meanValence01:c(this.state.meanValence01*(n-1)/n+episode.valence01/n),meanStress01:c(this.state.meanStress01*(n-1)/n+stress/n),meanAttentionCapture01:c(this.state.meanAttentionCapture01*(n-1)/n+attentionCapture/n),history:[episode,...this.state.history].slice(0,128)};
    return structuredClone(episode);
  }

  /** Functional feeling-access layer: transforms an emotion episode into an explicitly
   * body-linked self-report candidate. It represents access to an internal episode,
   * not a claim of phenomenal experience. */
  inferFeeling(episode:EmotionEpisode,input:{energy01:number;cognitiveLoad01:number;uncertainty01:number;selfFocus01?:number}):FeelingEpisode{
    const bodyMismatch=this.state.interoception.lastMismatch01;
    const mismatch=c(bodyMismatch*.45 + Math.abs(episode.interoceptiveDelta.stress01-c(input.uncertainty01))*.30 + c(input.cognitiveLoad01)*.25);
    const bodilyFocus=c(.35+episode.interoceptiveDelta.attentionCapture01*.35+c(input.selfFocus01??.5)*.30);
    const intensity=c(episode.arousal01*.52+Math.abs(episode.valence01-.5)*.28+episode.interoceptiveDelta.attentionCapture01*.20);
    const feeling:FeelingEpisode={id:`feel:${episode.id}`,tick:episode.tick,at:episode.at,label:episode.label,intensity01:intensity,interoceptiveMismatch01:mismatch,selfAccessConfidence01:c(.46+episode.confidence01*.30+bodilyFocus*.24),bodilyFocus01:bodilyFocus,causeEmotionId:episode.id};
    this.state.feelings=[feeling,...this.state.feelings.filter(f=>f.id!==feeling.id)].slice(0,128);
    return structuredClone(feeling);
  }
  latestFeeling():FeelingEpisode|null{return this.state.feelings[0]?structuredClone(this.state.feelings[0]):null;}

  regulationPressure01():number{return this.state.interoception.regulationPressure01;}

  actionBias(action:string):number{
    const e=this.state.history[0]; if(!e)return 0;
    const match:Record<string,number>={explore:e.label==='curiosity'?0.08:0,verify:e.label==='anxiety'||e.label==='frustration'?0.06:0,reflect:e.label==='frustration'?0.055:0,rest:e.label==='protective'||e.label==='sadness'?0.04:0,protect:e.label==='protective'||e.label==='anger'?0.07:0,approach:e.label==='joy'?0.05:0,withdraw:e.label==='sadness'?0.06:0,engage:e.label==='calm'||e.label==='joy'?0.025:0};
    const intero=this.state.interoception;
    const regulation:Record<string,number>={rest:intero.regulationPressure01*.075,protect:intero.regulationPressure01*.055,verify:intero.regulationPressure01*.025,reflect:intero.regulationPressure01*.015,explore:-intero.regulationPressure01*.055,approach:-intero.regulationPressure01*.02,engage:-intero.regulationPressure01*.015,withdraw:intero.regulationPressure01*.01};
    const calibration=this.state.outcomes[action];
    const learned=calibration&&calibration.attempts>=3 ? (calibration.meanBenefit01-.5)*.045 : 0;
    return c(Math.max(0,(match[action]??0)+regulation[action]+learned))*c(.55+e.interoceptiveDelta.attentionCapture01*.45);
  }

  summary(){return {episodes:this.state.episodes,lastLabel:this.state.lastLabel,meanArousal01:this.state.meanArousal01,meanValence01:this.state.meanValence01,meanStress01:this.state.meanStress01,meanAttentionCapture01:this.state.meanAttentionCapture01,interoception:structuredClone(this.state.interoception),outcomes:structuredClone(this.state.outcomes)};}

}
export const defaultEmotionAppraisalState=()=>empty();
