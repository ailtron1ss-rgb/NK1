import type { ActionKind, OrganismState } from '../core/types.ts';
import { actionCost } from '../core/ActionCostPolicy.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Number.isFinite(x)?x:0);
const now=()=>Date.now();
const isAction=(value:unknown):value is ActionKind=>typeof value==='string'&&ACTIONS.includes(value as ActionKind);
function assertTrainingInput(input:{action:unknown;target01:number;learningRate01:number;sampleWeight01?:number}){
  if(!isAction(input.action)) throw new TypeError('policy-learning-invalid-action');
  if(!Number.isFinite(input.target01)) throw new TypeError('policy-learning-target-must-be-finite');
  if(!Number.isFinite(input.learningRate01)) throw new TypeError('policy-learning-rate-must-be-finite');
  if(input.sampleWeight01!==undefined&&!Number.isFinite(input.sampleWeight01)) throw new TypeError('policy-learning-sample-weight-must-be-finite');
}


/**
 * P26 learned function approximator.
 *
 * Unlike the P23 bucket table, this model learns a continuous mapping
 * from normalized state features to action values. It is intentionally
 * dependency-free and small enough for phone runtime. Training is SGD
 * on a TD target, so experience can generalize to previously unseen
 * bucket combinations rather than memorizing exact context keys.
 */
export interface ParametricPolicyState {
  version:1;
  featureNames:string[];
  weights:Record<ActionKind,number[]>;
  bias:Record<ActionKind,number>;
  updates:number;
  tdAbsMean01:number;
  trainRewardMean01:number;
  explorationRate01:number;
  lastLoss01:number;
  lastTrainedAt:number;
  frozen:boolean;
}

export interface ParametricPrediction { action:ActionKind; value:number; uncertainty01:number; }

const featureNames=[
  'energy','cognitiveLoad','uncertainty','novelty','goalPressure','socialNeed',
  'predictionError','attentionBudget','identityCoherence','externalInput','bodyCapacity','thermalPressure',
  'boredom','resourceRisk','actionCost'
];

export function defaultParametricPolicy():ParametricPolicyState{
  const weights={} as Record<ActionKind,number[]>;
  const bias={} as Record<ActionKind,number>;
  for(const a of ACTIONS){
    weights[a]=new Array(featureNames.length).fill(0);
    weights[a].fill(0);
    bias[a]=0;
  }
  return {version:1,featureNames:[...featureNames],weights,bias,updates:0,tdAbsMean01:0,trainRewardMean01:.5,explorationRate01:.16,lastLoss01:0,lastTrainedAt:0,frozen:false};
}


function featureVector(state:OrganismState, extras?:{external01?:number;boredom01?:number;resourceRisk01?:number;thermalPressure01?:number;bodyCapacity01?:number}):number[]{
  const n=state.needs;
  return [
    clamp(n.energy),
    clamp(n.cognitiveLoad),
    clamp(n.uncertainty),
    clamp(n.novelty),
    clamp(n.goalPressure),
    clamp(n.socialNeed),
    clamp(state.predictionError),
    clamp(state.attentionBudget),
    clamp(n.identityCoherence),
    clamp(extras?.external01??0),
    clamp(extras?.bodyCapacity01??1),
    clamp(extras?.thermalPressure01??0),
    clamp(extras?.boredom01??0),
    clamp(extras?.resourceRisk01??0),
    0,
  ];
}

export class ParametricPolicyLearner{
  private state=defaultParametricPolicy();

  restore(raw?:Partial<ParametricPolicyState>|null){
    const d=defaultParametricPolicy();
    this.state={...d,...(raw??{}),featureNames:[...featureNames],weights:{...d.weights,...(raw?.weights??{})},bias:{...d.bias,...(raw?.bias??{})}};
    for(const a of ACTIONS){
      const w=Array.isArray(this.state.weights[a])?this.state.weights[a]:[];
      this.state.weights[a]=new Array(featureNames.length).fill(0).map((_,i)=>{
        const value=Number(w[i]??0);
        return Number.isFinite(value)?Math.max(-4,Math.min(4,value)):0;
      });
      const bias=Number(this.state.bias[a]??0);
      this.state.bias[a]=Number.isFinite(bias)?Math.max(-4,Math.min(4,bias)):0;
    }
    // Persisted snapshots are untrusted input too: a corrupt diagnostic must not
    // poison future uncertainty/exploration decisions after otherwise valid restore.
    this.state.updates=Number.isSafeInteger(this.state.updates)&&this.state.updates>=0?this.state.updates:0;
    for(const key of ['tdAbsMean01','trainRewardMean01','explorationRate01','lastLoss01'] as const){
      const value=this.state[key];
      this.state[key]=Number.isFinite(value)?clamp(value):0;
    }
    this.state.lastTrainedAt=Number.isFinite(this.state.lastTrainedAt)&&this.state.lastTrainedAt>=0?this.state.lastTrainedAt:0;
  }

  snapshot():ParametricPolicyState{return structuredClone(this.state);}

  features(state:OrganismState, extras?:{external01?:number;boredom01?:number;resourceRisk01?:number;thermalPressure01?:number;bodyCapacity01?:number}, action?:ActionKind){
    const f=featureVector(state,extras);
    if(action) f[f.length-1]=actionCost(action);
    return f;
  }

  predict(state:OrganismState, extras?:{external01?:number;boredom01?:number;resourceRisk01?:number;thermalPressure01?:number;bodyCapacity01?:number}):ParametricPrediction[]{
    const out:ParametricPrediction[]=[];
    for(const a of ACTIONS){
      const x=this.features(state,extras,a); const w=this.state.weights[a]??new Array(x.length).fill(0);
      const z=(this.state.bias[a]??0)+x.reduce((s,v,i)=>s+v*(w[i]??0),0);
      const v=clamp(.5 + .5*tanh(z));
      const uncertainty=clamp(.78/(1+this.state.updates/90) + .12*(this.state.tdAbsMean01) + (this.state.weights[a]?.[0]===0?.08:0));
      out.push({action:a,value:v,uncertainty01:uncertainty});
    }
    return out;
  }

  value(state:OrganismState, action:ActionKind, extras?:{external01?:number;boredom01?:number;resourceRisk01?:number;thermalPressure01?:number;bodyCapacity01?:number}):ParametricPrediction{
    return this.predict(state,extras).find(p=>p.action===action)!;
  }

  train(input:{state:OrganismState;action:ActionKind;target01:number;learningRate01:number;sampleWeight01?:number;extras?:{external01?:number;boredom01?:number;resourceRisk01?:number;thermalPressure01?:number;bodyCapacity01?:number}}):{predictionBefore:number;predictionAfter:number;loss01:number;tdError01:number}{
    assertTrainingInput(input);
    if(this.state.frozen) return {predictionBefore:this.value(input.state,input.action,input.extras).value,predictionAfter:this.value(input.state,input.action,input.extras).value,loss01:0,tdError01:0};
    const x=this.features(input.state,input.extras,input.action);
    const w=this.state.weights[input.action];
    if(!w) return {predictionBefore:.5,predictionAfter:.5,loss01:0,tdError01:0};
    const before=this.value(input.state,input.action,input.extras).value;
    const target=clamp(input.target01);
    const error=target-before;
    const lr=Math.max(.003,Math.min(.30,input.learningRate01))*Math.max(.1,Math.min(1,input.sampleWeight01??1));
    const zDerivative=Math.max(.05, 2*before*(1-before));
    const norm=0.25+x.reduce((sum,v)=>sum+v*v,0);
    const step=lr*error*zDerivative/norm;
    for(let i=0;i<w.length;i++) w[i]=Math.max(-4,Math.min(4,w[i]+step*x[i]));
    this.state.bias[input.action]=Math.max(-4,Math.min(4,(this.state.bias[input.action]??0)+step));
    const after=this.value(input.state,input.action,input.extras).value;
    this.state.updates++;
    this.state.tdAbsMean01=clamp(this.state.tdAbsMean01*.97+Math.abs(error)*.03);
    this.state.trainRewardMean01=clamp(this.state.trainRewardMean01*.98+target*.02);
    this.state.explorationRate01=clamp(.16-Math.min(.12,this.state.updates/2500*.12)+Math.min(.05,this.state.tdAbsMean01*.05));
    this.state.lastLoss01=clamp(error*error);
    this.state.lastTrainedAt=now();
    return {predictionBefore:before,predictionAfter:after,loss01:clamp(error*error),tdError01:clamp(Math.abs(error))};
  }

  trainFeatures(input:{features:number[];action:ActionKind;target01:number;learningRate01:number;sampleWeight01?:number}):{predictionBefore:number;predictionAfter:number;loss01:number;tdError01:number}{
    assertTrainingInput(input);
    if(!Array.isArray(input.features)||input.features.some(value=>!Number.isFinite(value))) throw new TypeError('policy-learning-features-must-be-finite');
    if(this.state.frozen) { const value=this.predictFromFeatures(input.features,input.action); return {predictionBefore:value,predictionAfter:value,loss01:0,tdError01:0}; }
    const x=input.features.slice(0,featureNames.length).map(clamp); while(x.length<featureNames.length)x.push(0);
    const w=this.state.weights[input.action]; if(!w)return {predictionBefore:.5,predictionAfter:.5,loss01:0,tdError01:0};
    const before=this.predictFromFeatures(x,input.action), target=clamp(input.target01), error=target-before;
    const lr=Math.max(.002,Math.min(.25,input.learningRate01))*Math.max(.05,Math.min(1,input.sampleWeight01??1));
    const derivative=Math.max(.05,2*before*(1-before)), norm=.25+x.reduce((sum,v)=>sum+v*v,0), step=lr*error*derivative/norm;
    for(let i=0;i<w.length;i++)w[i]=Math.max(-4,Math.min(4,w[i]+step*x[i]));
    this.state.bias[input.action]=Math.max(-4,Math.min(4,(this.state.bias[input.action]??0)+step));
    const after=this.predictFromFeatures(x,input.action); this.state.updates++;
    this.state.tdAbsMean01=clamp(this.state.tdAbsMean01*.97+Math.abs(error)*.03); this.state.trainRewardMean01=clamp(this.state.trainRewardMean01*.98+target*.02);
    this.state.explorationRate01=clamp(.16-Math.min(.12,this.state.updates/2500*.12)+Math.min(.05,this.state.tdAbsMean01*.05)); this.state.lastLoss01=clamp(error*error); this.state.lastTrainedAt=now();
    return {predictionBefore:before,predictionAfter:after,loss01:clamp(error*error),tdError01:clamp(Math.abs(error))};
  }

  predictFromFeatures(features:number[],action:ActionKind):number{
    const x=features.slice(0,featureNames.length).map(clamp); while(x.length<featureNames.length)x.push(0);
    const w=this.state.weights[action]??[]; const z=(this.state.bias[action]??0)+x.reduce((sum,v,i)=>sum+v*(w[i]??0),0);
    return clamp(.5+.5*tanh(z));
  }

  trainBatch(samples:Array<Parameters<ParametricPolicyLearner['train']>[0]>){
    // Validate the complete batch before the first update. Otherwise a malformed
    // later sample can throw after earlier samples have already mutated the model.
    if(!Array.isArray(samples)) throw new TypeError('policy-learning-batch-must-be-array');
    for(const sample of samples){
      if(!sample||typeof sample!=='object') throw new TypeError('policy-learning-batch-sample-must-be-object');
      assertTrainingInput(sample);
      if(!sample.state||typeof sample.state!=='object'||!sample.state.needs||typeof sample.state.needs!=='object') throw new TypeError('policy-learning-state-must-have-needs');
    }
    let loss=0; let n=0;
    for(const sample of samples){const r=this.train(sample);loss+=r.loss01;n++;}
    return {samples:n,meanLoss01:n?loss/n:0,updates:this.state.updates};
  }

  setFrozen(frozen:boolean){this.state.frozen=Boolean(frozen);}
  actionList(){return [...ACTIONS];}
  featureNamesList(){return [...featureNames];}
}
