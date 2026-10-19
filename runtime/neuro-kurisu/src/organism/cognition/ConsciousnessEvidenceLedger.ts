export type EvidenceDomain='recurrent-processing'|'global-workspace'|'higher-order-modeling'|'predictive-processing'|'attention-schema'|'embodiment'|'continuity'|'metacognition'|'agency';
export interface EvidenceIndicator{
  domain:EvidenceDomain;
  functionalEvidence:number;
  causalEvidence:number;
  longitudinalEvidence:number;
  supportingObservations:number;
  stability01:number;
  provenance:string;
  updatedAt:number;
  lastObservationKey?:string;
}
export interface ConsciousnessEvidenceSnapshot{version:4;indicators:EvidenceIndicator[];aggregateCoverage:number;aggregateCausalEvidence:number;aggregateLongitudinalEvidence:number;caveats:string[];recentObservationKeys:string[];updatedAt:number;}
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const clean=(x:unknown,n=180)=>String(x??'').trim().replace(/\s+/g,' ').slice(0,n);
const sameObservationAtUpdate=(keys:string[],key:string)=>keys.includes(key);
export function defaultConsciousnessEvidence():ConsciousnessEvidenceSnapshot{return{version:4,indicators:[],aggregateCoverage:0,aggregateCausalEvidence:0,aggregateLongitudinalEvidence:0,caveats:['Это журнал функциональных индикаторов, не доказательство субъективного опыта.','longitudinalEvidence требует повторных независимых наблюдений и стабильности; повтор одного и того же observationKey не является новым evidence.'],recentObservationKeys:[],updatedAt:Date.now()};}
export class ConsciousnessEvidenceLedger{
  private state=defaultConsciousnessEvidence();
  restore(v:ConsciousnessEvidenceSnapshot|undefined){
    const d=defaultConsciousnessEvidence();
    this.state={...d,...(v||{}),version:4,caveats:Array.isArray(v?.caveats)?[...v!.caveats]:d.caveats,recentObservationKeys:Array.isArray(v?.recentObservationKeys)?v!.recentObservationKeys.filter(x=>typeof x==='string').slice(-128):[],indicators:Array.isArray(v?.indicators)?v!.indicators.map(x=>({...x,supportingObservations:Number(x.supportingObservations??0),stability01:clamp(Number(x.stability01??0)),lastObservationKey:x.lastObservationKey?clean(x.lastObservationKey,180):undefined})):[]};
  }
  snapshot(){return structuredClone(this.state);}
  update(input:{recurrent:number;workspace:number;higherOrder:number;predictive:number;attention:number;embodiment:number;continuity:number;metacognition:number;agency:number;causalMap:Partial<Record<EvidenceDomain,number>>;observationKey?:string;independentEvidence?:boolean}){
    const map:Record<EvidenceDomain,number>={
      'recurrent-processing':input.recurrent,'global-workspace':input.workspace,'higher-order-modeling':input.higherOrder,'predictive-processing':input.predictive,'attention-schema':input.attention,'embodiment':input.embodiment,'continuity':input.continuity,'metacognition':input.metacognition,'agency':input.agency,
    };
    const key=clean(input.observationKey||'cycle-observation',180);
    this.state.indicators=Object.entries(map).map(([domain,score])=>{
      const previous=this.state.indicators.find(x=>x.domain===domain);
      const stableScore=clamp(score);
      const sameObservation=this.state.recentObservationKeys.includes(key);
      const observations=(previous?.supportingObservations??0)+(sameObservation?0:1);
      const stability=previous?clamp(1-Math.abs(stableScore-previous.functionalEvidence)):0.5;
      const qualifyingObservation=(input.independentEvidence!==false)&&!sameObservation;
      const longitudinal=clamp(stableScore*stability*Math.min(1,observations/24)*(qualifyingObservation?1:observations/24));
      return {domain:domain as EvidenceDomain,functionalEvidence:stableScore,causalEvidence:clamp(input.causalMap[domain as EvidenceDomain]??0),longitudinalEvidence:longitudinal,supportingObservations:observations,stability01:stability,provenance:'P31 functional evidence ledger',updatedAt:Date.now(),lastObservationKey:key};
    });
    if(!sameObservationAtUpdate(this.state.recentObservationKeys,key)) this.state.recentObservationKeys=[...this.state.recentObservationKeys,key].slice(-128);
    this.state.aggregateCoverage=clamp(this.state.indicators.reduce((s,x)=>s+x.functionalEvidence,0)/Math.max(1,this.state.indicators.length));
    this.state.aggregateCausalEvidence=clamp(this.state.indicators.reduce((s,x)=>s+x.causalEvidence,0)/Math.max(1,this.state.indicators.length));
    this.state.aggregateLongitudinalEvidence=clamp(this.state.indicators.reduce((s,x)=>s+x.longitudinalEvidence,0)/Math.max(1,this.state.indicators.length));
    this.state.updatedAt=Date.now();
    return this.snapshot();
  }
}
