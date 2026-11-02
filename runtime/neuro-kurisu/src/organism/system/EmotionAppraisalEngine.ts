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

export class EmotionAppraisalEngine {
  private state=empty();
  restore(raw?:Partial<EmotionAppraisalState>|null){
    // Persisted state is untrusted input: never spread it, invoke getters, or trust nested prototypes.
    const record=(value:unknown):Record<string,unknown>|null=>{
      try { if(!value || typeof value!=='object' || Array.isArray(value)) return null; const proto=Object.getPrototypeOf(value); return proto===Object.prototype || proto===null ? value as Record<string,unknown> : null; }
      catch { return null; }
    };
    const own=(value:unknown,key:string):unknown=>{
      const row=record(value); if(!row) return undefined;
      try { const descriptor=Object.getOwnPropertyDescriptor(row,key); return descriptor && 'value' in descriptor ? descriptor.value : undefined; }
      catch { return undefined; }
    };
    const bounded=(value:unknown,fallback:number,min=0,max=1):number=>
      typeof value==='number' && Number.isFinite(value) ? Math.max(min,Math.min(max,value)) : fallback;
    const count=(value:unknown,fallback=0,max=1_000_000_000):number=>
      typeof value==='number' && Number.isSafeInteger(value) ? Math.max(0,Math.min(max,value)) : fallback;
    const labels:EmotionLabel[]=['curiosity','calm','joy','anxiety','frustration','sadness','anger','protective'];
    const tendencies:EmotionActionTendency[]=['explore','engage','verify','reflect','rest','protect','withdraw','approach'];
    const d=empty(), r=record(raw) ?? {};
    const emotion=(value:unknown):EmotionLabel=>labels.includes(value as EmotionLabel)?value as EmotionLabel:'calm';
    const sanitizeEpisode=(value:unknown):EmotionEpisode|null=>{
      const e=record(value); if(!e) return null;
      const appraisal=record(own(e,'appraisal')), delta=record(own(e,'interoceptiveDelta'));
      const id=own(e,'id'), tick=own(e,'tick'), at=own(e,'at'), tendency=own(e,'actionTendency');
      if(typeof id!=='string' || !id.trim() || id.length>192 || typeof tick!=='number' || !Number.isSafeInteger(tick) || tick<0
        || typeof at!=='number' || !Number.isFinite(at) || !tendencies.includes(tendency as EmotionActionTendency) || !appraisal || !delta) return null;
      const n=(row:Record<string,unknown>,key:string)=>bounded(own(row,key),0);
      return {id,tick,at,label:emotion(own(e,'label')),actionTendency:tendency as EmotionActionTendency,
        valence01:bounded(own(e,'valence01'),.5),arousal01:bounded(own(e,'arousal01'),0),dominance01:bounded(own(e,'dominance01'),.5),
        appraisal:{relevance01:n(appraisal,'relevance01'),goalCongruence01:n(appraisal,'goalCongruence01'),controllability01:n(appraisal,'controllability01'),novelty01:n(appraisal,'novelty01'),selfRelevance01:n(appraisal,'selfRelevance01'),socialMeaning01:n(appraisal,'socialMeaning01'),uncertainty01:n(appraisal,'uncertainty01')},
        interoceptiveDelta:{stress01:n(delta,'stress01'),energy01:n(delta,'energy01'),load01:n(delta,'load01'),attentionCapture01:n(delta,'attentionCapture01')},
        memorySalienceMultiplier01:bounded(own(e,'memorySalienceMultiplier01'),1),confidence01:bounded(own(e,'confidence01'),.5),
        cause:typeof own(e,'cause')==='string'?String(own(e,'cause')).slice(0,96):'restored'};
    };
    const sanitizeFeeling=(value:unknown):FeelingEpisode|null=>{
      const e=record(value); if(!e) return null;
      const id=own(e,'id'),cause=own(e,'causeEmotionId'),tick=own(e,'tick'),at=own(e,'at');
      if(typeof id!=='string' || !id.trim() || id.length>224 || typeof cause!=='string' || cause.length>192
        || typeof tick!=='number' || !Number.isSafeInteger(tick) || tick<0 || typeof at!=='number' || !Number.isFinite(at)) return null;
      return {id,tick,at,label:emotion(own(e,'label')),intensity01:bounded(own(e,'intensity01'),0),
        interoceptiveMismatch01:bounded(own(e,'interoceptiveMismatch01'),0),selfAccessConfidence01:bounded(own(e,'selfAccessConfidence01'),.5),
        bodilyFocus01:bounded(own(e,'bodilyFocus01'),.5),causeEmotionId:cause};
    };
    const intero=record(own(r,'interoception')) ?? {};
    const vector=(value:unknown,fallback:InteroceptiveAffectState['lastObserved'])=>({
      energy01:bounded(own(value,'energy01'),fallback.energy01),thermal01:bounded(own(value,'thermal01'),fallback.thermal01),
      capacity01:bounded(own(value,'capacity01'),fallback.capacity01),load01:bounded(own(value,'load01'),fallback.load01)});
    const outcomeSource=record(own(r,'outcomes')) ?? {};
    const outcomes:Record<string,EmotionOutcomeCalibration>={};
    for(const key of Object.keys(outcomeSource).slice(0,64)){
      if(!/^[a-zA-Z0-9:_-]{1,64}$/.test(key)) continue;
      const row=record(own(outcomeSource,key)); if(!row) continue;
      outcomes[key]={attempts:count(own(row,'attempts')),meanSuccess01:bounded(own(row,'meanSuccess01'),.5),
        meanSurprise01:bounded(own(row,'meanSurprise01'),.5),meanBenefit01:bounded(own(row,'meanBenefit01'),.5)};
    }
    const historyRaw=own(r,'history'), feelingsRaw=own(r,'feelings');
    const history:EmotionEpisode[]=[];
    const feelings:FeelingEpisode[]=[];
    try { if(Array.isArray(historyRaw)) for(let i=0;i<Math.min(historyRaw.length,128);i++){const item=historyRaw[i];const clean=sanitizeEpisode(item);if(clean)history.push(clean);} } catch {}
    try { if(Array.isArray(feelingsRaw)) for(let i=0;i<Math.min(feelingsRaw.length,128);i++){const item=feelingsRaw[i];const clean=sanitizeFeeling(item);if(clean)feelings.push(clean);} } catch {}
    this.state={...d,version:2,episodes:count(own(r,'episodes')),lastTick:bounded(own(r,'lastTick'),-1,-1,Number.MAX_SAFE_INTEGER),
      lastAt:bounded(own(r,'lastAt'),0,-Number.MAX_VALUE,Number.MAX_VALUE),lastLabel:emotion(own(r,'lastLabel')),
      meanArousal01:bounded(own(r,'meanArousal01'),d.meanArousal01),meanValence01:bounded(own(r,'meanValence01'),d.meanValence01),
      meanStress01:bounded(own(r,'meanStress01'),d.meanStress01),meanAttentionCapture01:bounded(own(r,'meanAttentionCapture01'),d.meanAttentionCapture01),
      history,feelings,outcomes,
      interoception:{cycles:count(own(intero,'cycles')),meanMismatch01:bounded(own(intero,'meanMismatch01'),d.interoception.meanMismatch01),
        lastMismatch01:bounded(own(intero,'lastMismatch01'),d.interoception.lastMismatch01),
        regulationPressure01:bounded(own(intero,'regulationPressure01'),d.interoception.regulationPressure01),
        stability01:bounded(own(intero,'stability01'),d.interoception.stability01),recovery01:bounded(own(intero,'recovery01'),d.interoception.recovery01),
        predictionCalibration01:bounded(own(intero,'predictionCalibration01'),d.interoception.predictionCalibration01),
        lastObserved:vector(own(intero,'lastObserved'),d.interoception.lastObserved),predicted:vector(own(intero,'predicted'),d.interoception.predicted)}};
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
