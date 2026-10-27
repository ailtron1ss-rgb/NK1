import type { ActionKind, OrganismState } from '../core/types.ts';
import { actionCost } from '../core/ActionCostPolicy.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Number.isFinite(x)?x:0);
const now=()=>Date.now();

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
  'boredom','resourceRisk','energyNoveltyInteraction','energyGoalPressureInteraction','noveltyGoalPressureInteraction','actionCost'
];

function assertTrainingInput(input: unknown): asserts input is {
  state: OrganismState; action: ActionKind; target01: number; learningRate01: number;
  sampleWeight01?: number; extras?: { external01?:number; boredom01?:number; resourceRisk01?:number; thermalPressure01?:number; bodyCapacity01?:number };
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('training-input-must-be-object');
  const row=input as Record<string,unknown>;
  if (typeof row.target01!=='number'||!Number.isFinite(row.target01)) throw new RangeError('target-must-be-finite');
  if (typeof row.learningRate01!=='number'||!Number.isFinite(row.learningRate01)) throw new RangeError('rate-must-be-finite');
  if (row.sampleWeight01!==undefined&&(typeof row.sampleWeight01!=='number'||!Number.isFinite(row.sampleWeight01))) throw new RangeError('sample-weight-must-be-finite');
  if (typeof row.action!=='string'||!ACTIONS.includes(row.action as ActionKind)) throw new TypeError('invalid-action');
  if (!row.state||typeof row.state!=='object'||Array.isArray(row.state)) throw new TypeError('state-must-be-object');
  const state=row.state as Record<string,unknown>;
  if (!state.needs||typeof state.needs!=='object'||Array.isArray(state.needs)) throw new TypeError('state-must-have-needs');
  const needs=state.needs as Record<string,unknown>;
  for (const key of ['energy','cognitiveLoad','uncertainty','novelty','goalPressure','socialNeed','identityCoherence']) {
    if (typeof needs[key]!=='number'||!Number.isFinite(needs[key])) throw new TypeError('state-needs-must-be-finite');
  }
  for (const key of ['predictionError','attentionBudget']) {
    if (typeof state[key]!=='number'||!Number.isFinite(state[key])) throw new TypeError('state-features-must-be-finite');
  }
  if (row.extras!==undefined) {
    if (!row.extras||typeof row.extras!=='object'||Array.isArray(row.extras)) throw new TypeError('training-extras-must-be-object');
    const extras=row.extras as Record<string,unknown>;
    for (const key of ['external01','boredom01','resourceRisk01','thermalPressure01','bodyCapacity01']) {
      if (extras[key]!==undefined&&(typeof extras[key]!=='number'||!Number.isFinite(extras[key]))) throw new TypeError('training-extras-must-be-finite');
    }
  }
}

function assertFeatureTrainingInput(input: unknown): asserts input is {features:number[];action:ActionKind;target01:number;learningRate01:number;sampleWeight01?:number} {
  if (!input || typeof input!=='object'||Array.isArray(input)) throw new TypeError('training-input-must-be-object');
  const row=input as Record<string,unknown>;
  if (typeof row.target01!=='number'||!Number.isFinite(row.target01)) throw new RangeError('target-must-be-finite');
  if (typeof row.learningRate01!=='number'||!Number.isFinite(row.learningRate01)) throw new RangeError('rate-must-be-finite');
  if (row.sampleWeight01!==undefined&&(typeof row.sampleWeight01!=='number'||!Number.isFinite(row.sampleWeight01))) throw new RangeError('sample-weight-must-be-finite');
  if (typeof row.action!=='string'||!ACTIONS.includes(row.action as ActionKind)) throw new TypeError('invalid-action');
  if (!Array.isArray(row.features)||!row.features.every(value=>typeof value==='number'&&Number.isFinite(value))) throw new TypeError('features-must-be-finite');
}

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
  const energy=clamp(n.energy),novelty=clamp(n.novelty),goalPressure=clamp(n.goalPressure);
  return [
    energy,
    clamp(n.cognitiveLoad),
    clamp(n.uncertainty),
    novelty,
    goalPressure,
    clamp(n.socialNeed),
    clamp(state.predictionError),
    clamp(state.attentionBudget),
    clamp(n.identityCoherence),
    clamp(extras?.external01??0),
    clamp(extras?.bodyCapacity01??1),
    clamp(extras?.thermalPressure01??0),
    clamp(extras?.boredom01??0),
    clamp(extras?.resourceRisk01??0),
    energy*novelty,
    energy*goalPressure,
    novelty*goalPressure,
    0,
  ];
}

export class ParametricPolicyLearner{
  private state=defaultParametricPolicy();

  restore(raw?:Partial<ParametricPolicyState>|null){
    const d=defaultParametricPolicy();
    const savedNames=Array.isArray(raw?.featureNames)?raw!.featureNames:[];
    this.state={...d,...(raw??{}),featureNames:[...featureNames],weights:{...d.weights,...(raw?.weights??{})},bias:{...d.bias,...(raw?.bias??{})}};
    for(const a of ACTIONS){
      const savedWeights=Array.isArray(raw?.weights?.[a])?raw!.weights![a]:[];
      this.state.weights[a]=featureNames.map((name,index)=>{
        // Migrate older snapshots by semantic name: actionCost remains actionCost,
        // never silently becoming an interaction weight when the feature set grows.
        const oldIndex=savedNames.length?savedNames.indexOf(name):(name==='actionCost'?14:index<14?index:-1);
        const value=oldIndex>=0?Number(savedWeights[oldIndex]??0):0;
        return Math.max(-4,Math.min(4,Number.isFinite(value)?value:0));
      });
      const bias=Number(this.state.bias[a]??0);
      this.state.bias[a]=Number.isFinite(bias)?Math.max(-4,Math.min(4,bias)):0;
    }
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
    const requestedRate=Number.isFinite(input.learningRate01)?input.learningRate01:.03;
    const requestedWeight=input.sampleWeight01===undefined?1:(Number.isFinite(input.sampleWeight01)?input.sampleWeight01:.1);
    const lr=Math.max(.003,Math.min(.30,requestedRate))*Math.max(.1,Math.min(1,requestedWeight));
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
    assertFeatureTrainingInput(input);
    if(this.state.frozen) { const value=this.predictFromFeatures(input.features,input.action); return {predictionBefore:value,predictionAfter:value,loss01:0,tdError01:0}; }
    const x=input.features.slice(0,featureNames.length).map(clamp); while(x.length<featureNames.length)x.push(0);
    const w=this.state.weights[input.action]; if(!w)return {predictionBefore:.5,predictionAfter:.5,loss01:0,tdError01:0};
    const before=this.predictFromFeatures(x,input.action), target=clamp(input.target01), error=target-before;
    const requestedRate=Number.isFinite(input.learningRate01)?input.learningRate01:.03;
    const requestedWeight=input.sampleWeight01===undefined?1:(Number.isFinite(input.sampleWeight01)?input.sampleWeight01:.1);
    const lr=Math.max(.002,Math.min(.25,requestedRate))*Math.max(.05,Math.min(1,requestedWeight));
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
    let loss=0; let n=0;
    for(const sample of samples){const r=this.train(sample);loss+=r.loss01;n++;}
    return {samples:n,meanLoss01:n?loss/n:0,updates:this.state.updates};
  }

  setFrozen(frozen:boolean){this.state.frozen=Boolean(frozen);}
  actionList(){return [...ACTIONS];}
  featureNamesList(){return [...featureNames];}
}
