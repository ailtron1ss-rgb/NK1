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

const EMOTION_LABELS=new Set<EmotionLabel>(['curiosity','calm','joy','anxiety','frustration','sadness','anger','protective']);
const EMOTION_TENDENCIES=new Set<EmotionActionTendency>(['explore','engage','verify','reflect','rest','protect','withdraw','approach']);
const safeRecord=(value:unknown):Record<string,unknown>|null=>{
  if(value===null||typeof value!=='object'||Array.isArray(value))return null;
  const prototype=Object.getPrototypeOf(value);
  if(prototype!==Object.prototype&&prototype!==null)return null;
  const descriptors=Object.getOwnPropertyDescriptors(value);
  const result:Record<string,unknown>=Object.create(null);
  for(const [key,descriptor] of Object.entries(descriptors)){
    if(!('value' in descriptor))return null;
    result[key]=descriptor.value;
  }
  return result;
};
const safeArray=(value:unknown,max=512):unknown[]=>{
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return [];
  const descriptor=Object.getOwnPropertyDescriptor(value,'length');
  if(!descriptor||!('value' in descriptor)||!Number.isSafeInteger(descriptor.value)||descriptor.value<0||descriptor.value>max)return [];
  const result:unknown[]=[];
  for(let i=0;i<descriptor.value;i++){
    const item=Object.getOwnPropertyDescriptor(value,String(i));
    if(!item){result.push(undefined);continue;}
    if(!('value' in item))return [];
    result.push(item.value);
  }
  return result;
};
const safeIdentity=(value:unknown,max=256):value is string=>
  typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value&&
  !Array.from(value).some(ch=>{const point=ch.codePointAt(0)??0;return point<=0x1f||(point>=0x7f&&point<=0x9f);});
const safeCount=(value:unknown,fallback=0,max=1_000_000_000):number=>
  typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?Math.min(value,max):fallback;
const safeMetric=(value:unknown,fallback:number):number=>
  typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1?value:fallback;
const safeTimestamp=(value:unknown,fallback=0):number=>
  typeof value==='number'&&Number.isFinite(value)&&value>=0?value:fallback;
const safeLabel=(value:unknown):EmotionLabel|null=>
  typeof value==='string'&&EMOTION_LABELS.has(value as EmotionLabel)?value as EmotionLabel:null;

function normalizeEmotionEpisode(value:unknown):EmotionEpisode|null{
  const row=safeRecord(value);
  if(!row||!safeIdentity(row.id)||!Number.isSafeInteger(row.tick)||Number(row.tick)<0||
    typeof row.at!=='number'||!Number.isFinite(row.at)||row.at<0||
    !safeLabel(row.label)||typeof row.actionTendency!=='string'||!EMOTION_TENDENCIES.has(row.actionTendency as EmotionActionTendency)||
    !safeIdentity(row.cause,96))return null;
  const appraisal=safeRecord(row.appraisal),delta=safeRecord(row.interoceptiveDelta);
  if(!appraisal||!delta)return null;
  const appraisalKeys=['relevance01','goalCongruence01','controllability01','novelty01','selfRelevance01','socialMeaning01','uncertainty01'] as const;
  const deltaKeys=['stress01','energy01','load01','attentionCapture01'] as const;
  const normalizedAppraisal={} as EmotionEpisode['appraisal'];
  const normalizedDelta={} as EmotionEpisode['interoceptiveDelta'];
  for(const key of appraisalKeys){
    const n=safeMetric(appraisal[key],-1);
    if(n<0)return null;
    normalizedAppraisal[key]=n;
  }
  for(const key of deltaKeys){
    const n=safeMetric(delta[key],-1);
    if(n<0)return null;
    normalizedDelta[key]=n;
  }
  const valence01=safeMetric(row.valence01,-1),arousal01=safeMetric(row.arousal01,-1),dominance01=safeMetric(row.dominance01,-1);
  const memorySalienceMultiplier01=safeMetric(row.memorySalienceMultiplier01,-1),confidence01=safeMetric(row.confidence01,-1);
  if([valence01,arousal01,dominance01,memorySalienceMultiplier01,confidence01].some(n=>n<0))return null;
  return {id:row.id,tick:Number(row.tick),at:row.at,label:row.label as EmotionLabel,actionTendency:row.actionTendency as EmotionActionTendency,
    valence01,arousal01,dominance01,appraisal:normalizedAppraisal,interoceptiveDelta:normalizedDelta,
    memorySalienceMultiplier01,confidence01,cause:row.cause};
}
function normalizeFeelingEpisode(value:unknown):FeelingEpisode|null{
  const row=safeRecord(value);
  if(!row||!safeIdentity(row.id)||!safeIdentity(row.causeEmotionId)||!Number.isSafeInteger(row.tick)||Number(row.tick)<0||
    typeof row.at!=='number'||!Number.isFinite(row.at)||row.at<0||!safeLabel(row.label))return null;
  const intensity01=safeMetric(row.intensity01,-1),interoceptiveMismatch01=safeMetric(row.interoceptiveMismatch01,-1);
  const selfAccessConfidence01=safeMetric(row.selfAccessConfidence01,-1),bodilyFocus01=safeMetric(row.bodilyFocus01,-1);
  if([intensity01,interoceptiveMismatch01,selfAccessConfidence01,bodilyFocus01].some(n=>n<0))return null;
  return {id:row.id,tick:Number(row.tick),at:row.at,label:row.label as EmotionLabel,intensity01,interoceptiveMismatch01,
    selfAccessConfidence01,bodilyFocus01,causeEmotionId:row.causeEmotionId};
}
function normalizeInteroceptiveState(value:unknown):InteroceptiveAffectState{
  const defaults=emptyInteroception(),row=safeRecord(value);
  if(!row)return defaults;
  const observed=safeRecord(row.lastObserved),predicted=safeRecord(row.predicted);
  const normalizeVector=(input:Record<string,unknown>|null,fallback:InteroceptiveAffectState['lastObserved'])=>({
    energy01:safeMetric(input?.energy01,fallback.energy01),
    thermal01:safeMetric(input?.thermal01,fallback.thermal01),
    capacity01:safeMetric(input?.capacity01,fallback.capacity01),
    load01:safeMetric(input?.load01,fallback.load01),
  });
  return {cycles:safeCount(row.cycles),meanMismatch01:safeMetric(row.meanMismatch01,defaults.meanMismatch01),
    lastMismatch01:safeMetric(row.lastMismatch01,defaults.lastMismatch01),
    regulationPressure01:safeMetric(row.regulationPressure01,defaults.regulationPressure01),
    stability01:safeMetric(row.stability01,defaults.stability01),recovery01:safeMetric(row.recovery01,defaults.recovery01),
    predictionCalibration01:safeMetric(row.predictionCalibration01,defaults.predictionCalibration01),
    lastObserved:normalizeVector(observed,defaults.lastObserved),predicted:normalizeVector(predicted,defaults.predicted)};
}

export class EmotionAppraisalEngine {
  private state=empty();
  restore(raw?:Partial<EmotionAppraisalState>|null){
    const defaults=empty(),source=safeRecord(raw);
    if(!source){this.state=defaults;return;}
    if(source.version!==undefined&&source.version!==1&&source.version!==2)throw new RangeError('unsupported emotion-appraisal state version');
    const history:EmotionEpisode[]=[];
    const seenEpisodeIds=new Set<string>();
    for(const candidate of safeArray(source.history,1024)){
      const episode=normalizeEmotionEpisode(candidate);
      if(!episode||seenEpisodeIds.has(episode.id))continue;
      seenEpisodeIds.add(episode.id);history.push(episode);
      if(history.length>=128)break;
    }
    const feelings:FeelingEpisode[]=[];
    const seenFeelingIds=new Set<string>();
    for(const candidate of safeArray(source.feelings,1024)){
      const feeling=normalizeFeelingEpisode(candidate);
      if(!feeling||seenFeelingIds.has(feeling.id))continue;
      seenFeelingIds.add(feeling.id);feelings.push(feeling);
      if(feelings.length>=128)break;
    }
    const rawOutcomes=safeRecord(source.outcomes),outcomes:Record<string,EmotionOutcomeCalibration>={};
    if(rawOutcomes){
      for(const key of Object.keys(rawOutcomes).slice(0,64)){
        const item=safeRecord(rawOutcomes[key]);
        if(!safeIdentity(key,96)||!item)continue;
        const attempts=safeCount(item.attempts,-1);
        const meanSuccess01=safeMetric(item.meanSuccess01,-1),meanSurprise01=safeMetric(item.meanSurprise01,-1),meanBenefit01=safeMetric(item.meanBenefit01,-1);
        if(attempts<1||[meanSuccess01,meanSurprise01,meanBenefit01].some(n=>n<0))continue;
        outcomes[key]={attempts,meanSuccess01,meanSurprise01,meanBenefit01};
      }
    }
    const lastTick=typeof source.lastTick==='number'&&Number.isSafeInteger(source.lastTick)&&source.lastTick>=-1?source.lastTick:-1;
    const lastLabel=safeLabel(source.lastLabel)??history[0]?.label??defaults.lastLabel;
    const episodes=Math.max(safeCount(source.episodes),history.length);
    this.state={version:2,episodes,lastTick,lastAt:safeTimestamp(source.lastAt),lastLabel,
      meanArousal01:safeMetric(source.meanArousal01,defaults.meanArousal01),
      meanValence01:safeMetric(source.meanValence01,defaults.meanValence01),
      meanStress01:safeMetric(source.meanStress01,defaults.meanStress01),
      meanAttentionCapture01:safeMetric(source.meanAttentionCapture01,defaults.meanAttentionCapture01),
      history,feelings,interoception:normalizeInteroceptiveState(source.interoception),outcomes};
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
