/**
 * P48 Functional Awareness Core.
 *
 * This is an engineering/measurement layer, not a claim of phenomenal
 * consciousness. It combines an explicit broadcast workspace, higher-order
 * self-monitoring, and interoceptive homeostasis into one measurable step.
 * All scores remain proxies and keep causal evidence separate from functional
 * evidence so that benchmark inflation is harder.
 */
export type P48IndicatorDomain =
  | 'global-workspace'
  | 'higher-order-modeling'
  | 'interoception'
  | 'predictive-processing'
  | 'recurrent-processing'
  | 'attention'
  | 'embodiment'
  | 'continuity'
  | 'agency'
  | 'causal-integration';

export interface P48WorkspaceItem { id:string; source:string; salience:number; content:Record<string,unknown>; }
export interface P48State {
  version:1;
  cycles:number;
  ignitionCount:number;
  broadcastCount:number;
  ignitionRate01:number;
  workspaceCapacity:number;
  meanWorkspaceOccupancy01:number;
  recurrence01:number;
  lastIgnitionStrength01:number;
  lastBroadcastAt:number;
  lastWinnerId:string|null;
  higherOrder:{
    selfRepresentation01:number;
    metacognitiveCalibration01:number;
    confidenceOfConfidence01:number;
    revisionReadiness01:number;
    monitoringLag01:number;
  };
  interoception:{
    bodyEnergy01:number;
    thermalStrain01:number;
    cognitiveCapacity01:number;
    sensoryFreshness01:number;
    sleepPressure01:number;
    homeostaticError01:number;
    freeEnergyProxy01:number;
    regulationNeed01:number;
  };
  indicators:Array<{
    domain:P48IndicatorDomain;
    functionalEvidence01:number;
    causalEvidence01:number;
    longitudinalEvidence01:number;
    observations:number;
    stability01:number;
    updatedAt:number;
  }>;
  lastAt:number;
}

const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
const strOrNull=(v:unknown,n=160):string|null=>typeof v==='string'&&v?v.slice(0,n):null;
const DOMAINS:P48IndicatorDomain[]=['global-workspace','higher-order-modeling','interoception','predictive-processing','recurrent-processing','attention','embodiment','continuity','agency','causal-integration'];
const ema=(prev:number,next:number,a:number)=>clamp(prev*(1-a)+next*a);
const dist=(a:number,b:number)=>Math.abs(clamp(a)-clamp(b));

export function defaultP48State():P48State{return{
  version:1,cycles:0,ignitionCount:0,broadcastCount:0,ignitionRate01:0,workspaceCapacity:5,
  meanWorkspaceOccupancy01:0,recurrence01:0,lastIgnitionStrength01:0,lastBroadcastAt:0,lastWinnerId:null,
  higherOrder:{selfRepresentation01:.5,metacognitiveCalibration01:.5,confidenceOfConfidence01:.5,revisionReadiness01:.5,monitoringLag01:.5},
  interoception:{bodyEnergy01:.82,thermalStrain01:.2,cognitiveCapacity01:.82,sensoryFreshness01:.75,sleepPressure01:.15,homeostaticError01:.2,freeEnergyProxy01:.2,regulationNeed01:.2},
  indicators:[],lastAt:0,
};}

export class P48FunctionalAwarenessCore {
  private state=defaultP48State();
  restore(raw:unknown){
    const base=defaultP48State();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    const ho=(read('higherOrder')&&typeof read('higherOrder')==='object')?read('higherOrder') as Record<string,unknown>:{};
    const ic=(read('interoception')&&typeof read('interoception')==='object')?read('interoception') as Record<string,unknown>:{};
    const indRaw=read('indicators');
    this.state={version:1,cycles:cnt(read('cycles'),base.cycles),ignitionCount:cnt(read('ignitionCount'),base.ignitionCount),broadcastCount:cnt(read('broadcastCount'),base.broadcastCount),ignitionRate01:clamp(finN(read('ignitionRate01'),base.ignitionRate01)),workspaceCapacity:Math.max(1,Math.min(16,Math.floor(finN(read('workspaceCapacity'),base.workspaceCapacity)))),meanWorkspaceOccupancy01:clamp(finN(read('meanWorkspaceOccupancy01'),base.meanWorkspaceOccupancy01)),recurrence01:clamp(finN(read('recurrence01'),base.recurrence01)),lastIgnitionStrength01:clamp(finN(read('lastIgnitionStrength01'),base.lastIgnitionStrength01)),lastBroadcastAt:finN(read('lastBroadcastAt'),base.lastBroadcastAt),lastWinnerId:strOrNull(read('lastWinnerId')),
      higherOrder:{selfRepresentation01:clamp(finN(ho.selfRepresentation01,base.higherOrder.selfRepresentation01)),metacognitiveCalibration01:clamp(finN(ho.metacognitiveCalibration01,base.higherOrder.metacognitiveCalibration01)),confidenceOfConfidence01:clamp(finN(ho.confidenceOfConfidence01,base.higherOrder.confidenceOfConfidence01)),revisionReadiness01:clamp(finN(ho.revisionReadiness01,base.higherOrder.revisionReadiness01)),monitoringLag01:clamp(finN(ho.monitoringLag01,base.higherOrder.monitoringLag01))},
      interoception:{bodyEnergy01:clamp(finN(ic.bodyEnergy01,base.interoception.bodyEnergy01)),thermalStrain01:clamp(finN(ic.thermalStrain01,base.interoception.thermalStrain01)),cognitiveCapacity01:clamp(finN(ic.cognitiveCapacity01,base.interoception.cognitiveCapacity01)),sensoryFreshness01:clamp(finN(ic.sensoryFreshness01,base.interoception.sensoryFreshness01)),sleepPressure01:clamp(finN(ic.sleepPressure01,base.interoception.sleepPressure01)),homeostaticError01:clamp(finN(ic.homeostaticError01,base.interoception.homeostaticError01)),freeEnergyProxy01:clamp(finN(ic.freeEnergyProxy01,base.interoception.freeEnergyProxy01)),regulationNeed01:clamp(finN(ic.regulationNeed01,base.interoception.regulationNeed01))},
      indicators:Array.isArray(indRaw)?(indRaw as unknown[]).slice(0,16).filter(v=>v&&typeof v==='object').map(v=>{const r=v as Record<string,unknown>;return {domain:DOMAINS.includes(r.domain as P48IndicatorDomain)?r.domain as P48IndicatorDomain:'global-workspace',functionalEvidence01:clamp(finN(r.functionalEvidence01,0)),causalEvidence01:clamp(finN(r.causalEvidence01,0)),longitudinalEvidence01:clamp(finN(r.longitudinalEvidence01,0)),observations:cnt(r.observations,0),stability01:clamp(finN(r.stability01,0)),updatedAt:finN(r.updatedAt,0)};}):[],
      lastAt:finN(read('lastAt'),base.lastAt)};
  }
  snapshot(){return structuredClone(this.state);}

  step(input:{
    now:number;
    attention01:number;
    predictionError01:number;
    identityContinuity01:number;
    metacognitiveAccuracy01:number;
    confidence01:number;
    revisionReadiness01:number;
    agency01:number;
    recurring01:number;
    workspaceItems:P48WorkspaceItem[];
    body?:{energy01:number;thermal01:number;capacity01:number;sensoryFreshness01:number;awake:boolean;};
    sleepPressure01?:number;
  }):P48State{
    const now=Number(input.now)||Date.now();
    const body=input.body;
    const intero=body?{
      bodyEnergy01:clamp(body.energy01),
      thermalStrain01:clamp(body.thermal01),
      cognitiveCapacity01:clamp(body.capacity01),
      sensoryFreshness01:clamp(body.sensoryFreshness01),
      sleepPressure01:clamp(input.sleepPressure01 ?? (body.awake?.15:.85)),
      homeostaticError01:clamp(
        dist(body.energy01,.68)*.30 +
        dist(body.thermal01,.24)*.22 +
        dist(body.capacity01,.70)*.20 +
        dist(body.sensoryFreshness01,.68)*.14 +
        dist(input.sleepPressure01 ?? (body.awake?.15:.85), body.awake ? .15 : .85)*.14
      ),
      freeEnergyProxy01:0,
      regulationNeed01:0,
    } : this.state.interoception;
    intero.freeEnergyProxy01=clamp(intero.homeostaticError01 + clamp(input.predictionError01)*.32 + (1-clamp(input.attention01))*.14);
    intero.regulationNeed01=clamp(intero.homeostaticError01*.62 + intero.freeEnergyProxy01*.38);
    this.state.interoception=intero;

    const items=[...input.workspaceItems].filter(Boolean).sort((a,b)=>clamp(b.salience)-clamp(a.salience)).slice(0,this.state.workspaceCapacity);
    const occupancy=items.length/Math.max(1,this.state.workspaceCapacity);
    const top=items[0];
    const mean=items.reduce((s,x)=>s+clamp(x.salience),0)/Math.max(1,items.length);
    const ignitionThreshold=clamp(0.48 + (1-clamp(input.attention01))*.18 + intero.regulationNeed01*.08);
    const ignition=Boolean(top) && clamp(top.salience)>=ignitionThreshold && occupancy>=.2;
    this.state.cycles+=1;
    this.state.meanWorkspaceOccupancy01=ema(this.state.meanWorkspaceOccupancy01,occupancy,.12);
    this.state.ignitionRate01=ema(this.state.ignitionRate01,ignition?1:0,.08);
    this.state.recurrence01=ema(this.state.recurrence01,clamp(input.recurring01),.16);
    this.state.lastIgnitionStrength01=ignition?clamp((top!.salience-ignitionThreshold)/Math.max(.05,1-ignitionThreshold)):.0;
    if(ignition){
      this.state.ignitionCount+=1;
      this.state.broadcastCount+=1;
      this.state.lastBroadcastAt=now;
      this.state.lastWinnerId=top?.id??null;
    }

    const predictedAccuracy=clamp(1-clamp(input.predictionError01));
    const metaCal=clamp(input.metacognitiveAccuracy01);
    const confidence=clamp(input.confidence01);
    const selfRep=clamp(
      clamp(input.identityContinuity01)*.38 +
      predictedAccuracy*.22 +
      metaCal*.22 +
      clamp(input.agency01)*.18
    );
    const monitoringLag=clamp(Math.abs(metaCal-predictedAccuracy));
    this.state.higherOrder={
      selfRepresentation01:selfRep,
      metacognitiveCalibration01:clamp(1-monitoringLag),
      confidenceOfConfidence01:clamp(confidence*.6+(1-monitoringLag)*.4),
      revisionReadiness01:clamp(input.revisionReadiness01),
      monitoringLag01:monitoringLag,
    };

    const values:Record<P48IndicatorDomain,number>={
      'global-workspace':clamp(this.state.ignitionRate01*.55+this.state.meanWorkspaceOccupancy01*.2+this.state.lastIgnitionStrength01*.25),
      'higher-order-modeling':selfRep,
      'interoception':clamp(1-intero.freeEnergyProxy01),
      'predictive-processing':predictedAccuracy,
      'recurrent-processing':clamp(this.state.recurrence01),
      'attention':clamp(input.attention01),
      'embodiment':clamp((intero.bodyEnergy01*.28+(1-intero.thermalStrain01)*.18+intero.cognitiveCapacity01*.24+intero.sensoryFreshness01*.18+(1-intero.sleepPressure01)*.12)),
      'continuity':clamp(input.identityContinuity01),
      'agency':clamp(input.agency01),
      // Intentionally not inferred from the other proxies. This slot is reserved
      // for future perturbational/causal experiments.
      'causal-integration':0,
    };
    this.state.indicators=Object.entries(values).map(([domain,value])=>{
      const prev=this.state.indicators.find(x=>x.domain===domain);
      const stability=prev?clamp(1-Math.abs(value-prev.functionalEvidence01)):.5;
      const observations=(prev?.observations??0)+1;
      return {domain:domain as P48IndicatorDomain,functionalEvidence01:clamp(value),causalEvidence01:domain==='causal-integration'?0:0,longitudinalEvidence01:clamp(value*stability*Math.min(1,observations/36)),observations,stability01:stability,updatedAt:now};
    });
    this.state.lastAt=now;
    return this.snapshot();
  }

  /** Return a measurement-only lesion estimate; this does not claim a causal experiment. */
  lesionProjection(kind:'workspace'|'self-model'|'interoception'){
    const s=this.state;
    if(kind==='workspace') return {accessLoss01:clamp(1-s.indicators.find(x=>x.domain==='global-workspace')!.functionalEvidence01), metacognitiveChange01:0};
    if(kind==='self-model') return {accessLoss01:0,metacognitiveChange01:clamp(1-s.higherOrder.metacognitiveCalibration01)};
    return {accessLoss01:clamp(s.interoception.freeEnergyProxy01*.65),metacognitiveChange01:clamp(s.interoception.regulationNeed01*.45)};
  }
}
