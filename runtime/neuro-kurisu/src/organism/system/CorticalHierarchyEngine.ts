/**
 * BIG PASS 211 — cortical hierarchy + distributed predictive routing.
 *
 * This is an implementation-level computational model, not an anatomical
 * equivalence claim. It deliberately combines two useful ideas:
 *   1) hierarchical prediction/error routing;
 *   2) gradient/distributed network coherence instead of brittle area lookup.
 *
 * The engine is also a general-purpose control substrate for the artificial
 * organism: it can reduce compute depth under resource pressure, increase
 * depth when uncertainty/novelty demands it, and expose contradictions before
 * they reach action arbitration.
 */

export type CorticalLayerKind = 'sensorimotor'|'unimodal'|'multimodal'|'control'|'self'|'global';

export interface CorticalHierarchySignal {
  id:string;
  evidence01:number;
  prediction01:number;
  confidence01:number;
  salience01:number;
  novelty01:number;
  abstraction01:number;
}

export interface CorticalHierarchyContext {
  uncertainty01:number;
  predictionError01:number;
  novelty01:number;
  goalPressure01:number;
  bodyEnergy01:number;
  thermal01:number;
  cognitiveCapacity01:number;
  memoryPressure01:number;
  externalInput:boolean;
  tick:number;
  microcircuitEnabled?:boolean;
}

export interface CorticalLayerState {
  id:CorticalLayerKind;
  depth:number;
  activation01:number;
  precision01:number;
  prediction01:number;
  bottomUp01:number;
  topDown01:number;
  error01:number;
  coherence01:number;
  updatedAt:number;
}

export interface CorticalRouteRow {
  id:string;
  hierarchyGain01:number;
  coherence01:number;
  contradiction01:number;
  precision01:number;
  predictionError01:number;
  predictivePosterior01:number;
  calibration01:number;
  selectiveAbstain01:number;
  informationGain01:number;
  depthUsed:number;
  routeMode:'shallow'|'adaptive'|'deep';
}

export interface CorticalMicrocircuitState {
  enabled:boolean;
  excitation01:number;
  pvInhibition01:number;
  somInhibition01:number;
  vipDisinhibition01:number;
  sparsity01:number;
  stability01:number;
  recurrentBrake01:number;
  adaptation01:number;
  cycles:number;
  lastTick:number;
}


export interface CorticalHierarchyFrame {
  version:1;
  tick:number;
  depthUsed:number;
  targetDepth01:number;
  globalCoherence01:number;
  globalContradiction01:number;
  meanPredictionError01:number;
  meanPrecision01:number;
  routeMode:'shallow'|'adaptive'|'deep';
  layers:CorticalLayerState[];
  rows:CorticalRouteRow[];
  microcircuit:CorticalMicrocircuitState;
  createdAt:number;
}

export interface CorticalOutcomeModel {
  meanError01:number;
  bias01:number;
  posterior01:number;
  precision01:number;
  samples:number;
  lastTick:number;
}

export interface CorticalHierarchyState {
  version:1;
  cycles:number;
  deepCycles:number;
  shallowCycles:number;
  predictionErrors:number;
  outcomeUpdates:number;
  meanDepth01:number;
  meanCoherence01:number;
  meanContradiction01:number;
  meanPredictionError01:number;
  predictiveUpdates:number;
  predictiveSkips:number;
  meanCalibration01:number;
  meanSelectiveRisk01:number;
  microcircuit:CorticalMicrocircuitState;
  routeModels:Record<string,CorticalOutcomeModel>;
  layers:Record<CorticalLayerKind,CorticalLayerState>;
  lastFrame:CorticalHierarchyFrame|null;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const signed=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));

const LAYERS:ReadonlyArray<{id:CorticalLayerKind; abstraction01:number; depth:number}>= [
  {id:'sensorimotor',abstraction01:.08,depth:1},
  {id:'unimodal',abstraction01:.26,depth:2},
  {id:'multimodal',abstraction01:.48,depth:3},
  {id:'control',abstraction01:.67,depth:4},
  {id:'self',abstraction01:.83,depth:5},
  {id:'global',abstraction01:1,depth:6},
];

const makeLayer=(id:CorticalLayerKind, depth:number):CorticalLayerState=>({
  id,depth,activation01:.5,precision01:.5,prediction01:.5,bottomUp01:.5,topDown01:.5,error01:.5,coherence01:.5,updatedAt:0,
});

const makeMicrocircuit=():CorticalMicrocircuitState=>({
  enabled:true,
  excitation01:.5,
  pvInhibition01:.5,
  somInhibition01:.5,
  vipDisinhibition01:.5,
  sparsity01:.35,
  stability01:.92,
  recurrentBrake01:.08,
  adaptation01:.1,
  cycles:0,
  lastTick:0,
});

export const defaultCorticalHierarchyState=():CorticalHierarchyState=>({
  version:1,cycles:0,deepCycles:0,shallowCycles:0,predictionErrors:0,outcomeUpdates:0,
  meanDepth01:.5,meanCoherence01:.5,meanContradiction01:.2,meanPredictionError01:.5,
  predictiveUpdates:0,predictiveSkips:0,meanCalibration01:.5,meanSelectiveRisk01:.2,
  microcircuit:makeMicrocircuit(),
  routeModels:{},
  layers:{sensorimotor:makeLayer('sensorimotor',1),unimodal:makeLayer('unimodal',2),multimodal:makeLayer('multimodal',3),control:makeLayer('control',4),self:makeLayer('self',5),global:makeLayer('global',6)},
  lastFrame:null,
});


function sanitizeMicrocircuit(raw:any, fallback:CorticalMicrocircuitState):CorticalMicrocircuitState{
  return {
    enabled:raw?.enabled!==false,
    excitation01:clamp(raw?.excitation01??fallback.excitation01),
    pvInhibition01:clamp(raw?.pvInhibition01??fallback.pvInhibition01),
    somInhibition01:clamp(raw?.somInhibition01??fallback.somInhibition01),
    vipDisinhibition01:clamp(raw?.vipDisinhibition01??fallback.vipDisinhibition01),
    sparsity01:clamp(raw?.sparsity01??fallback.sparsity01),
    stability01:clamp(raw?.stability01??fallback.stability01),
    recurrentBrake01:clamp(raw?.recurrentBrake01??fallback.recurrentBrake01),
    adaptation01:clamp(raw?.adaptation01??fallback.adaptation01),
    cycles:Math.max(0,Math.floor(raw?.cycles??fallback.cycles)),
    lastTick:Math.max(0,Math.floor(raw?.lastTick??fallback.lastTick)),
  };
}

function externalInputBoost(external:boolean):number{return external?.08:0;}

function sparseCompetition(values:number[], targetActive:number):number[]{
  const n=values.length;
  if(!n) return [];
  const ranked=values.map((v,i)=>({i,v:clamp(v)})).sort((a,b)=>b.v-a.v);
  const active=Math.max(1,Math.min(n,targetActive));
  const threshold=ranked[active-1]?.v??0;
  return values.map(v=>{
    const margin=v-threshold;
    const keep=v>=threshold;
    return clamp(keep ? .72 + margin*.8 : .18 + Math.max(0,margin)*.25);
  });
}

function sanitizeLayer(raw:any, fallback:CorticalLayerState):CorticalLayerState{
  return {
    id:fallback.id,depth:fallback.depth,
    activation01:clamp(raw?.activation01??fallback.activation01),
    precision01:clamp(raw?.precision01??fallback.precision01),
    prediction01:clamp(raw?.prediction01??fallback.prediction01),
    bottomUp01:clamp(raw?.bottomUp01??fallback.bottomUp01),
    topDown01:clamp(raw?.topDown01??fallback.topDown01),
    error01:clamp(raw?.error01??fallback.error01),
    coherence01:clamp(raw?.coherence01??fallback.coherence01),
    updatedAt:Math.max(0,Math.floor(raw?.updatedAt??fallback.updatedAt)),
  };
}

function sanitizeOutcomeModel(raw:any):CorticalOutcomeModel{
  const meanError01=clamp(raw?.meanError01??.5);
  return {
    meanError01,
    bias01:signed(raw?.bias01??0),
    posterior01:clamp(raw?.posterior01??clamp(.5+(raw?.bias01??0)*.35)),
    precision01:clamp(raw?.precision01??(1-meanError01)),
    samples:Math.max(0,Math.floor(raw?.samples??0)),
    lastTick:Math.max(0,Math.floor(raw?.lastTick??0)),
  };
}

export class CorticalHierarchyEngine {
  private state=CorticalHierarchyEngine.defaultState();

  static defaultState(){ return defaultCorticalHierarchyState(); }

  restore(raw?:Partial<CorticalHierarchyState>|null){
    const d=defaultCorticalHierarchyState(), r=raw??{};
    const models=Object.fromEntries(Object.entries(r.routeModels??{}).map(([k,v]:any)=>[k,sanitizeOutcomeModel(v)]));
    const layers={...d.layers} as Record<CorticalLayerKind,CorticalLayerState>;
    for(const item of LAYERS) layers[item.id]=sanitizeLayer((r.layers as any)?.[item.id],layers[item.id]);
    this.state={...d,...r,version:1,routeModels:models,layers,microcircuit:sanitizeMicrocircuit((r as any).microcircuit,d.microcircuit),lastFrame:r.lastFrame?structuredClone(r.lastFrame):null};
  }

  snapshot(){ return structuredClone(this.state); }

  route(signals:CorticalHierarchySignal[], context:CorticalHierarchyContext):CorticalHierarchyFrame{
    const uncertainty=clamp(context.uncertainty01), pe=clamp(context.predictionError01), novelty=clamp(context.novelty01);
    const microEnabled=context.microcircuitEnabled!==false;
    const goal=clamp(context.goalPressure01), energy=clamp(context.bodyEnergy01), thermal=clamp(context.thermal01);
    const capacity=clamp(context.cognitiveCapacity01), memoryPressure=clamp(context.memoryPressure01);

    // Depth is a demand/resource decision: spend more hierarchy only when the
    // information gain is likely to repay the cost.
    const demand=clamp(.16 + uncertainty*.26 + pe*.22 + novelty*.12 + goal*.14 + (context.externalInput?.08:0));
    const resource=clamp(energy*.34 + capacity*.40 + (1-thermal)*.18 + (1-memoryPressure)*.08);
    const targetDepth01=clamp(.22 + demand*.58 + resource*.20 - thermal*.16 - (1-energy)*.12);
    const depthUsed=Math.max(1,Math.min(6,Math.round(1+targetDepth01*5)));
    const routeMode=depthUsed>=5?'deep':depthUsed<=2?'shallow':'adaptive';

    const layerResults: CorticalLayerState[]=[];
    let globalErrorAcc=0, globalPrecisionAcc=0;
    const sortedSignals=(signals??[]).slice(0,32);
    const aggregate=(layer:CorticalLayerKind, abstraction01:number)=>{
      const relevant=sortedSignals.length?sortedSignals.map(s=>{
        const abstractionDistance=Math.abs(clamp(s.abstraction01)-abstraction01);
        const locality=clamp(1-abstractionDistance*2.4);
        const weight=.45 + locality*.55;
        return {
          up:clamp(s.evidence01*.72 + s.confidence01*.18 + s.salience01*.10),
          pred:clamp(s.prediction01*.62 + s.evidence01*.18 + locality*.20),
          weight,
        };
      }):[{up:.5,pred:.5,weight:1}];
      const totalWeight=relevant.reduce((sum,x)=>sum+x.weight,0)||1;
      return {
        up:clamp(relevant.reduce((sum,x)=>sum+x.up*x.weight,0)/totalWeight),
        pred:clamp(relevant.reduce((sum,x)=>sum+x.pred*x.weight,0)/totalWeight),
      };
    };

    for(const item of LAYERS){
      const prior=this.state.layers[item.id];
      const agg=aggregate(item.id,item.abstraction01);
      const previous=layerResults[layerResults.length-1];
      const forward=previous?.activation01??agg.up;
      const recurrentPrediction=prior.prediction01;
      const bottomUp=clamp(agg.up*.58 + forward*.42);
      const topDown=clamp(recurrentPrediction*.55 + agg.pred*.45);
      const error=clamp(Math.abs(bottomUp-topDown));
      const precision=clamp((1-error)*(.55+capacity*.25+energy*.20)*(1-thermal*.18));
      const activation=clamp((bottomUp*(.56+precision*.18)+topDown*(.44-precision*.08)));
      const coherence=clamp(1-Math.abs(activation-(previous?.activation01??activation))*.72-error*.42);
      const updated:CorticalLayerState={id:item.id,depth:item.depth,activation01:activation,precision01:precision,prediction01:topDown,bottomUp01:bottomUp,topDown01:topDown,error01:error,coherence01:coherence,updatedAt:context.tick};
      layerResults.push(updated);
      globalErrorAcc+=error;
      globalPrecisionAcc+=precision;
      this.state.layers[item.id]=updated;
    }

    const last=layerResults[Math.max(0,depthUsed-1)];
    const selectedLayers=layerResults.slice(0,depthUsed);
    const globalCoherence=selectedLayers.reduce((sum,l)=>sum+l.coherence01,0)/selectedLayers.length;
    const globalError=selectedLayers.reduce((sum,l)=>sum+l.error01,0)/selectedLayers.length;
    const meanPrecision=selectedLayers.reduce((sum,l)=>sum+l.precision01,0)/selectedLayers.length;
    const globalContradiction=clamp(globalError*(.56 + uncertainty*.22 + (1-meanPrecision)*.22));

    const rawDrive=sortedSignals.map(s=>clamp(s.evidence01*.52+s.confidence01*.18+s.salience01*.18+s.novelty01*.12));
    const targetActive=Math.max(1,Math.min(sortedSignals.length||1,Math.ceil((sortedSignals.length||1)*clamp(.18+capacity*.16+novelty*.18+(1-uncertainty)*.08))));
    const sparseFactors=sparseCompetition(rawDrive,targetActive);
    const excitation=clamp(rawDrive.reduce((a,b)=>a+b,0)/Math.max(1,rawDrive.length));
    const pvInhibition=clamp((.28+excitation*.48+globalContradiction*.18)*(microEnabled?1:0));
    const somInhibition=clamp((.22+Math.abs(.5-meanPrecision)*.46+(1-novelty)*.12)*(microEnabled?1:0));
    const vipDisinhibition=clamp((.18+novelty*.42+goal*.22+externalInputBoost(context.externalInput))*(microEnabled?1:0));
    const recurrentDrift=clamp(Math.abs((last?.activation01??.5)-(this.state.layers.global.activation01??.5)));
    const stability=clamp(1-recurrentDrift*.52-globalContradiction*.24-pvInhibition*.08);
    const recurrentBrake=clamp(((1-stability)*.9+globalContradiction*.12)*(microEnabled?1:0));
    const adaptation=clamp(this.state.microcircuit.adaptation01*.92+(globalContradiction*.22+novelty*.12)*.08);
    const microcircuit:CorticalMicrocircuitState={
      enabled:microEnabled,
      excitation01:clamp(this.state.microcircuit.excitation01*.92+excitation*.08),
      pvInhibition01:clamp(this.state.microcircuit.pvInhibition01*.92+pvInhibition*.08),
      somInhibition01:clamp(this.state.microcircuit.somInhibition01*.92+somInhibition*.08),
      vipDisinhibition01:clamp(this.state.microcircuit.vipDisinhibition01*.92+vipDisinhibition*.08),
      sparsity01:clamp(this.state.microcircuit.sparsity01*.92+(1-targetActive/Math.max(1,sortedSignals.length||1))*.08),
      stability01:clamp(this.state.microcircuit.stability01*.92+stability*.08),
      recurrentBrake01:clamp(this.state.microcircuit.recurrentBrake01*.92+recurrentBrake*.08),
      adaptation01:adaptation,
      cycles:this.state.microcircuit.cycles+1,
      lastTick:Math.max(0,Math.floor(context.tick)),
    };
    const rankedForGain=sparseFactors;

    const rows:CorticalRouteRow[]=sortedSignals.map((signal,index)=>{
      const model=this.state.routeModels[signal.id]??sanitizeOutcomeModel(null);
      const levelFit=clamp(1-Math.abs(signal.abstraction01-(last?.activation01??.5))*.66);
      // Predictive posterior: combine the incoming prior with the learned route
      // posterior. The blend is deliberately bounded so online learning cannot hijack
      // the organism after one noisy outcome.
      const learnedWeight=clamp(Math.min(.68,model.samples/16*.68)*(.55+.45*model.precision01));
      const posterior=clamp(signal.prediction01*(1-learnedWeight)+model.posterior01*learnedWeight);
      const localError=clamp(Math.abs(signal.evidence01-(posterior*(.62+levelFit*.18)+signal.evidence01*(1-(.62+levelFit*.18)))));
      const modelPrecision=clamp(.35 + model.precision01*.55 + Math.min(1,model.samples/12)*.10);
      const calibration=clamp(1-Math.abs(localError-model.meanError01));
      const coherence=clamp(globalCoherence*.62 + levelFit*.22 + calibration*.10 + (1-localError)*.06);
      const contradiction=clamp(globalContradiction*.48 + localError*.42 + (1-modelPrecision)*.10);
      const precision=clamp(signal.confidence01*(.54+meanPrecision*.22+modelPrecision*.24));
      const selectiveAbstain=clamp(contradiction*.42+(1-precision)*.26+localError*.20+(1-modelPrecision)*.12);
      const informationGain=clamp(localError*signal.novelty01*(.55+(1-signal.confidence01)*.45));
      const inhibition=clamp(pvInhibition*.58+somInhibition*.28-vipDisinhibition*.22);
      const microGain=microEnabled?clamp(.88 + rankedForGain[index]*.09 + vipDisinhibition*.04 - inhibition*.08 - recurrentBrake*.10):1;
      // The predictive controller can improve/abstain, but cannot overpower
      // downstream arbitration or force a low-confidence action.
      const gain=clamp((.82 + coherence*.18 + precision*.04 - contradiction*.25 - selectiveAbstain*.10 + (posterior-.5)*.025)*microGain);
      return {id:signal.id,hierarchyGain01:gain,coherence01:coherence,contradiction01:contradiction,precision01:precision,predictionError01:localError,predictivePosterior01:posterior,calibration01:calibration,selectiveAbstain01:selectiveAbstain,informationGain01:informationGain,depthUsed,routeMode,microcircuitGain01:microGain,inhibition01:inhibition,sparsity01:rankedForGain[index],stability01:stability};
    });

    this.state.cycles++;
    if(depthUsed>=5)this.state.deepCycles++;
    if(depthUsed<=2)this.state.shallowCycles++;
    this.state.predictionErrors += Math.round(sortedSignals.length*globalError);
    this.state.meanDepth01=clamp(this.state.meanDepth01*.95+(depthUsed/6)*.05);
    this.state.meanCoherence01=clamp(this.state.meanCoherence01*.95+globalCoherence*.05);
    this.state.meanContradiction01=clamp(this.state.meanContradiction01*.95+globalContradiction*.05);
    this.state.meanPredictionError01=clamp(this.state.meanPredictionError01*.95+globalError*.05);
    const frameCalibration=rows.length?rows.reduce((sum,row)=>sum+row.calibration01,0)/rows.length:.5;
    const frameRisk=rows.length?rows.reduce((sum,row)=>sum+row.selectiveAbstain01,0)/rows.length:.2;
    this.state.meanCalibration01=clamp(this.state.meanCalibration01*.95+frameCalibration*.05);
    this.state.meanSelectiveRisk01=clamp(this.state.meanSelectiveRisk01*.95+frameRisk*.05);
    this.state.microcircuit=microcircuit;

    const frame:CorticalHierarchyFrame={version:1,tick:Math.max(0,Math.floor(context.tick)),depthUsed,targetDepth01,globalCoherence01:globalCoherence,globalContradiction01:globalContradiction,meanPredictionError01:globalError,meanPrecision01:meanPrecision,routeMode,layers:layerResults.slice(0,depthUsed),rows,microcircuit,createdAt:Date.now()};
    this.state.lastFrame=structuredClone(frame);
    return structuredClone(frame);
  }

  recordOutcome(id:string,predicted01:number,actual01:number,surprise01:number,tick:number){
    const key=String(id), predicted=clamp(predicted01), actual=clamp(actual01), surprise=clamp(surprise01);
    const targetError=Math.abs(actual-predicted);
    const old=this.state.routeModels[key]??sanitizeOutcomeModel(null);
    this.state.outcomeUpdates++;
    // Event-triggered learning saves mobile compute: tiny, unsurprising errors do
    // not justify mutating route parameters. This is a safety/efficiency policy,
    // not a biological claim.
    if(targetError<.06 && surprise<.12){
      this.state.predictiveSkips++;
      return {id:key,targetError01:targetError,meanError01:old.meanError01,bias01:old.bias01,posterior01:old.posterior01,precision01:old.precision01,samples:old.samples,updated:false,skipped:true};
    }
    const lr=.035+.10*surprise+.08*targetError;
    const signedError=signed(actual-predicted);
    const precisionTarget=clamp(1-targetError);
    const next={
      meanError01:clamp(old.meanError01*(1-lr)+targetError*lr),
      bias01:signed(old.bias01*(1-lr*.72)+signedError*(lr*.72)),
      posterior01:clamp(old.posterior01*(1-lr)+actual*lr),
      precision01:clamp(old.precision01*(1-lr*.8)+precisionTarget*(lr*.8)),
      samples:old.samples+1,
      lastTick:Math.max(0,Math.floor(tick)),
    };
    this.state.routeModels[key]=next;
    this.state.predictiveUpdates++;
    return {id:key,targetError01:targetError,meanError01:next.meanError01,bias01:next.bias01,posterior01:next.posterior01,precision01:next.precision01,samples:next.samples,updated:true,skipped:false};
  }

  diagnostics(){
    return structuredClone({
      cycles:this.state.cycles,deepCycles:this.state.deepCycles,shallowCycles:this.state.shallowCycles,outcomeUpdates:this.state.outcomeUpdates,
      meanDepth01:this.state.meanDepth01,meanCoherence01:this.state.meanCoherence01,meanContradiction01:this.state.meanContradiction01,meanPredictionError01:this.state.meanPredictionError01,
      predictiveUpdates:this.state.predictiveUpdates,predictiveSkips:this.state.predictiveSkips,meanCalibration01:this.state.meanCalibration01,meanSelectiveRisk01:this.state.meanSelectiveRisk01,
      routeCount:Object.keys(this.state.routeModels).length,lastDepth:this.state.lastFrame?.depthUsed??0,lastMode:this.state.lastFrame?.routeMode??null,
      microcircuit:structuredClone(this.state.microcircuit),
    });
  }
}
