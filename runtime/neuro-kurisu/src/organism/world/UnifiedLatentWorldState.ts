import type { ActionKind, WorldContext } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const DIM=32;
const MAX_PREDICTIONS=64;
const MAX_COUNTERFACTUALS=96;
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const finite=(x:number,fallback=.5)=>Number.isFinite(x)?x:fallback;
const stableHash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');};

export interface UnifiedWorldObservation {
  id:string; tick:number; observedAt:number; context:WorldContext; provenanceIds:string[]; sourceKinds:string[];
}
export interface UnifiedLatentStateFrame {
  id:string; observationId:string; tick:number; observedAt:number; vector:number[];
  uncertainty01:number; coherence01:number; grounding01:number; provenanceIds:string[];
}
export interface UnifiedWorldPredictionTicket {
  id:string; latentId:string; action:ActionKind; predicted01:number; confidence01:number;
  uncertainty01:number; sourceLatentVector:number[]; predictedNextVector:number[]; createdAt:number; horizon:number;
  sourcePredictionId?:string; resolved:boolean; actual01?:number; error01?:number;
}
export interface UnifiedWorldCounterfactualTicket {
  id:string; latentId:string; action:ActionKind; expected01:number; confidence01:number;
  horizon:number; createdAt:number; source:string; resolved:boolean;
}
export interface UnifiedLatentWorldStateSnapshot {
  version:1; revision:number; observations:number; latentUpdates:number;
  predictionRegistrations:number; predictionResolutions:number; counterfactualRegistrations:number;
  meanPredictionError01:number; meanPredictionConfidence01:number; latentUncertainty01:number;
  currentObservation:UnifiedWorldObservation|null; currentLatent:UnifiedLatentStateFrame|null;
  predictions:UnifiedWorldPredictionTicket[]; counterfactuals:UnifiedWorldCounterfactualTicket[];
}

export const defaultUnifiedLatentWorldState=():UnifiedLatentWorldStateSnapshot=>({
  version:1,revision:0,observations:0,latentUpdates:0,predictionRegistrations:0,predictionResolutions:0,
  counterfactualRegistrations:0,meanPredictionError01:.5,meanPredictionConfidence01:.2,latentUncertainty01:.6,
  currentObservation:null,currentLatent:null,predictions:[],counterfactuals:[],
});

export class UnifiedLatentWorldState {
  readonly systemName='world:unified-latent-world-state' as const;
  private state=defaultUnifiedLatentWorldState();
  private sequence=0;

  snapshot(options:{clone?:boolean}={}){ return options.clone===false ? this.state : structuredClone(this.state); }
  restore(raw?:Partial<UnifiedLatentWorldStateSnapshot>|null){
    const d=defaultUnifiedLatentWorldState(),r:any=raw??{};
    this.state={
      ...d,...structuredClone(r),version:1,
      predictions:Array.isArray(r.predictions)?structuredClone(r.predictions).slice(-MAX_PREDICTIONS):[],
      counterfactuals:Array.isArray(r.counterfactuals)?structuredClone(r.counterfactuals).slice(-MAX_COUNTERFACTUALS):[],
      currentObservation:r.currentObservation?structuredClone(r.currentObservation):null,
      currentLatent:r.currentLatent?structuredClone(r.currentLatent):null,
    };
    this.sequence=Math.max(this.sequence,...this.state.predictions.map((x:any)=>Number(String(x.id).split('-').at(-1))||0),...this.state.counterfactuals.map((x:any)=>Number(String(x.id).split('-').at(-1))||0),0);
  }

  observe(input:{tick:number;at:number;context:WorldContext;grounding01?:number;p27Latent?:number[];provenanceIds?:string[]}):UnifiedLatentStateFrame{
    const context=input.context;
    const observationId=`wobs-${input.tick}-${stableHash(this.contextSignature(context))}`;
    const observation:UnifiedWorldObservation={
      id:observationId,tick:input.tick,observedAt:input.at,context:structuredClone(context),
      provenanceIds:[...(input.provenanceIds??[])].filter(Boolean).slice(0,24),sourceKinds:['grounded-context'],
    };
    const base=this.encodeWorldContext(context);
    const p27=(input.p27Latent??[]).slice(0,64).map(v=>clamp((finite(v,0)+1)/2));
    const vector=Array.from({length:DIM},(_,i)=>clamp(
      base[i]!*0.58 + (p27.length?p27[i%p27.length]!:base[i]!)*0.42,
    ));
    const prev=this.state.currentLatent?.vector??Array(DIM).fill(.5);
    const drift=vector.reduce((s,v,i)=>s+Math.abs(v-(prev[i]??.5)),0)/DIM;
    const coherence=clamp(1-drift*1.6);
    const uncertainty=clamp(.55*(context.uncertainty??.5)+.20*(1-(input.grounding01??.5))+.25*(1-coherence));
    const latentId=`wlat-${input.tick}-${stableHash(`${observationId}:${vector.slice(0,8).map(x=>x.toFixed(4)).join(',')}`)}`;
    const latent:UnifiedLatentStateFrame={id:latentId,observationId,tick:input.tick,observedAt:input.at,vector,uncertainty01:uncertainty,coherence01:coherence,grounding01:clamp(input.grounding01??.5),provenanceIds:observation.provenanceIds.slice()};
    this.state.currentObservation=observation;
    this.state.currentLatent=latent;
    this.state.observations++;
    this.state.latentUpdates++;
    this.state.revision++;
    return structuredClone(latent);
  }

  latentVector(){ return this.state.currentLatent?.vector.slice() ?? Array(DIM).fill(.5); }
  currentLatent(){ return this.state.currentLatent?structuredClone(this.state.currentLatent):null; }
  currentObservation(){ return this.state.currentObservation?structuredClone(this.state.currentObservation):null; }
  encodePredictionState(state?:{features?:Record<string,number>|null}|null):number[]{
    const v=new Array(DIM).fill(.5);
    if(!state?.features) return v;
    const keys=Object.keys(state.features).sort();
    for(let i=0;i<keys.length&&i<DIM;i++) v[i]=clamp(finite(Number(state.features[keys[i]!]),.5));
    return v;
  }

  registerPrediction(input:{action:ActionKind;predicted01:number;confidence01:number;uncertainty01:number;predictedNextVector?:number[];horizon?:number;sourcePredictionId?:string}):UnifiedWorldPredictionTicket{
    const latent=this.state.currentLatent;
    const id=`wprd-${this.state.revision}-${++this.sequence}`;
    const current=this.latentVector();
    const next=(input.predictedNextVector?.length?input.predictedNextVector.slice(0,DIM):this.projectAction(current,input.action,input.predicted01,input.uncertainty01));
    const ticket:UnifiedWorldPredictionTicket={id,latentId:latent?.id??'none',action:input.action,predicted01:clamp(input.predicted01),confidence01:clamp(input.confidence01),uncertainty01:clamp(input.uncertainty01),sourceLatentVector:Array.from({length:DIM},(_,i)=>clamp(current[i]??.5)),predictedNextVector:Array.from({length:DIM},(_,i)=>clamp(next[i]??.5)),createdAt:Date.now(),horizon:Math.max(1,Math.min(12,Math.round(input.horizon??1))),sourcePredictionId:input.sourcePredictionId,resolved:false};
    this.state.predictions.push(ticket);
    if(this.state.predictions.length>MAX_PREDICTIONS)this.state.predictions.splice(0,this.state.predictions.length-MAX_PREDICTIONS);
    this.state.predictionRegistrations++;
    this.state.meanPredictionConfidence01=clamp(this.state.meanPredictionConfidence01*.96+ticket.confidence01*.04);
    return {...ticket,sourceLatentVector:ticket.sourceLatentVector.slice(),predictedNextVector:ticket.predictedNextVector.slice()};
  }

  registerCounterfactual(input:{action:ActionKind;expected01:number;confidence01:number;horizon?:number;source:string}):UnifiedWorldCounterfactualTicket{
    const ticket:UnifiedWorldCounterfactualTicket={
      id:`wcf-${this.state.revision}-${++this.sequence}`,latentId:this.state.currentLatent?.id??'none',action:input.action,
      expected01:clamp(input.expected01),confidence01:clamp(input.confidence01),horizon:Math.max(1,Math.min(12,Math.round(input.horizon??1))),createdAt:Date.now(),source:String(input.source).slice(0,80),resolved:false,
    };
    this.state.counterfactuals.push(ticket);
    if(this.state.counterfactuals.length>MAX_COUNTERFACTUALS)this.state.counterfactuals.splice(0,this.state.counterfactuals.length-MAX_COUNTERFACTUALS);
    this.state.counterfactualRegistrations++;
    return {...ticket};
  }

  resolvePrediction(predictionId:string|undefined,actual01:number,actualContext?:WorldContext,p27Latent?:number[]):{resolved:boolean;error01:number|null;predictionId:string|null}{
    if(!predictionId)return {resolved:false,error01:null,predictionId:null};
    const row=this.state.predictions.find(p=>p.id===predictionId && !p.resolved);
    if(!row)return {resolved:false,error01:null,predictionId};
    const actual=clamp(actual01);
    const error=Math.abs(actual-row.predicted01);
    row.resolved=true;row.actual01=actual;row.error01=error;
    this.state.predictionResolutions++;
    this.state.meanPredictionError01=clamp(this.state.meanPredictionError01*.92+error*.08);
    if(actualContext){
      const next=this.encodeWorldContext(actualContext);
      if(p27Latent?.length){for(let i=0;i<DIM;i++)next[i]=clamp(next[i]*.58+clamp((finite(p27Latent[i%(p27Latent.length)]!,0)+1)/2)*.42);}
      row.predictedNextVector.slice(0,DIM).forEach((v,i)=>{
        const d=Math.abs(v-(next[i]??.5));
        this.state.meanPredictionError01=clamp(this.state.meanPredictionError01*.995+d*.005);
      });
    }
    return {resolved:true,error01:error,predictionId};
  }

  diagnostics(){
    return structuredClone({
      revision:this.state.revision,observations:this.state.observations,latentUpdates:this.state.latentUpdates,
      predictionRegistrations:this.state.predictionRegistrations,predictionResolutions:this.state.predictionResolutions,
      counterfactualRegistrations:this.state.counterfactualRegistrations,meanPredictionError01:this.state.meanPredictionError01,
      meanPredictionConfidence01:this.state.meanPredictionConfidence01,latentUncertainty01:this.state.currentLatent?.uncertainty01??this.state.latentUncertainty01,
      currentLatentId:this.state.currentLatent?.id??null,currentObservationId:this.state.currentObservation?.id??null,
      openPredictions:this.state.predictions.filter(x=>!x.resolved).length,
      resolvedPredictions:this.state.predictions.filter(x=>x.resolved).length,
      openCounterfactuals:this.state.counterfactuals.filter(x=>!x.resolved).length,
    });
  }

  private encodeWorldContext(context:WorldContext):number[]{
    const v=new Array(DIM).fill(.5);
    v[0]=clamp(context.energy);v[1]=clamp(context.attention);v[2]=clamp(context.uncertainty);
    v[3]=clamp((context.objects?.length??0)/16);v[4]=clamp((context.objects??[]).filter(o=>o.visible).length/16);v[5]=clamp((context.objects??[]).filter(o=>o.collected).length/16);
    v[6]=clamp((context.events?.length??0)/32);v[7]=clamp((context.facts?.length??0)/96);
    const loc=stableHash(String(context.location??'unknown'));
    const facts=(context.facts??[]).slice(-6).join('|');
    const events=(context.events??[]).slice(-4).join('|');
    const objectSignal=(context.objects??[]).slice(0,8).map(o=>`${o.id}:${o.label}:${o.visible?'1':'0'}:${o.collected?'1':'0'}`).join('|');
    const signatures=[loc,facts,events,objectSignal];
    let cursor=8;
    for(const sig of signatures){let h=parseInt(stableHash(sig),16)>>>0;for(let k=0;k<6&&cursor<DIM;k++){h=Math.imul(h^((k+1)*2654435761),2246822519);v[cursor++]=((h>>>0)/0xffffffff);}}
    return v;
  }
  private contextSignature(context:WorldContext){return `${context.location}|${context.energy.toFixed(3)}|${context.attention.toFixed(3)}|${context.uncertainty.toFixed(3)}|${(context.facts??[]).slice(-12).join('|')}|${(context.events??[]).slice(-8).join('|')}|${(context.objects??[]).slice(0,12).map(o=>`${o.id}:${o.visible?'1':'0'}:${o.collected?'1':'0'}`).join('|')}`;}
  private projectAction(vector:number[],action:ActionKind,reward01:number,uncertainty01:number){
    const out=vector.slice();
    const effects:Record<ActionKind,number>={respond:.01,explore:.045,verify:.035,rest:-.035,reflect:-.012,wait:.006,defer:.012};
    const e=effects[action]??0;
    for(let i=0;i<DIM;i++){const phase=i%7;const actionGain=phase===ACTIONS.indexOf(action)?e:-e*.22;out[i]=clamp(vector[i]!+actionGain+(reward01-.5)*.025-uncertainty01*.008*(phase===2?1:-.2));}
    return out;
  }
}
