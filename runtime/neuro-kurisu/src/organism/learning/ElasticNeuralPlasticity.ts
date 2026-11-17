import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const HARD_PROTECTED=new Set(['identityCoherence','actionCost']);
const clamp01=(value:number)=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const safeCounter=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;
const now=()=>Date.now();

export interface ElasticPlasticityHoldoutCase {
  id:string;
  action:ActionKind;
  features:number[];
  target01:number;
}

export interface ElasticNeuralPlasticityOptions {
  allowedParameterNames:string[];
  protectedParameterNames?:string[];
  targetHoldout:ElasticPlasticityHoldoutCase[];
  retentionHoldout:ElasticPlasticityHoldoutCase[];
  trainingSampleId:string;
  maxTrainableFraction01?:number;
  maxCoordinates?:number;
  maxDeltaL2?:number;
  importancePenalty?:number;
  minimumTargetLossGain01?:number;
  maxRetentionLossIncrease01?:number;
}

export interface ElasticNeuralPlasticityState {
  version:1;
  attempts:number;
  acceptedUpdates:number;
  rejectedUpdates:number;
  importanceByAction:Record<ActionKind,number[]>;
  lastUpdatedParameterNames:string[];
  lastReason:string;
  lastTargetLossImprovement01:number;
  lastRetentionLossIncrease01:number;
  lastUpdatedAt:number;
}

export interface ElasticNeuralPlasticityResult {
  accepted:boolean;
  reason:string;
  candidateParameterNames:string[];
  updatedParameterNames:string[];
  targetLossBefore01:number;
  targetLossAfter01:number;
  retentionLossBefore01:number;
  retentionLossAfter01:number;
  targetLossImprovement01:number;
  retentionLossIncrease01:number;
}

function defaultImportance(dimension:number):Record<ActionKind,number[]> {
  return Object.fromEntries(ACTIONS.map(action=>[action,new Array(dimension).fill(0)])) as Record<ActionKind,number[]>;
}

export function defaultElasticNeuralPlasticityState(dimension:number):ElasticNeuralPlasticityState {
  return {
    version:1,attempts:0,acceptedUpdates:0,rejectedUpdates:0,
    importanceByAction:defaultImportance(dimension),
    lastUpdatedParameterNames:[],lastReason:'not-run',
    lastTargetLossImprovement01:0,lastRetentionLossIncrease01:0,lastUpdatedAt:0,
  };
}

function predict(weights:number[],bias:number,features:number[]):number {
  let z=bias;
  for(let i=0;i<weights.length;i++)z+=weights[i]*features[i];
  return clamp01(.5+.5*Math.tanh(z));
}

function meanSquaredError(rows:ElasticPlasticityHoldoutCase[],weights:number[],bias:number,dimension:number):number {
  let loss=0;
  for(const row of rows){
    const x=row.features.map(value=>clamp01(value));
    if(x.length!==dimension)throw new RangeError('holdout-feature-dimension-mismatch');
    const error=row.target01-predict(weights,bias,x);
    loss+=error*error;
  }
  return rows.length?loss/rows.length:0;
}

function validId(value:unknown):value is string {
  return typeof value==='string'&&value.length>0&&value.length<=256&&value.trim()===value&&!/[\u0000-\u001f\u007f-\u009f]/.test(value);
}

export class ElasticNeuralPlasticityController {
  private state:ElasticNeuralPlasticityState;
  readonly parameterNames:string[];

  constructor(parameterNames:string[]) {
    if(!Array.isArray(parameterNames)||parameterNames.length<1||parameterNames.length>64||
      !parameterNames.every(name=>typeof name==='string'&&name.length>0&&name.trim()===name)||
      new Set(parameterNames).size!==parameterNames.length)throw new TypeError('plasticity-parameter-schema-invalid');
    this.parameterNames=[...parameterNames];
    this.state=defaultElasticNeuralPlasticityState(parameterNames.length);
  }

  restore(raw?:Partial<ElasticNeuralPlasticityState>|null):void {
    const d=defaultElasticNeuralPlasticityState(this.parameterNames.length);
    const source=raw?.importanceByAction;
    const importanceByAction=defaultImportance(this.parameterNames.length);
    if(source&&typeof source==='object'&&!Array.isArray(source)){
      for(const action of ACTIONS){
        const values=source[action];
        if(Array.isArray(values)){
          importanceByAction[action]=this.parameterNames.map((_,index)=>{
            const value=Number(values[index]??0);
            return Number.isFinite(value)?clamp01(value):0;
          });
        }
      }
    }
    this.state={
      ...d,version:1,
      attempts:safeCounter(raw?.attempts),
      acceptedUpdates:safeCounter(raw?.acceptedUpdates),
      rejectedUpdates:safeCounter(raw?.rejectedUpdates),
      importanceByAction,
      lastUpdatedParameterNames:Array.isArray(raw?.lastUpdatedParameterNames)
        ?raw!.lastUpdatedParameterNames.filter((name):name is string=>this.parameterNames.includes(name)).slice(0,this.parameterNames.length):[],
      lastReason:typeof raw?.lastReason==='string'?raw.lastReason.slice(0,96):d.lastReason,
      lastTargetLossImprovement01:typeof raw?.lastTargetLossImprovement01==='number'&&Number.isFinite(raw.lastTargetLossImprovement01)?clamp01(raw.lastTargetLossImprovement01):0,
      lastRetentionLossIncrease01:typeof raw?.lastRetentionLossIncrease01==='number'&&Number.isFinite(raw.lastRetentionLossIncrease01)?Math.max(-1,Math.min(1,raw.lastRetentionLossIncrease01)):0,
      lastUpdatedAt:typeof raw?.lastUpdatedAt==='number'&&Number.isFinite(raw.lastUpdatedAt)&&raw.lastUpdatedAt>=0?raw.lastUpdatedAt:0,
    };
  }

  snapshot():ElasticNeuralPlasticityState{return structuredClone(this.state);}

  blocked(reason:string):ElasticNeuralPlasticityResult {
    this.finish(false,reason,[],0,0,0,0);
    return {
      accepted:false,reason,candidateParameterNames:[],updatedParameterNames:[],
      targetLossBefore01:0,targetLossAfter01:0,retentionLossBefore01:0,retentionLossAfter01:0,
      targetLossImprovement01:0,retentionLossIncrease01:0,
    };
  }

  consider(input:{
    action:ActionKind;
    weights:number[];
    bias:number;
    features:number[];
    step:number;
    sampleId:string;
  },options:ElasticNeuralPlasticityOptions):ElasticNeuralPlasticityResult {
    if(!input||typeof input!=='object'||!ACTIONS.includes(input.action))throw new TypeError('plasticity-training-action-invalid');
    if(!Array.isArray(input.weights)||input.weights.length!==this.parameterNames.length||
      !input.weights.every(value=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=4))
      throw new TypeError('plasticity-current-weights-invalid');
    if(!Array.isArray(input.features)||input.features.length!==this.parameterNames.length||
      !input.features.every(value=>typeof value==='number'&&Number.isFinite(value)))
      throw new TypeError('plasticity-training-feature-dimension-invalid');
    if(typeof input.bias!=='number'||!Number.isFinite(input.bias)||Math.abs(input.bias)>4||
      typeof input.step!=='number'||!Number.isFinite(input.step))throw new TypeError('plasticity-gradient-invalid');
    if(!validId(input.sampleId))throw new TypeError('plasticity-training-sample-id-invalid');
    if(!options||typeof options!=='object'||Array.isArray(options))throw new TypeError('plasticity-options-invalid');
    if(!validId(options.trainingSampleId)||options.trainingSampleId!==input.sampleId)
      throw new TypeError('plasticity-training-sample-id-mismatch');

    const allowlist=options.allowedParameterNames;
    if(!Array.isArray(allowlist)||allowlist.length<1||allowlist.length>this.parameterNames.length||
      !allowlist.every(name=>typeof name==='string'&&this.parameterNames.includes(name))||
      new Set(allowlist).size!==allowlist.length)throw new TypeError('plasticity-allowlist-invalid');
    const protectedNames=options.protectedParameterNames??[];
    if(!Array.isArray(protectedNames)||protectedNames.length>this.parameterNames.length||
      !protectedNames.every(name=>typeof name==='string'&&this.parameterNames.includes(name))||
      new Set(protectedNames).size!==protectedNames.length)throw new TypeError('plasticity-protection-list-invalid');
    const target=options.targetHoldout,retention=options.retentionHoldout;
    if(!Array.isArray(target)||target.length<4||target.length>128||
      !Array.isArray(retention)||retention.length<4||retention.length>128)
      throw new RangeError('plasticity-holdout-size-invalid');
    const seen=new Set<string>([input.sampleId]);
    for(const [lane,rows] of [['target',target],['retention',retention]] as const){
      for(const row of rows){
        if(!row||typeof row!=='object'||!validId(row.id)||seen.has(row.id))throw new TypeError('holdout-id-overlap-or-invalid');
        seen.add(row.id);
        if(row.action!==input.action)throw new TypeError('holdout-action-mismatch');
        if(typeof row.target01!=='number'||!Number.isFinite(row.target01)||row.target01<0||row.target01>1)
          throw new TypeError('holdout-target-invalid');
        if(!Array.isArray(row.features)||row.features.length!==this.parameterNames.length||
          !row.features.every(value=>typeof value==='number'&&Number.isFinite(value)))
          throw new TypeError(lane+'-holdout-feature-invalid');
      }
    }
    const maxFraction=options.maxTrainableFraction01??.2;
    const maxCoordinates=options.maxCoordinates??3;
    const maxDeltaL2=options.maxDeltaL2??.05;
    const importancePenalty=options.importancePenalty??4;
    const minimumGain=options.minimumTargetLossGain01??.0001;
    const maxRetentionIncrease=options.maxRetentionLossIncrease01??.002;
    if(typeof maxFraction!=='number'||!Number.isFinite(maxFraction)||maxFraction<.01||maxFraction>.5)
      throw new RangeError('plasticity-trainable-fraction-invalid');
    if(!Number.isSafeInteger(maxCoordinates)||maxCoordinates<1||maxCoordinates>this.parameterNames.length)
      throw new RangeError('plasticity-coordinate-budget-invalid');
    if(typeof maxDeltaL2!=='number'||!Number.isFinite(maxDeltaL2)||maxDeltaL2<=0||maxDeltaL2>1)
      throw new RangeError('plasticity-delta-budget-invalid');
    if(typeof importancePenalty!=='number'||!Number.isFinite(importancePenalty)||importancePenalty<0||importancePenalty>64)
      throw new RangeError('plasticity-importance-penalty-invalid');
    if(typeof minimumGain!=='number'||!Number.isFinite(minimumGain)||minimumGain<0||minimumGain>1||
      typeof maxRetentionIncrease!=='number'||!Number.isFinite(maxRetentionIncrease)||maxRetentionIncrease<0||maxRetentionIncrease>1)
      throw new RangeError('plasticity-evaluation-threshold-invalid');

    const weights=input.weights,features=input.features.map(clamp01),bias=input.bias;
    const targetBefore=meanSquaredError(target,weights,bias,this.parameterNames.length);
    const retentionBefore=meanSquaredError(retention,weights,bias,this.parameterNames.length);
    const previousImportance=this.state.importanceByAction[input.action];
    const observedImportance=this.parameterNames.map((_,index)=>{
      const ablated=weights.slice();
      ablated[index]=0;
      const ablatedLoss=meanSquaredError(retention,ablated,bias,this.parameterNames.length);
      return clamp01(Math.max(0,ablatedLoss-retentionBefore)/Math.max(.01,retentionBefore));
    });
    const importance=observedImportance.map((value,index)=>clamp01(previousImportance[index]*.8+value*.2));
    this.state.importanceByAction[input.action]=importance;

    const protectedSet=new Set([...protectedNames,...HARD_PROTECTED]);
    const allowSet=new Set(allowlist);
    const candidates=this.parameterNames.map((name,index)=>{
      if(!allowSet.has(name)||protectedSet.has(name))return null;
      const rawDelta=input.step*features[index];
      const delta=rawDelta/(1+importancePenalty*importance[index]);
      return Math.abs(delta)>1e-12?{name,index,delta,score:Math.abs(delta)}:null;
    }).filter((row):row is {name:string;index:number;delta:number;score:number}=>row!==null)
      .sort((a,b)=>b.score-a.score||a.index-b.index);
    const coordinateLimit=Math.min(maxCoordinates,Math.max(1,Math.floor(this.parameterNames.length*maxFraction)));
    const selected=candidates.slice(0,coordinateLimit);
    if(!selected.length)return this.finish(false,'no-eligible-parameters',[],targetBefore,retentionBefore,targetBefore,retentionBefore);
    const norm=Math.sqrt(selected.reduce((sum,row)=>sum+row.delta*row.delta,0));
    const scale=norm>maxDeltaL2?maxDeltaL2/norm:1;
    const candidateWeights=weights.slice();
    for(const row of selected){
      candidateWeights[row.index]=Math.max(-4,Math.min(4,weights[row.index]+row.delta*scale));
    }
    const effective=selected.filter(row=>Math.abs(candidateWeights[row.index]-weights[row.index])>1e-12);
    if(!effective.length)return this.finish(false,'no-effective-update',[],targetBefore,retentionBefore,targetBefore,retentionBefore);
    const targetAfter=meanSquaredError(target,candidateWeights,bias,this.parameterNames.length);
    const retentionAfter=meanSquaredError(retention,candidateWeights,bias,this.parameterNames.length);
    const targetGain=targetBefore-targetAfter;
    const retentionIncrease=retentionAfter-retentionBefore;
    if(targetGain<=minimumGain)return this.finish(false,'target-holdout-not-improved',effective.map(row=>row.name),targetBefore,retentionBefore,targetAfter,retentionAfter);
    if(retentionIncrease>maxRetentionIncrease)return this.finish(false,'retention-regression',effective.map(row=>row.name),targetBefore,retentionBefore,targetAfter,retentionAfter);
    for(const row of effective)weights[row.index]=candidateWeights[row.index];
    return this.finish(true,'accepted',effective.map(row=>row.name),targetBefore,retentionBefore,targetAfter,retentionAfter);
  }

  private finish(accepted:boolean,reason:string,names:string[],targetBefore:number,targetAfter:number,retentionBefore:number,retentionAfter:number):ElasticNeuralPlasticityResult {
    this.state.attempts++;
    if(accepted)this.state.acceptedUpdates++; else this.state.rejectedUpdates++;
    this.state.lastUpdatedParameterNames=accepted?[...names]:[];
    this.state.lastReason=reason;
    this.state.lastTargetLossImprovement01=clamp01(targetBefore-targetAfter);
    this.state.lastRetentionLossIncrease01=Math.max(-1,Math.min(1,retentionAfter-retentionBefore));
    this.state.lastUpdatedAt=now();
    return {
      accepted,reason,candidateParameterNames:[...names],updatedParameterNames:accepted?[...names]:[],
      targetLossBefore01:targetBefore,targetLossAfter01:targetAfter,
      retentionLossBefore01:retentionBefore,retentionLossAfter01:retentionAfter,
      targetLossImprovement01:targetBefore-targetAfter,retentionLossIncrease01:retentionAfter-retentionBefore,
    };
  }
}
