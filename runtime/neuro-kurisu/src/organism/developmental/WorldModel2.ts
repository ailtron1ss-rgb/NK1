import type { WorldContext, WorldTransitionForOrganism } from '../core/types.ts';

type Latent = Record<string, number>;

export interface TransitionStats2 {
  samples: number;
  meanReward: number;
  rewardVariance: number;
  surpriseMean: number;
  confidence: number;
  lastAt: number;
  meanDelta: Latent;
  deltaVariance: Latent;
}

export interface CausalHypothesis2 {
  id: string;
  cause: string;
  effect: string;
  action?: string;
  confidence: number;
  samples: number;
  support: number;
  contradictions: number;
  lastUpdatedAt: number;
}

export interface LatentWorldState2 {
  id: string;
  features: Latent;
  uncertainty01: number;
  observedAt: number;
  provenanceIds: string[];
}

export interface TransitionHypothesis2 {
  key: string;
  stateKey: string;
  action: string;
  samples: number;
  meanDelta: Latent;
  variance: Latent;
  rewardMean: number;
  rewardVariance: number;
  confidence01: number;
  lastUpdatedAt: number;
}

export interface CalibrationBucket2 {
  bucket: number;
  samples: number;
  predictedConfidence01: number;
  observedAccuracy01: number;
}

export interface WorldModel2State {
  transitions: Record<string, TransitionStats2>;
  transitionHypotheses: Record<string, TransitionHypothesis2>;
  causal: CausalHypothesis2[];
  latent: { energy:number; uncertainty:number; novelty:number; load:number };
  latentState: LatentWorldState2 | null;
  predictionErrors: number[];
  calibration: CalibrationBucket2[];
  rollouts: number;
  learnedTransitions: number;
  modelVersion: number;
  readyForLearning: boolean;
  pendingPredictions: Record<string, { predictionId:string; stateKey:string; action:string; predictedReward:number; confidence01:number; createdAt:number }>;
  predictionSequence: number;
  memoryEvidence: Record<string, { strength01:number; memoryIds:string[]; query:string; at:number }>;
  memoryEvidence01: number;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finite=(x:unknown,f=0)=>typeof x==='number'&&Number.isFinite(x)?x:f;
const MAX_MEMORY_EVIDENCE=128;
const MAX_CAUSAL_HYPOTHESES=512;
const MAX_TRANSITION_HYPOTHESES=2048;

export const defaultWorldModel2=():WorldModel2State=>({
  transitions:{}, transitionHypotheses:{}, causal:[],
  latent:{energy:.82,uncertainty:.35,novelty:.42,load:.18},
  latentState:null, predictionErrors:[], calibration:[], rollouts:0,
  learnedTransitions:0, modelVersion:2, readyForLearning:false, pendingPredictions:{}, predictionSequence:0,
  memoryEvidence:{}, memoryEvidence01:0,
});

function hashState(features:Latent):string {
  const keys=Object.keys(features).sort();
  const raw=keys.map(k=>`${k}:${features[k].toFixed(4)}`).join('|');
  let h=2166136261;
  for(const ch of raw){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return `w-${(h>>>0).toString(16)}`;
}

function worldToLatent(ctx:WorldContext):LatentWorldState2 {
  const objects=Array.isArray(ctx.objects)?ctx.objects:[];
  const facts=Array.isArray(ctx.facts)?ctx.facts:[];
  const events=Array.isArray(ctx.events)?ctx.events:[];
  const visible=objects.filter(o=>o.visible && !o.collected).length;
  const hidden=objects.filter(o=>!o.visible && !o.collected).length;
  const collected=objects.filter(o=>o.collected).length;
  const communication=facts.filter(x=>x.includes('communication')).length;
  const features:Latent={
    energy:clamp(ctx.energy), attention:clamp(ctx.attention), uncertainty:clamp(ctx.uncertainty),
    visibleObjects:clamp(visible/8), hiddenObjects:clamp(hidden/8), collectedObjects:clamp(collected/8),
    communication:clamp(communication/4), eventDensity:clamp(events.length/40), factDensity:clamp(facts.length/120),
    atLab:ctx.location==='lab'?1:0, atHome:ctx.location==='home'?1:0,
  };
  return { id:hashState(features), features, uncertainty01:clamp(ctx.uncertainty), observedAt:Date.now(), provenanceIds:[`world-tick:${ctx.tick}`] };
}

function deltaBetween(a:Latent,b:Latent):Latent {
  const keys=new Set([...Object.keys(a),...Object.keys(b)]); const out:Latent={};
  for(const k of keys) out[k]=finite(b[k])-finite(a[k]);
  return out;
}

export class WorldModel2 {
  private pruneCadenceCounter=0;
 private state=defaultWorldModel2();
 restore(s:WorldModel2State|undefined){
   const base=defaultWorldModel2();
   const legacyTransitions=Object.fromEntries(Object.entries(s?.transitions??{}).map(([action,row]:any)=>[action,{
     samples:Number(row?.samples??0), meanReward:clamp(row?.meanReward??.5), rewardVariance:clamp(row?.rewardVariance??.25),
     surpriseMean:clamp(row?.surpriseMean??.5), confidence:clamp(row?.confidence??.15), lastAt:Number(row?.lastAt??0),
     meanDelta:{...(row?.meanDelta??{})}, deltaVariance:{...(row?.deltaVariance??{})},
   }]));
   const hypotheses=Object.fromEntries(Object.entries(s?.transitionHypotheses??{}).map(([key,row]:any)=>[key,{
     key, stateKey:String(row?.stateKey??'unknown'), action:String(row?.action??key.split('|').at(-1)??'wait'), samples:Number(row?.samples??0),
     meanDelta:{...(row?.meanDelta??{})}, variance:{...(row?.variance??{})}, rewardMean:clamp(row?.rewardMean??.5),
     rewardVariance:clamp(row?.rewardVariance??.25), confidence01:clamp(row?.confidence01??.15), lastUpdatedAt:Number(row?.lastUpdatedAt??0),
   }]));
   this.state={...base,...(s??{}),
     transitions:legacyTransitions, transitionHypotheses:Object.fromEntries(Object.entries(hypotheses).slice(-MAX_TRANSITION_HYPOTHESES)) as Record<string, TransitionHypothesis2>,
     causal:Array.isArray(s?.causal)?s!.causal:[],
     predictionErrors:Array.isArray(s?.predictionErrors)?s!.predictionErrors.slice(-512):[],
     calibration:Array.isArray(s?.calibration)?s!.calibration:[], latentState:s?.latentState??null,
     modelVersion:2, learnedTransitions:Number(s?.learnedTransitions??0), readyForLearning:Boolean(s?.readyForLearning ?? Number(s?.learnedTransitions??0)>=4), pendingPredictions:{...(s?.pendingPredictions??{})}, predictionSequence:Number(s?.predictionSequence??0), memoryEvidence:Object.fromEntries(Object.entries(s?.memoryEvidence??{}).sort((a,b)=>Number((a[1] as any)?.at??0)-Number((b[1] as any)?.at??0)).slice(-MAX_MEMORY_EVIDENCE)), memoryEvidence01:clamp(Number(s?.memoryEvidence01??0)),
   };
 }

 private prunePending(now=Date.now(), maxAgeMs=120000, maxEntries=256){
   this.pruneCadenceCounter++;
   if((this.pruneCadenceCounter & 7)!==0)return;
   const all=Object.entries(this.state.pendingPredictions);
   if(all.length<=maxEntries){let stale=false;for(const [,v] of all){if(now-(v.createdAt??now)>maxAgeMs){stale=true;break;}}if(!stale)return;}
   const entries=all.filter(([,v])=>now-(v.createdAt??now)<=maxAgeMs);
   if(entries.length<=maxEntries){this.state.pendingPredictions=Object.fromEntries(entries);return;}
   entries.sort((a,b)=>a[1].createdAt-b[1].createdAt);
   this.state.pendingPredictions=Object.fromEntries(entries.slice(-maxEntries));
 }

 observeContext(context:WorldContext):LatentWorldState2 {
   const next=worldToLatent(context);
   this.state.latent={energy:next.features.energy,uncertainty:next.features.uncertainty,novelty:next.features.visibleObjects+next.features.hiddenObjects,load:clamp(1-next.features.attention)};
   this.state.latentState=next;
   return structuredClone(next);
 }

 private stateKey(latent:LatentWorldState2|null):string {
   if(!latent)return 'unknown';
   const f=latent.features;
   return `${f.atLab>.5?'lab':'home'}|energy:${Math.round(f.energy*4)}|unc:${Math.round(f.uncertainty*4)}|vis:${Math.round(f.visibleObjects*4)}`;
 }

 private hypothesisFor(stateKey:string,action:string):TransitionHypothesis2|undefined {
   return this.state.transitionHypotheses[`${stateKey}|${action}`];
 }

 applyMemoryEvidence(input:{memoryIds:string[];query:string;confidence01:number;salience01:number;at:number}):{strength01:number;applied:boolean;provenanceId:string;predictionWithoutMemory01:number;predictionWithMemory01:number;delta01:number}{
   const ids=[...new Set((input.memoryIds??[]).map(String))].slice(0,8);
   if(!ids.length)return {strength01:0,applied:false,provenanceId:'none',predictionWithoutMemory01:0,predictionWithMemory01:0,delta01:0};
   const score=Math.max(0,Math.min(1,Number(input.confidence01??0)*.65+Number(input.salience01??0)*.35));
   const key=`${ids.join(',')}|${String(input.query).slice(0,120)}`;
   const strength=clamp(score*.72);
   const previousEvidence=this.state.memoryEvidence01;
   const previousKey=this.state.memoryEvidence[key];
   this.state.memoryEvidence01=0;
   const predictionWithoutMemory01=this.predict('verify',.5,.5).reward;
   this.state.memoryEvidence[key]={strength01:strength,memoryIds:ids,query:String(input.query).slice(0,240),at:Number(input.at)};
   const memoryKeys=Object.keys(this.state.memoryEvidence);
   if(memoryKeys.length>MAX_MEMORY_EVIDENCE){
     const keep=memoryKeys.map(k=>[k,this.state.memoryEvidence[k]] as const).sort((a,b)=>a[1].at-b[1].at).slice(-MAX_MEMORY_EVIDENCE);
     this.state.memoryEvidence=Object.fromEntries(keep);
   }
   const recent=Object.values(this.state.memoryEvidence).sort((a,b)=>b.at-a.at).slice(0,16);
   this.state.memoryEvidence01=clamp(recent.reduce((sum,x)=>sum+x.strength01,0)/Math.max(1,recent.length));
   const predictionWithMemory01=this.predict('verify',.5,.5).reward;
   if(previousKey && previousKey.at>Number(input.at)){ this.state.memoryEvidence[key]=previousKey; }
   else { void previousEvidence; }
   if(this.state.latentState){
     this.state.latentState={...this.state.latentState,provenanceIds:[...new Set([...(this.state.latentState.provenanceIds??[]),...ids.map(id=>`memory:${id}`),`memory-evidence:${key}`])].slice(-64)};
   }
   return {strength01:strength,applied:true,provenanceId:`memory-evidence:${key}`,predictionWithoutMemory01,predictionWithMemory01,delta01:Math.abs(predictionWithMemory01-predictionWithoutMemory01)};
 }

 memoryEvidenceSnapshot(options:{clone?:boolean}={}){const evidence=Object.values(this.state.memoryEvidence).slice(-16);return {memoryEvidence01:this.state.memoryEvidence01,evidence:options.clone===false?evidence:evidence.map(x=>structuredClone(x))};}

 predict(action:string,baseReward:number,uncertainty=0.5,context?:WorldContext){
   if(context)this.observeContext(context);
   this.prunePending();
   const current=this.state.latentState;
   const stateKey=this.stateKey(current);
   const h=this.hypothesisFor(stateKey,action) ?? this.state.transitionHypotheses[`unknown|${action}`];
   const legacy=this.state.transitions[action];
   if(!h && (!legacy || legacy.samples<2)) {
     const predictionId=`wm2-${++this.state.predictionSequence}`;
     this.state.pendingPredictions[predictionId]={predictionId,stateKey,action,predictedReward:clamp(baseReward),confidence01:.2,createdAt:Date.now()};
     const memoryAdjustedReward=clamp(baseReward+this.state.memoryEvidence01*.08);
     return {predictionId,reward:memoryAdjustedReward,confidence:.2,uncertainty:clamp(uncertainty+.06),predictedDelta:memoryAdjustedReward-baseReward, predictedState:current, modelReady:false};
   }
   const rewardBias=h ? (h.rewardMean-.5)*.45 : (legacy ? (legacy.meanReward-.5)*.3 : 0);
   const reward=clamp(baseReward+rewardBias);
   const rawConfidence=h ? clamp(.2+Math.min(.7,h.samples/32*.7)*(1-h.rewardVariance)) : clamp(.2+Math.min(.55,(legacy?.samples??0)/24*.55));
   const bucket=Math.max(0,Math.min(9,Math.floor(rawConfidence*10)));
   const calibration=this.state.calibration.find(x=>x.bucket===bucket && x.samples>=3);
   const calibratedConfidence=calibration ? clamp(rawConfidence*.3 + calibration.observedAccuracy01*.7) : rawConfidence;
   const calibrationPenalty=this.calibrationError();
   const confidence=clamp(calibratedConfidence*(1-calibrationPenalty*.18));
   const predictionId=`wm2-${++this.state.predictionSequence}`;
   this.state.pendingPredictions[predictionId]={predictionId,stateKey,action,predictedReward:reward,confidence01:confidence,createdAt:Date.now()};
   const nextFeatures={...(current?.features??{})};
   if(h) for(const [k,d] of Object.entries(h.meanDelta)) nextFeatures[k]=clamp(finite(nextFeatures[k])+d);
   const predictedState=current?{...current,id:hashState(nextFeatures),features:nextFeatures,uncertainty01:clamp(uncertainty*(1-confidence*.45)),observedAt:Date.now(),provenanceIds:[...(current.provenanceIds??[]),'prediction']} : null;
   return {predictionId,reward,confidence,uncertainty:clamp(uncertainty*(1-confidence*.35)),predictedDelta:reward-baseReward,predictedState,modelReady:true};
 }

 observeTransition(transition:WorldTransitionForOrganism, predictionId?:string):{predictionId:string|null;resolved:boolean;accuracy01:number|null} {
   const before=worldToLatent(transition.before); const after=worldToLatent(transition.after);
   this.state.latentState=after;
   this.state.latent={energy:after.features.energy,uncertainty:after.features.uncertainty,novelty:clamp(after.features.visibleObjects+after.features.hiddenObjects),load:clamp(1-after.features.attention)};
   const action=transition.action; const sk=this.stateKey(before); const key=`${sk}|${action}`;
   const existing=this.state.transitionHypotheses[key] ?? {key,stateKey:sk,action,samples:0,meanDelta:{},variance:{},rewardMean:.5,rewardVariance:.25,confidence01:.15,lastUpdatedAt:0};
   existing.samples+=1;
   const delta=deltaBetween(before.features,after.features);
   for(const [k,v] of Object.entries(delta)){
     const old=finite(existing.meanDelta[k]);
     existing.meanDelta[k]=old+(v-old)*Math.min(.25,2/existing.samples);
     existing.variance[k]=clamp(finite(existing.variance[k],.25)*.9+Math.abs(v-old)*.1);
   }
   const reward=clamp(transition.reward);
   existing.rewardMean=clamp(existing.rewardMean+(reward-existing.rewardMean)*Math.min(.25,2/existing.samples));
   existing.rewardVariance=clamp(existing.rewardVariance*.9+Math.abs(reward-existing.rewardMean)*.1);
   existing.confidence01=clamp(.15+Math.min(.8,existing.samples/36*.8)); existing.lastUpdatedAt=Date.now();
   this.state.transitionHypotheses[key]=existing; this.state.learnedTransitions+=1;
   const legacy=this.state.transitions[action]??{samples:0,meanReward:.5,rewardVariance:.25,surpriseMean:.5,confidence:.15,lastAt:0,meanDelta:{},deltaVariance:{}};
   legacy.samples+=1; legacy.meanReward=clamp(legacy.meanReward+(reward-legacy.meanReward)*Math.min(.25,2/legacy.samples));
   legacy.rewardVariance=clamp(legacy.rewardVariance*.9+Math.abs(reward-legacy.meanReward)*.1);
   legacy.surpriseMean=clamp(legacy.surpriseMean+(transition.surprise-legacy.surpriseMean)*Math.min(.2,2/legacy.samples));
   legacy.confidence=clamp(.15+Math.min(.75,legacy.samples/32)); legacy.lastAt=Date.now(); legacy.meanDelta=existing.meanDelta; legacy.deltaVariance=existing.variance;
   this.state.transitions[action]=legacy;
   this.state.predictionErrors=[...this.state.predictionErrors,clamp(transition.surprise)].slice(-512);
   const ticketIds=Object.keys(this.state.pendingPredictions).filter(id=>{
     const t=this.state.pendingPredictions[id]; return t?.action===action && t?.stateKey===sk;
   }).sort((a,b)=>this.state.pendingPredictions[a].createdAt-this.state.pendingPredictions[b].createdAt);
   const exactTicketId=predictionId && this.state.pendingPredictions[predictionId]?predictionId:undefined;
   const ticketId=exactTicketId ?? ticketIds[0];
   const ticket=ticketId?this.state.pendingPredictions[ticketId]:undefined;
   let resolvedAccuracy:number|null=null;
   if(ticket){
     const accuracy=clamp(1-Math.abs(reward-ticket.predictedReward)*2);
     resolvedAccuracy=accuracy;
     this.updateCalibration(ticket.confidence01, accuracy);
     delete this.state.pendingPredictions[ticketId];
   } else {
     // Feedback can arrive without a preceding explicit predict() call. Keep
     // calibration alive in that path as observed confidence vs. surprise-based
     // outcome consistency rather than silently leaving the calibration table empty.
     const fallbackConfidence=clamp(existing.confidence01);
     const observedConsistency=clamp(1-transition.surprise);
     this.updateCalibration(fallbackConfidence, observedConsistency);
   }
   this.inferCause(action, `${transition.after.location}:uncertainty`, transition.surprise < .5);
   this.state.readyForLearning=this.state.learnedTransitions>=4;
   return {predictionId:ticketId??null,resolved:Boolean(ticket),accuracy01:resolvedAccuracy};
 }

 observePassiveTransition(before:WorldContext,after:WorldContext){
   const a=worldToLatent(before); const b=worldToLatent(after);
   const delta=deltaBetween(a.features,b.features);
   const magnitude=clamp(Object.values(delta).reduce((sum,v)=>sum+Math.abs(v),0)/(Object.keys(delta).length*2||1));
   const predicted=this.state.latentState ? clamp(this.state.latentState.uncertainty01*.35 + .25) : .5;
   const error=clamp(Math.abs(magnitude-predicted));
   const sk=this.stateKey(a); const key=`${sk}|__passive__`;
   const existing=this.state.transitionHypotheses[key] ?? {key,stateKey:sk,action:'__passive__',samples:0,meanDelta:{},variance:{},rewardMean:.5,rewardVariance:.25,confidence01:.15,lastUpdatedAt:0};
   existing.samples+=1;
   for(const [k,v] of Object.entries(delta)){
     const old=finite(existing.meanDelta[k]);
     existing.meanDelta[k]=old+(v-old)*Math.min(.25,2/existing.samples);
     existing.variance[k]=clamp(finite(existing.variance[k],.25)*.9+Math.abs(v-old)*.1);
   }
   existing.rewardMean=clamp(existing.rewardMean+(0.5-existing.rewardMean)*Math.min(.1,1/existing.samples));
   existing.confidence01=clamp(.12+Math.min(.78,existing.samples/36*.78)); existing.lastUpdatedAt=Date.now();
   this.state.transitionHypotheses[key]=existing;
   this.state.learnedTransitions+=1;
   this.state.predictionErrors=[...this.state.predictionErrors,error].slice(-512);
   this.state.latentState=b;
   this.state.latent={energy:b.features.energy,uncertainty:b.features.uncertainty,novelty:clamp(b.features.visibleObjects+b.features.hiddenObjects),load:clamp(1-b.features.attention)};
   this.state.readyForLearning=this.state.learnedTransitions>=4;
   return {error01:error,confidence01:existing.confidence01,samples:existing.samples};
 }

 observe(action:string,reward:number,surprise:number){
   this.observeTransition({action,before:{tick:0,location:'home',energy:this.state.latent.energy,attention:1-this.state.latent.load,uncertainty:this.state.latent.uncertainty,facts:[],objects:[],events:[]},after:{tick:1,location:'home',energy:this.state.latent.energy,attention:1-this.state.latent.load,uncertainty:this.state.latent.uncertainty,facts:[],objects:[],events:[]},reward, surprise, at:Date.now()});
 }

 private updateCalibration(predicted:number,accuracy:number){
   const bucket=Math.max(0,Math.min(9,Math.floor(predicted*10)));
   let row=this.state.calibration.find(x=>x.bucket===bucket);
   if(!row){row={bucket,samples:0,predictedConfidence01:predicted,observedAccuracy01:accuracy};this.state.calibration.push(row);}
   row.samples++; row.predictedConfidence01 += (predicted-row.predictedConfidence01)/row.samples; row.observedAccuracy01 += (accuracy-row.observedAccuracy01)/row.samples;
 }

 inferCause(cause:string,effect:string,support:boolean){
   const key=`${cause}->${effect}`; let h=this.state.causal.find(x=>x.id===key);
   if(!h){h={id:key,cause,effect,confidence:.18,samples:0,support:0,contradictions:0,lastUpdatedAt:0};this.state.causal.unshift(h);}
   if(this.state.causal.length>MAX_CAUSAL_HYPOTHESES)this.state.causal=this.state.causal.slice(0,MAX_CAUSAL_HYPOTHESES);
   h.samples++; if(support)h.support++;else h.contradictions++; h.confidence=clamp((h.support+.25)/(h.samples+1)); h.lastUpdatedAt=Date.now();
 }

 rollout(actions:string[],baseReward=.5,context?:WorldContext){
   this.state.rollouts++; let uncertainty=context?.uncertainty??this.state.latentState?.uncertainty01??.5; let reward=baseReward; const path:any[]=[]; let current=this.state.latentState;
   for(const a of actions.slice(0,8)){
     const p=this.predict(a,reward,uncertainty,context);
     reward=p.reward; uncertainty=p.uncertainty; current=p.predictedState??current;
     path.push({action:a,reward,uncertainty,confidence:p.confidence,predictedState:current});
   }
   return {reward,uncertainty,path};
 }

 calibrationError():number{
   const rows=this.state.calibration.filter(x=>x.samples>0); if(!rows.length)return 1;
   const total=rows.reduce((s,x)=>s+x.samples,0); return clamp(rows.reduce((s,x)=>s+Math.abs(x.predictedConfidence01-x.observedAccuracy01)*x.samples,0)/total);
 }

 snapshot(options:{clone?:boolean}={}){return options.clone===false?this.state:structuredClone(this.state);}
}
