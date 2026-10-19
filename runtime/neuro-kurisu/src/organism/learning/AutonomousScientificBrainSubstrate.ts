export type ScientificBrainDomain='perception'|'world-model'|'self-model'|'agency'|'memory'|'resource';
export type ScientificBrainAction='observe'|'verify'|'explore'|'reflect'|'rest';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const signed=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Number.isFinite(x)?x:0);
const sigmoid=(x:number)=>1/(1+Math.exp(-Math.max(-12,Math.min(12,x))));

export interface ScientificBrainInput{
  predictionError01:number;
  uncertainty01:number;
  novelty01:number;
  sensorConflict01:number;
  selfPredictionError01:number;
  agencyUncertainty01:number;
  activeInformationGain01:number;
  resourcePressure01:number;
}

export interface ScientificBrainDecision{
  domain:ScientificBrainDomain;
  action:ScientificBrainAction;
  priority01:number;
  expectedGain01:number;
  predictedDelta01:number;
  estimatedCost01:number;
  uncertainty01:number;
  hidden:number[];
}

export interface ScientificBrainTrial{
  predictedDelta01:number;
  observedDelta01:number;
  absoluteError01:number;
  replicated:boolean;
  evidence01:number;
  accepted:boolean;
  at:number;
}

export interface AutonomousScientificBrainState{
  version:1;
  cycles:number;
  hidden:number[];
  samples:number;
  trials:ScientificBrainTrial[];
  acceptedUpdates:number;
  rejectedUpdates:number;
  researchCycles:number;
  quality:{modelMae01:number;baselineMae01:number;advantage01:number;validated:boolean;holdout01:number};
  lastDecision:ScientificBrainDecision|null;
  weights:{input:number[][];recurrent:number[][];output:number[][];bias:number[]};
}

const DOMAINS:ScientificBrainDomain[]=['perception','world-model','self-model','agency','memory','resource'];
const ACTIONS:ScientificBrainAction[]=['observe','verify','explore','reflect','rest'];
const DEFAULT_WEIGHTS={
  input:Array.from({length:20},(_,i)=>Array.from({length:8},(_,j)=>Math.sin((i+1)*(j+2))*0.045)),
  recurrent:Array.from({length:20},(_,i)=>Array.from({length:20},(_,j)=>i===j?0.42:Math.sin((i+2)*(j+3))*0.018)),
  output:Array.from({length:11},(_,i)=>Array.from({length:20},(_,j)=>Math.sin((i+3)*(j+1))*0.03)),
  bias:Array.from({length:11},(_,i)=>i===0?0.12:0),
};

function vector(i:ScientificBrainInput){
  return [clamp(i.predictionError01),clamp(i.uncertainty01),clamp(i.novelty01),clamp(i.sensorConflict01),clamp(i.selfPredictionError01),clamp(i.agencyUncertainty01),clamp(i.activeInformationGain01),clamp(i.resourcePressure01)];
}
function copyWeights(){return structuredClone(DEFAULT_WEIGHTS);}
function domainBase(i:ScientificBrainInput):Record<ScientificBrainDomain,number>{
  return {
    perception:clamp(i.sensorConflict01*.62+i.uncertainty01*.23+i.activeInformationGain01*.15),
    'world-model':clamp(i.predictionError01*.56+i.novelty01*.22+i.uncertainty01*.22),
    'self-model':clamp(i.selfPredictionError01*.64+i.agencyUncertainty01*.22+i.uncertainty01*.14),
    agency:clamp(i.agencyUncertainty01*.56+i.predictionError01*.24+i.novelty01*.2),
    memory:clamp(i.novelty01*.42+i.predictionError01*.22+i.uncertainty01*.36),
    resource:clamp(i.resourcePressure01*.7+i.uncertainty01*.16+i.predictionError01*.14),
  };
}

export class AutonomousScientificBrainSubstrate{
  private state:AutonomousScientificBrainState={version:1,cycles:0,hidden:Array(20).fill(0),samples:0,trials:[],acceptedUpdates:0,rejectedUpdates:0,researchCycles:0,quality:{modelMae01:1,baselineMae01:1,advantage01:0,validated:false,holdout01:0},lastDecision:null,weights:copyWeights()};
  private history:Array<{predicted:number;observed:number;holdout:boolean}>=[];

  restore(raw?:Partial<AutonomousScientificBrainState>|null){
    const r=raw??{};const d=this.state;
    this.state={...d,...r,version:1,hidden:Array.isArray(r.hidden)&&r.hidden.length===20?r.hidden.map(x=>Math.max(-1,Math.min(1,Number.isFinite(Number(x))?Number(x):0))):Array(20).fill(0),trials:Array.isArray(r.trials)?r.trials.slice(-256):[],quality:{...d.quality,...(r.quality??{})},weights:{...d.weights,...(r.weights??{}),input:Array.isArray(r.weights?.input)?r.weights!.input:copyWeights().input,recurrent:Array.isArray(r.weights?.recurrent)?r.weights!.recurrent:copyWeights().recurrent,output:Array.isArray(r.weights?.output)?r.weights!.output:copyWeights().output,bias:Array.isArray(r.weights?.bias)?r.weights!.bias:copyWeights().bias}};
    this.history=[];
  }
  snapshot(){return structuredClone(this.state);}

  private step(xs:number[],commit=true){
    const next=this.state.hidden.map((_,r)=>tanh(this.state.weights.bias[r]+xs.reduce((s,x,c)=>s+(this.state.weights.input[r][c]??0)*x,0)+this.state.hidden.reduce((s,h,c)=>s+(this.state.weights.recurrent[r][c]??0)*h,0)));
    if(commit)this.state.hidden=next;
    return next;
  }

  private output(hidden:number[]){return this.state.weights.bias.slice(0,11).map((_,k)=>hidden.reduce((s,h,j)=>s+(this.state.weights.output[k][j]??0)*h,0)+(this.state.weights.bias[k]??0));}

  decide(input:ScientificBrainInput):ScientificBrainDecision{
    const x=vector(input);this.state.cycles++;
    const h=this.step(x,true);const y=this.output(h);
    const base=domainBase(input);
    const domainScores=DOMAINS.map((d,k)=>clamp(sigmoid(y[k])*0.62+base[d]*0.38));
    const actionScores=ACTIONS.map((a,k)=>clamp(sigmoid(y[6+k])*0.55+(a==='verify'?input.sensorConflict01*.25:0)+(a==='observe'?input.uncertainty01*.2:0)+(a==='rest'?input.resourcePressure01*.25:0)));
    const domainIndex=domainScores.reduce((best,v,idx)=>v>domainScores[best]?idx:best,0);
    const actionIndex=actionScores.reduce((best,v,idx)=>v>actionScores[best]?idx:best,0);
    const domain=DOMAINS[domainIndex];const action=ACTIONS[actionIndex];
    const expectedGain=clamp(domainScores[domainIndex]*.62+(1-input.resourcePressure01)*.18+input.activeInformationGain01*.2);
    const predictedDelta=clamp(.5+tanh(y[0]*.85)*.25+expectedGain*.16);
    const estimatedCost=clamp(.08+input.resourcePressure01*.36+(action==='explore'?.13:0)+(action==='rest'?.03:0));
    const priority=clamp(domainScores[domainIndex]*.54+expectedGain*.28+(1-estimatedCost)*.18);
    const decision:ScientificBrainDecision={domain,action,priority01:priority,expectedGain01:expectedGain,predictedDelta01:predictedDelta,estimatedCost01:estimatedCost,uncertainty01:clamp(.65-domainScores[domainIndex]*.35+Math.abs(predictedDelta-.5)*.12),hidden:[...h]};
    this.state.lastDecision=decision;
    if(action!=='rest')this.state.researchCycles++;
    return structuredClone(decision);
  }

  learn(trial:{predictedDelta01:number;observedDelta01:number;replicated:boolean;evidence01?:number;at?:number;holdout?:boolean}){
    const predicted=clamp(trial.predictedDelta01),observed=clamp(trial.observedDelta01),err=Math.abs(predicted-observed);
    const evidence=clamp(trial.evidence01??(trial.replicated?.85:.4));
    const isHoldout=Boolean(trial.holdout);
    const accepted=!isHoldout && evidence>=.6 && trial.replicated && err<=.25;
    const row:ScientificBrainTrial={predictedDelta01:predicted,observedDelta01:observed,absoluteError01:err,replicated:Boolean(trial.replicated),evidence01:evidence,accepted,at:Number(trial.at??Date.now())};
    this.state.trials=[row,...this.state.trials].slice(0,256);this.state.samples++;
    if(accepted){
      this.state.acceptedUpdates++;
      const lr=.035*evidence;
      const direction=signed(observed-predicted);
      for(let k=0;k<this.state.weights.output.length;k++) for(let j=0;j<this.state.weights.output[k].length;j++) this.state.weights.output[k][j]+=lr*direction*this.state.hidden[j]/Math.max(1,this.state.hidden.length);
      this.state.weights.bias[0]+=lr*direction;
    }else this.state.rejectedUpdates++;
    this.history.push({predicted,observed,holdout:Boolean(trial.holdout)});
    this.history=this.history.slice(-512);
    const train=this.history.filter(x=>!x.holdout),holdout=this.history.filter(x=>x.holdout);
    const mae=(rows:{predicted:number;observed:number}[])=>rows.length?rows.reduce((s,r)=>s+Math.abs(r.predicted-r.observed),0)/rows.length:1;
    const modelMae=mae(train),baseline= train.length?train.reduce((s,r)=>s+Math.abs(.5-r.observed),0)/train.length:1,holdMae=mae(holdout);
    this.state.quality.modelMae01=modelMae;this.state.quality.baselineMae01=baseline;this.state.quality.advantage01=clamp(baseline-modelMae);this.state.quality.holdout01=clamp(holdout.length?1-holdMae:0);this.state.quality.validated=Boolean(train.length>=48&&holdout.length>=12&&modelMae<baseline*.75&&holdMae<baseline*.8);
    return structuredClone(row);
  }

  diagnostics(){return {cycles:this.state.cycles,samples:this.state.samples,researchCycles:this.state.researchCycles,acceptedUpdates:this.state.acceptedUpdates,rejectedUpdates:this.state.rejectedUpdates,quality:{...this.state.quality},lastDecision:this.state.lastDecision};}
}
