import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';
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

export interface EmotionAppraisalInfluenceProfile {
  personality?: { curiosity01?:number; caution01?:number; care01?:number; persistence01?:number; confidence01?:number };
  mood?: { valence01?:number; arousal01?:number; confidence01?:number };
  cognitive?: { load01?:number; confidence01?:number };
  social?: { relevance01?:number; normConflict01?:number; confidence01?:number };
}
export interface NormalizedEmotionAppraisalInfluences {
  personality: { curiosity01:number; caution01:number; care01:number; persistence01:number; confidence01:number };
  mood: { valence01:number; arousal01:number; confidence01:number };
  cognitive: { load01:number; confidence01:number };
  social: { relevance01:number; normConflict01:number; confidence01:number };
}
export interface EmotionOutcomeReceipt {
  fingerprint:string;
  emotionId:string|null;
  calibration:EmotionOutcomeCalibration;
}

export interface EmotionEpisode {
  id:string; tick:number; at:number; label:EmotionLabel; actionTendency:EmotionActionTendency;
  valence01:number; arousal01:number; dominance01:number;
  appraisal:{relevance01:number; goalCongruence01:number; controllability01:number; novelty01:number; selfRelevance01:number; socialMeaning01:number; uncertainty01:number};
  interoceptiveDelta:{stress01:number; energy01:number; load01:number; attentionCapture01:number};
  /** Homeostatic pressure captured at appraisal time; optional for older persisted episodes. */
  regulationPressure01?:number;
  memorySalienceMultiplier01:number;
  confidence01:number;
  cause:string;
  /** Auditable, confidence-gated context modifiers used for this appraisal. */
  modulators?:NormalizedEmotionAppraisalInfluences;
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
  /** Outcome calibrations bound to action + emotion label + regulation-pressure band. */
  contextualOutcomes:Record<string,EmotionOutcomeCalibration>;
  /** Bounded idempotency ledger; identical outcome IDs cannot update learning twice. */
  outcomeReceipts:Record<string,EmotionOutcomeReceipt>;
}


const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const isRecord=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function snapshotEmotionInput(value:unknown,errorCode:string):Record<string,unknown>{
  try{
    const detached=snapshotPlainData<Record<string,unknown>>(value,{
      allowNonFiniteNumbers:true,maxDepth:12,maxNodes:512,maxStringUnits:16*1024,
    });
    if(!isRecord(detached))throw new Error('not-a-record');
    return detached;
  }catch{
    throw new TypeError(errorCode);
  }
}
const safeCounter=(value:unknown,fallback=0):number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:fallback;
const safeTimestamp=(value:unknown,fallback=0):number=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:fallback;
const safeUnit=(value:unknown,fallback:number):number=>typeof value==='number'&&Number.isFinite(value)?c(value):fallback;
const EMOTION_LABELS:readonly EmotionLabel[]=['curiosity','calm','joy','anxiety','frustration','sadness','anger','protective'];
const ACTION_TENDENCIES:readonly EmotionActionTendency[]=['explore','engage','verify','reflect','rest','protect','withdraw','approach'];
type RegulationBand='low'|'medium'|'high';
const regulationBand=(value:number):RegulationBand=>value<.34?'low':value<.67?'medium':'high';
const contextOutcomeKey=(action:string,label:EmotionLabel,pressure01:number)=>JSON.stringify([action,label,regulationBand(pressure01)]);
const safeKey=(value:unknown,max=256):value is string=>typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value&&!/[\\u0000-\\u001f\\u007f-\\u009f]/u.test(value)&&!['__proto__','prototype','constructor','toString','hasOwnProperty'].includes(value);
function normalizeInfluences(value:unknown):NormalizedEmotionAppraisalInfluences {
  if(value===undefined||value===null) return {
    personality:{curiosity01:.5,caution01:.5,care01:.5,persistence01:.5,confidence01:0},
    mood:{valence01:.5,arousal01:.5,confidence01:0},
    cognitive:{load01:0,confidence01:0},
    social:{relevance01:.5,normConflict01:0,confidence01:0},
  };
  if(!isRecord(value)) throw new TypeError('emotion-appraisal-modulators-invalid');
  const group=(raw:unknown,fields:readonly string[],defaults:Record<string,number>,name:string)=>{
    if(raw!==undefined&&raw!==null&&!isRecord(raw)) throw new TypeError('emotion-appraisal-modulators-'+name+'-invalid');
    const source=isRecord(raw)?raw:{}; const result:Record<string,number>={...defaults};
    for(const field of fields){
      const candidate=source[field];
      if(candidate===undefined)continue;
      if(typeof candidate!=='number'||!Number.isFinite(candidate)||candidate<0||candidate>1) throw new RangeError('emotion-appraisal-modulators-'+name+'-invalid');
      result[field]=candidate;
    }
    return result;
  };
  return {
    personality:group((value as any).personality,['curiosity01','caution01','care01','persistence01','confidence01'],{curiosity01:.5,caution01:.5,care01:.5,persistence01:.5,confidence01:0},'personality') as NormalizedEmotionAppraisalInfluences['personality'],
    mood:group((value as any).mood,['valence01','arousal01','confidence01'],{valence01:.5,arousal01:.5,confidence01:0},'mood') as NormalizedEmotionAppraisalInfluences['mood'],
    cognitive:group((value as any).cognitive,['load01','confidence01'],{load01:0,confidence01:0},'cognitive') as NormalizedEmotionAppraisalInfluences['cognitive'],
    social:group((value as any).social,['relevance01','normConflict01','confidence01'],{relevance01:.5,normConflict01:0,confidence01:0},'social') as NormalizedEmotionAppraisalInfluences['social'],
  };
}
const unitFieldsAreValid=(value:unknown,fields:readonly string[]):value is Record<string,number>=>isRecord(value)&&fields.every(field=>typeof value[field]==='number'&&Number.isFinite(value[field])&&(value[field] as number)>=0&&(value[field] as number)<=1);
const normalizeEpisode=(value:unknown):EmotionEpisode|null=>{
  if(!isRecord(value)||typeof value.id!=='string'||value.id.length===0||value.id.length>256||
     typeof value.tick!=='number'||!Number.isSafeInteger(value.tick)||value.tick<0||
     typeof value.at!=='number'||!Number.isFinite(value.at)||value.at<0||
     !EMOTION_LABELS.includes(value.label as EmotionLabel)||!ACTION_TENDENCIES.includes(value.actionTendency as EmotionActionTendency)||
     typeof value.cause!=='string'||value.cause.length>120||
     (value.regulationPressure01!==undefined&&(typeof value.regulationPressure01!=='number'||!Number.isFinite(value.regulationPressure01)||value.regulationPressure01<0||value.regulationPressure01>1)))return null;
  if(!unitFieldsAreValid(value.appraisal,['relevance01','goalCongruence01','controllability01','novelty01','selfRelevance01','socialMeaning01','uncertainty01'])||
     !unitFieldsAreValid(value.interoceptiveDelta,['stress01','energy01','load01','attentionCapture01'])||
     !unitFieldsAreValid(value,['valence01','arousal01','dominance01','memorySalienceMultiplier01','confidence01']))return null;
  return structuredClone(value) as unknown as EmotionEpisode;
};
const normalizeFeeling=(value:unknown):FeelingEpisode|null=>{
  if(!isRecord(value)||typeof value.id!=='string'||value.id.length===0||value.id.length>256||
     typeof value.causeEmotionId!=='string'||typeof value.tick!=='number'||!Number.isSafeInteger(value.tick)||value.tick<0||
     typeof value.at!=='number'||!Number.isFinite(value.at)||value.at<0||
     !EMOTION_LABELS.includes(value.label as EmotionLabel)||
     !unitFieldsAreValid(value,['intensity01','interoceptiveMismatch01','selfAccessConfidence01','bodilyFocus01']))return null;
  return structuredClone(value) as unknown as FeelingEpisode;
};
const emptyInteroception=():InteroceptiveAffectState=>({
  cycles:0, meanMismatch01:.18, lastMismatch01:.18, regulationPressure01:.18, stability01:.72, recovery01:.5, predictionCalibration01:.5,
  lastObserved:{energy01:.68,thermal01:.2,capacity01:.72,load01:.38},
  predicted:{energy01:.68,thermal01:.2,capacity01:.72,load01:.38},
});
const empty=():EmotionAppraisalState=>({version:2,episodes:0,lastTick:-1,lastAt:0,lastLabel:'calm',meanArousal01:0.22,meanValence01:0.5,meanStress01:0.2,meanAttentionCapture01:0.2,history:[],feelings:[],interoception:emptyInteroception(),outcomes:{},contextualOutcomes:{},outcomeReceipts:{}});

export class EmotionAppraisalEngine {
  private state=empty();
  restore(raw?:Partial<EmotionAppraisalState>|null){
    const d=empty();
    let detached: unknown;
    try {
      detached = snapshotPlainData(raw ?? {}, { allowNonFiniteNumbers: true, maxDepth: 24, maxNodes: 10_000, maxStringUnits: 1024 * 1024 });
    } catch {
      this.state = d;
      return;
    }
    const r=isRecord(detached)?detached:{};
    const rawInteroception=isRecord(r.interoception)?r.interoception:{};
    const rawObserved=isRecord(rawInteroception.lastObserved)?rawInteroception.lastObserved:{};
    const rawPredicted=isRecord(rawInteroception.predicted)?rawInteroception.predicted:{};
    const rawOutcomes=isRecord(r.outcomes)?r.outcomes:{};
    const rawContextualOutcomes=isRecord(r.contextualOutcomes)?r.contextualOutcomes:{};
    const rawOutcomeReceipts=isRecord(r.outcomeReceipts)?r.outcomeReceipts:{};
    const outcomes:Record<string,EmotionOutcomeCalibration>={};
    const contextualOutcomes:Record<string,EmotionOutcomeCalibration>={};
    const outcomeReceipts:Record<string,EmotionOutcomeReceipt>={};
    for(const [key,value] of Object.entries(rawOutcomes).slice(0,128)){
      if(!key||key.length>96||!isRecord(value))continue;
      if(typeof value.attempts!=='number'||!Number.isSafeInteger(value.attempts)||value.attempts<0)continue;
      if(!unitFieldsAreValid(value,['meanSuccess01','meanSurprise01','meanBenefit01']))continue;
      outcomes[key]={attempts:value.attempts,meanSuccess01:value.meanSuccess01,meanSurprise01:value.meanSurprise01,meanBenefit01:value.meanBenefit01};
    }
    for(const [key,value] of Object.entries(rawContextualOutcomes).slice(0,512)){
      if(!key||key.length>256||!isRecord(value))continue;
      let context:unknown;
      try{context=JSON.parse(key);}catch{continue;}
      if(!Array.isArray(context)||context.length!==3||typeof context[0]!=='string'||context[0].length===0||context[0].length>96||
         !EMOTION_LABELS.includes(context[1] as EmotionLabel)||!['low','medium','high'].includes(String(context[2])))continue;
      if(typeof value.attempts!=='number'||!Number.isSafeInteger(value.attempts)||value.attempts<0)continue;
      if(!unitFieldsAreValid(value,['meanSuccess01','meanSurprise01','meanBenefit01']))continue;
      contextualOutcomes[key]={attempts:value.attempts,meanSuccess01:value.meanSuccess01,meanSurprise01:value.meanSurprise01,meanBenefit01:value.meanBenefit01};
    }
    for(const [key,value] of Object.entries(rawOutcomeReceipts).slice(-512)){
      if(!safeKey(key,256)||!isRecord(value)||typeof value.fingerprint!=='string'||value.fingerprint.length>512)continue;
      if(value.emotionId!==null&&value.emotionId!==undefined&&!safeKey(value.emotionId,256))continue;
      const calibration=value.calibration;
      if(!isRecord(calibration)||typeof calibration.attempts!=='number'||!Number.isSafeInteger(calibration.attempts)||calibration.attempts<0||
         !unitFieldsAreValid(calibration,['meanSuccess01','meanSurprise01','meanBenefit01']))continue;
      outcomeReceipts[key]={fingerprint:value.fingerprint,emotionId:typeof value.emotionId==='string'?value.emotionId:null,calibration:{attempts:calibration.attempts,meanSuccess01:calibration.meanSuccess01,meanSurprise01:calibration.meanSurprise01,meanBenefit01:calibration.meanBenefit01}};
    }
    const history=Array.isArray(r.history)?r.history.map(normalizeEpisode).filter((row):row is EmotionEpisode=>row!==null).slice(0,128):[];
    const feelings=Array.isArray(r.feelings)?r.feelings.map(normalizeFeeling).filter((row):row is FeelingEpisode=>row!==null).slice(0,128):[];
    const dI=d.interoception;
    this.state={
      version:2,
      episodes:safeCounter(r.episodes,d.episodes),
      lastTick:typeof r.lastTick==='number'&&Number.isSafeInteger(r.lastTick)&&r.lastTick>=-1?r.lastTick:d.lastTick,
      lastAt:safeTimestamp(r.lastAt,d.lastAt),
      lastLabel:EMOTION_LABELS.includes(r.lastLabel as EmotionLabel)?r.lastLabel as EmotionLabel:d.lastLabel,
      meanArousal01:safeUnit(r.meanArousal01,d.meanArousal01),
      meanValence01:safeUnit(r.meanValence01,d.meanValence01),
      meanStress01:safeUnit(r.meanStress01,d.meanStress01),
      meanAttentionCapture01:safeUnit(r.meanAttentionCapture01,d.meanAttentionCapture01),
      history,feelings,
      interoception:{
        cycles:safeCounter(rawInteroception.cycles,dI.cycles),
        meanMismatch01:safeUnit(rawInteroception.meanMismatch01,dI.meanMismatch01),
        lastMismatch01:safeUnit(rawInteroception.lastMismatch01,dI.lastMismatch01),
        regulationPressure01:safeUnit(rawInteroception.regulationPressure01,dI.regulationPressure01),
        stability01:safeUnit(rawInteroception.stability01,dI.stability01),
        recovery01:safeUnit(rawInteroception.recovery01,dI.recovery01),
        predictionCalibration01:safeUnit(rawInteroception.predictionCalibration01,dI.predictionCalibration01),
        lastObserved:{
          energy01:safeUnit(rawObserved.energy01,dI.lastObserved.energy01),
          thermal01:safeUnit(rawObserved.thermal01,dI.lastObserved.thermal01),
          capacity01:safeUnit(rawObserved.capacity01,dI.lastObserved.capacity01),
          load01:safeUnit(rawObserved.load01,dI.lastObserved.load01),
        },
        predicted:{
          energy01:safeUnit(rawPredicted.energy01,dI.predicted.energy01),
          thermal01:safeUnit(rawPredicted.thermal01,dI.predicted.thermal01),
          capacity01:safeUnit(rawPredicted.capacity01,dI.predicted.capacity01),
          load01:safeUnit(rawPredicted.load01,dI.predicted.load01),
        },
      },
      outcomes,
      contextualOutcomes,
      outcomeReceipts,
    };
  }
  snapshot(){return structuredClone(this.state);}

  observeInteroception(input:{energy01:number;thermal01:number;capacity01:number;load01:number;homeostaticPressure01?:number}):InteroceptiveAffectState{
    input=snapshotEmotionInput(input,'emotion-interoception-input-must-be-plain-data') as unknown as typeof input;
    const unit=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
    if(!unit(input.energy01)||!unit(input.thermal01)||!unit(input.capacity01)||!unit(input.load01)||
       (input.homeostaticPressure01!==undefined&&!unit(input.homeostaticPressure01))){
      throw new RangeError('emotion-interoception-values-invalid');
    }
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

  recordOutcome(input:{emotionId?:string;outcomeId?:string;action:string;success01:number;surprise01:number;regulationCost01?:number}):EmotionOutcomeCalibration{
    input=snapshotEmotionInput(input,'emotion-outcome-input-must-be-plain-data') as unknown as typeof input;
    if(!safeKey(input.action,96)) throw new TypeError('emotion-outcome-action-invalid');
    const unitInterval=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
    if(!unitInterval(input.success01)||!unitInterval(input.surprise01)||
       (input.regulationCost01!==undefined&&!unitInterval(input.regulationCost01))) throw new RangeError('emotion-outcome-values-invalid');
    if(input.emotionId!==undefined&&!safeKey(input.emotionId,256)) throw new TypeError('emotion-outcome-emotion-link-invalid');
    if(input.outcomeId!==undefined&&!safeKey(input.outcomeId,256)) throw new TypeError('emotion-outcome-id-invalid');
    const linkedEmotion=input.emotionId===undefined?this.state.history[0]:this.state.history.find(row=>row.id===input.emotionId);
    if(input.emotionId!==undefined&&!linkedEmotion)throw new TypeError('emotion-outcome-emotion-link-invalid');
    const resolvedEmotionId=linkedEmotion?.id??null;
    const fingerprint=JSON.stringify([input.action,resolvedEmotionId,input.success01,input.surprise01,input.regulationCost01??0]);
    if(input.outcomeId!==undefined){
      const previousReceipt=this.state.outcomeReceipts[input.outcomeId];
      if(previousReceipt){
        if(previousReceipt.fingerprint!==fingerprint)throw new TypeError('emotion-outcome-replay-conflict');
        return structuredClone(previousReceipt.calibration);
      }
      if(resolvedEmotionId!==null&&Object.values(this.state.outcomeReceipts).some(receipt=>receipt.emotionId===resolvedEmotionId))
        throw new TypeError('emotion-outcome-episode-already-credited');
    }
    const key=input.action;
    const prev=Object.prototype.hasOwnProperty.call(this.state.outcomes,key)?this.state.outcomes[key]:{attempts:0,meanSuccess01:.5,meanSurprise01:.5,meanBenefit01:.5};
    const benefit=c(input.success01*.62+(1-input.surprise01)*.24+(1-c(input.regulationCost01??0))*.14);
    const n=prev.attempts+1;
    const row={attempts:n,meanSuccess01:c(prev.meanSuccess01*(n-1)/n+c(input.success01)/n),meanSurprise01:c(prev.meanSurprise01*(n-1)/n+c(input.surprise01)/n),meanBenefit01:c(prev.meanBenefit01*(n-1)/n+benefit/n)};
    this.state.outcomes={...this.state.outcomes,[key]:row};
    if(linkedEmotion){
      const contextualPressure=linkedEmotion.regulationPressure01??linkedEmotion.interoceptiveDelta.stress01;
      const contextualKey=contextOutcomeKey(key,linkedEmotion.label,contextualPressure);
      const previous=Object.prototype.hasOwnProperty.call(this.state.contextualOutcomes,contextualKey)?this.state.contextualOutcomes[contextualKey]:{attempts:0,meanSuccess01:.5,meanSurprise01:.5,meanBenefit01:.5};
      const contextN=previous.attempts+1;
      const contextualRow={attempts:contextN,meanSuccess01:c(previous.meanSuccess01*(contextN-1)/contextN+c(input.success01)/contextN),meanSurprise01:c(previous.meanSurprise01*(contextN-1)/contextN+c(input.surprise01)/contextN),meanBenefit01:c(previous.meanBenefit01*(contextN-1)/contextN+benefit/contextN)};
      this.state.contextualOutcomes={...this.state.contextualOutcomes,[contextualKey]:contextualRow};
    }
    if(input.outcomeId!==undefined){
      const next={...this.state.outcomeReceipts,[input.outcomeId]:{fingerprint,emotionId:resolvedEmotionId,calibration:structuredClone(row)}};
      const retained=Object.entries(next).slice(-512);
      this.state.outcomeReceipts=Object.fromEntries(retained);
    }
    return structuredClone(row);
  }

  outcomeCalibration(action:string):EmotionOutcomeCalibration|null{
    if(typeof action!=='string'||action.length===0||action.length>96||action.trim()!==action||
       ['__proto__','prototype','constructor','toString','hasOwnProperty'].includes(action))return null;
    return Object.prototype.hasOwnProperty.call(this.state.outcomes,action)
      ?structuredClone(this.state.outcomes[action])
      :null;
  }
  appraise(input:{tick:number;at?:number;goalPressure01?:number;goalCongruence01?:number;controllability01?:number;novelty01?:number;selfRelevance01?:number;socialMeaning01?:number;uncertainty01?:number;predictionError01?:number;homeostaticPressure01?:number;energy01?:number;success01?:number;external?:boolean;modulators?:EmotionAppraisalInfluenceProfile}):EmotionEpisode{
    input=snapshotEmotionInput(input,'emotion-appraisal-input-must-be-plain-data') as unknown as typeof input;
    if(!input||typeof input!=='object'||!Number.isSafeInteger(input.tick)||input.tick<0)throw new RangeError('emotion-appraisal-tick-must-be-a-non-negative-safe-integer');
    if(input.at!==undefined&&(typeof input.at!=='number'||!Number.isFinite(input.at)||input.at<0))throw new RangeError('emotion-appraisal-timestamp-must-be-finite-and-non-negative');
    const unitInterval=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
    const appraisalFields=[
      input.goalPressure01,input.goalCongruence01,input.controllability01,input.novelty01,
      input.selfRelevance01,input.socialMeaning01,input.uncertainty01,input.predictionError01,
      input.homeostaticPressure01,input.energy01,input.success01,
    ];
    if(appraisalFields.some(value=>value!==undefined&&!unitInterval(value))||
       (input.external!==undefined&&typeof input.external!=='boolean')) throw new RangeError('emotion-appraisal-values-invalid');
    const m=normalizeInfluences(input.modulators);
    const pGain=m.personality.confidence01, moodGain=m.mood.confidence01, cognitiveGain=m.cognitive.confidence01, socialGain=m.social.confidence01;
    const baseUncertainty=input.uncertainty01??.35;
    const a={
      relevance01:c(Math.max(input.goalPressure01??0,input.predictionError01??0,input.homeostaticPressure01??0,m.social.normConflict01*socialGain*.32)),
      goalCongruence01:c(input.goalCongruence01??(input.success01??.5)),
      controllability01:c((input.controllability01??(1-baseUncertainty))-m.cognitive.load01*.045*cognitiveGain),
      novelty01:c((input.novelty01??.35)+(m.personality.curiosity01-.5)*.10*pGain),
      selfRelevance01:c(input.selfRelevance01??.5),
      socialMeaning01:c((input.socialMeaning01??0)+(m.personality.care01-.5)*.08*pGain+(m.social.relevance01-.5)*.08*socialGain),
      uncertainty01:c(baseUncertainty+(m.personality.caution01-.5)*.08*pGain+m.cognitive.load01*.055*cognitiveGain+m.social.normConflict01*.06*socialGain),
    };
    const arousal=c(a.relevance01*.20+a.novelty01*.19+a.uncertainty01*.20+(input.predictionError01??0)*.17+(input.homeostaticPressure01??0)*.15+this.state.interoception.regulationPressure01*.09+(m.mood.arousal01-.5)*.08*moodGain+m.cognitive.load01*.05*cognitiveGain);
    const valence=c(.5+(a.goalCongruence01-.5)*.48+a.controllability01*.10-(a.uncertainty01*.16)+((input.success01??.5)-.5)*.45+(m.mood.valence01-.5)*.08*moodGain);
    const stress=c((1-a.controllability01)*.30+a.uncertainty01*.20+(input.predictionError01??0)*.22+(input.homeostaticPressure01??0)*.18+this.state.interoception.lastMismatch01*.10+m.cognitive.load01*.065*cognitiveGain+m.social.normConflict01*.07*socialGain);
    const dominance=c(a.controllability01*.62+a.selfRelevance01*.18+(input.success01??.5)*.20+(m.personality.persistence01-.5)*.045*pGain);
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
    const episode:EmotionEpisode={id:`emo:${input.tick}:${Number(input.at??Date.now())}:${n}`,tick:input.tick,at:Number(input.at??Date.now()),label,actionTendency,valence01:valence,arousal01:arousal,dominance01:dominance,appraisal:a,interoceptiveDelta:{stress01:stress,energy01:c(-stress*.12+((input.success01??.5)-.5)*.08+0.06),load01:c(arousal*.24),attentionCapture01:attentionCapture},regulationPressure01:this.state.interoception.regulationPressure01,memorySalienceMultiplier01:c(.8+attentionCapture*.7),confidence01:c(.45+a.relevance01*.35+a.controllability01*.20),cause:input.external?'external-experience':'internal-state',modulators:m};
    this.state={...this.state,episodes:n,lastTick:episode.tick,lastAt:episode.at,lastLabel:episode.label,meanArousal01:c(this.state.meanArousal01*(n-1)/n+episode.arousal01/n),meanValence01:c(this.state.meanValence01*(n-1)/n+episode.valence01/n),meanStress01:c(this.state.meanStress01*(n-1)/n+stress/n),meanAttentionCapture01:c(this.state.meanAttentionCapture01*(n-1)/n+attentionCapture/n),history:[episode,...this.state.history].slice(0,128)};
    return structuredClone(episode);
  }

  /** Functional feeling-access layer: transforms an emotion episode into an explicitly
   * body-linked self-report candidate. It represents access to an internal episode,
   * not a claim of phenomenal experience. */
  inferFeeling(episode:EmotionEpisode,input:{energy01:number;cognitiveLoad01:number;uncertainty01:number;selfFocus01?:number}):FeelingEpisode{
    episode=snapshotEmotionInput(episode,'emotion-feeling-episode-must-be-plain-data') as unknown as EmotionEpisode;
    const normalizedEpisode=normalizeEpisode(episode);
    if(!normalizedEpisode)throw new TypeError('emotion-feeling-episode-invalid');
    episode=normalizedEpisode;
    input=snapshotEmotionInput(input,'emotion-feeling-input-must-be-plain-data') as unknown as typeof input;
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
    if(typeof action!=='string'||action.length===0||action.length>96||action.trim()!==action||
       ['__proto__','prototype','constructor','toString','hasOwnProperty'].includes(action))return 0;
    const e=this.state.history[0]; if(!e)return 0;
    const match:Record<string,number>={explore:e.label==='curiosity'?0.08:0,verify:e.label==='anxiety'||e.label==='frustration'?0.06:0,reflect:e.label==='frustration'?0.055:0,rest:e.label==='protective'||e.label==='sadness'?0.04:0,protect:e.label==='protective'||e.label==='anger'?0.07:0,approach:e.label==='joy'?0.05:0,withdraw:e.label==='sadness'?0.06:0,engage:e.label==='calm'||e.label==='joy'?0.025:0};
    const intero=this.state.interoception;
    const regulation:Record<string,number>={rest:intero.regulationPressure01*.075,protect:intero.regulationPressure01*.055,verify:intero.regulationPressure01*.025,reflect:intero.regulationPressure01*.015,explore:-intero.regulationPressure01*.055,approach:-intero.regulationPressure01*.02,engage:-intero.regulationPressure01*.015,withdraw:intero.regulationPressure01*.01};
    const contextualKey=contextOutcomeKey(action,e.label,this.state.interoception.regulationPressure01);
    const contextualCalibration=Object.prototype.hasOwnProperty.call(this.state.contextualOutcomes,contextualKey)
      ?this.state.contextualOutcomes[contextualKey]:undefined;
    const hasContextualCalibrationForAction=Object.keys(this.state.contextualOutcomes).some(key=>{
      try{const parsed=JSON.parse(key);return Array.isArray(parsed)&&parsed[0]===action;}catch{return false;}
    });
    // Once an action has context-bound outcome history, do not leak its global
    // reward into a distinct emotional/homeostatic context with no matched data.
    const calibration=contextualCalibration??(!hasContextualCalibrationForAction&&Object.prototype.hasOwnProperty.call(this.state.outcomes,action)?this.state.outcomes[action]:undefined);
    const matchBias=Object.prototype.hasOwnProperty.call(match,action)?match[action]:0;
    const regulationBias=Object.prototype.hasOwnProperty.call(regulation,action)?regulation[action]:0;
    const learned=calibration&&calibration.attempts>=3 ? (calibration.meanBenefit01-.5)*(contextualCalibration?.045:.015) : 0;
    const appraisalReliability=c(e.confidence01)*c(.55+.45*intero.predictionCalibration01);
    const attentionGain=c(.55+e.interoceptiveDelta.attentionCapture01*.45);
    // Preserve both excitation and inhibition: high-confidence pressure may suppress
    // exploration instead of merely adding positive bias to recovery actions.
    return Math.max(-.09,Math.min(.09,(matchBias+regulationBias+learned)*appraisalReliability*attentionGain));
  }

  summary(){return {episodes:this.state.episodes,lastLabel:this.state.lastLabel,meanArousal01:this.state.meanArousal01,meanValence01:this.state.meanValence01,meanStress01:this.state.meanStress01,meanAttentionCapture01:this.state.meanAttentionCapture01,interoception:structuredClone(this.state.interoception),outcomes:structuredClone(this.state.outcomes),contextualOutcomeContexts:Object.keys(this.state.contextualOutcomes).length,processedOutcomeReceipts:Object.keys(this.state.outcomeReceipts).length};}

}
export const defaultEmotionAppraisalState=()=>empty();
