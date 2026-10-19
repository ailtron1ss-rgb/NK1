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
  restore(raw:P48State|undefined){
    const base=defaultP48State();
    this.state={...base,...(raw??{}),
      higherOrder:{...base.higherOrder,...(raw?.higherOrder??{})},
      interoception:{...base.interoception,...(raw?.interoception??{})},
      indicators:Array.isArray(raw?.indicators)?raw!.indicators.slice(0,16):[]
    };
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
