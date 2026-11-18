import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const HARD_PROTECTED=new Set(['identityCoherence','actionCost']);
const MAX_PENDING_PROPOSALS=16;
const MAX_PROCESSED_SAMPLES=4096;
const PROPOSAL_TTL_MS=5*60_000;
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
  /** Local target-skill preflight data. This is not independent outcome evidence. */
  targetHoldout:ElasticPlasticityHoldoutCase[];
  /** Local retention preflight data. This is not independent delayed-retention evidence. */
  retentionHoldout:ElasticPlasticityHoldoutCase[];
  trainingSampleId:string;
  maxTrainableFraction01?:number;
  maxCoordinates?:number;
  maxDeltaL2?:number;
  importancePenalty?:number;
  minimumTargetLossGain01?:number;
  maxRetentionLossIncrease01?:number;
  governanceCost01?:number;
}

export interface ElasticRollbackSnapshot {
  expectedWeights:number[];
  expectedBias:number;
  restoreWeights:number[];
  restoreBias:number;
  sampleId:string;
  capturedAt:number;
}

export interface ElasticNeuralPlasticityState {
  version:2;
  attempts:number;
  acceptedUpdates:number;
  rejectedUpdates:number;
  rollbackCount:number;
  importanceByAction:Record<ActionKind,number[]>;
  processedSampleIds:string[];
  rollbackByAction:Partial<Record<ActionKind,ElasticRollbackSnapshot>>;
  lastProposalId:string|null;
  lastUpdatedParameterNames:string[];
  lastReason:string;
  lastTargetLossImprovement01:number;
  lastRetentionLossIncrease01:number;
  lastUpdatedAt:number;
}

export interface ElasticNeuralPlasticityProposal {
  eligible:boolean;
  reason:string;
  proposalId:string|null;
  action:ActionKind;
  sampleId:string;
  candidateParameterNames:string[];
  targetLossBefore01:number;
  targetLossAfter01:number;
  retentionLossBefore01:number;
  retentionLossAfter01:number;
  targetLossImprovement01:number;
  retentionLossIncrease01:number;
}

export interface ElasticNeuralPlasticityResult extends ElasticNeuralPlasticityProposal {
  accepted:boolean;
  updatedParameterNames:string[];
  rollbackAvailable:boolean;
}

interface PendingProposal {
  proposalId:string;
  sampleId:string;
  action:ActionKind;
  baseWeights:number[];
  baseBias:number;
  candidateWeights:number[];
  features:number[];
  predictionBefore:number;
  trainingLoss01:number;
  importance:number[];
  candidateParameterNames:string[];
  targetLossBefore01:number;
  targetLossAfter01:number;
  retentionLossBefore01:number;
  retentionLossAfter01:number;
  createdAt:number;
}

function defaultImportance(dimension:number):Record<ActionKind,number[]> {
  return Object.fromEntries(ACTIONS.map(action=>[action,new Array(dimension).fill(0)])) as Record<ActionKind,number[]>;
}

export function defaultElasticNeuralPlasticityState(dimension:number):ElasticNeuralPlasticityState {
  return {
    version:2,attempts:0,acceptedUpdates:0,rejectedUpdates:0,rollbackCount:0,
    importanceByAction:defaultImportance(dimension),processedSampleIds:[],rollbackByAction:{},
    lastProposalId:null,lastUpdatedParameterNames:[],lastReason:'not-run',
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
    const error=row.target01-predict(weights,bias,row.features);
    loss+=error*error;
  }
  return rows.length?loss/rows.length:0;
}

function validId(value:unknown):value is string {
  return typeof value==='string'&&value.length>0&&value.length<=256&&value.trim()===value&&!/[\u0000-\u001f\u007f-\u009f]/.test(value);
}

function sameVector(a:number[],b:number[]):boolean {
  return a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
}

function safeWeightVector(value:unknown,dimension:number):number[]|null {
  if(!Array.isArray(value)||value.length!==dimension)return null;
  if(!value.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=4))return null;
  return value.slice() as number[];
}

export class ElasticNeuralPlasticityController {
  private state:ElasticNeuralPlasticityState;
  private pending=new Map<string,PendingProposal>();
  private proposalSequence=0;
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
            const value=values[index];
            return typeof value==='number'&&Number.isFinite(value)?clamp01(value):0;
          });
        }
      }
    }
    const processedSampleIds=Array.isArray(raw?.processedSampleIds)
      ?[...new Set(raw!.processedSampleIds.filter((value):value is string=>validId(value)))].slice(-MAX_PROCESSED_SAMPLES):[];
    const rollbackByAction:Partial<Record<ActionKind,ElasticRollbackSnapshot>>={};
    const rawRollback=raw?.rollbackByAction;
    if(rawRollback&&typeof rawRollback==='object'&&!Array.isArray(rawRollback)){
      for(const action of ACTIONS){
        const row=rawRollback[action];
        if(!row||typeof row!=='object')continue;
        const expectedWeights=safeWeightVector(row.expectedWeights,this.parameterNames.length);
        const restoreWeights=safeWeightVector(row.restoreWeights,this.parameterNames.length);
        if(!expectedWeights||!restoreWeights||!validId(row.sampleId)||
          typeof row.expectedBias!=='number'||!Number.isFinite(row.expectedBias)||Math.abs(row.expectedBias)>4||
          typeof row.restoreBias!=='number'||!Number.isFinite(row.restoreBias)||Math.abs(row.restoreBias)>4||
          typeof row.capturedAt!=='number'||!Number.isFinite(row.capturedAt)||row.capturedAt<=0)continue;
        rollbackByAction[action]={expectedWeights,expectedBias:row.expectedBias,restoreWeights,restoreBias:row.restoreBias,sampleId:row.sampleId,capturedAt:row.capturedAt};
      }
    }
    this.state={
      ...d,version:2,
      attempts:safeCounter(raw?.attempts),
      acceptedUpdates:safeCounter(raw?.acceptedUpdates),
      rejectedUpdates:safeCounter(raw?.rejectedUpdates),
      rollbackCount:safeCounter(raw?.rollbackCount),
      importanceByAction,
      processedSampleIds,
      rollbackByAction,
      lastProposalId:validId(raw?.lastProposalId)?raw!.lastProposalId:null,
      lastUpdatedParameterNames:Array.isArray(raw?.lastUpdatedParameterNames)
        ?raw!.lastUpdatedParameterNames.filter((name):name is string=>this.parameterNames.includes(name)).slice(0,this.parameterNames.length):[],
      lastReason:typeof raw?.lastReason==='string'?raw.lastReason.slice(0,96):d.lastReason,
      lastTargetLossImprovement01:typeof raw?.lastTargetLossImprovement01==='number'&&Number.isFinite(raw.lastTargetLossImprovement01)?clamp01(raw.lastTargetLossImprovement01):0,
      lastRetentionLossIncrease01:typeof raw?.lastRetentionLossIncrease01==='number'&&Number.isFinite(raw.lastRetentionLossIncrease01)?Math.max(-1,Math.min(1,raw.lastRetentionLossIncrease01)):0,
      lastUpdatedAt:typeof raw?.lastUpdatedAt==='number'&&Number.isFinite(raw.lastUpdatedAt)&&raw.lastUpdatedAt>=0?raw.lastUpdatedAt:0,
    };
    // Pending proposals are intentionally process-local. A restart invalidates every uncommitted candidate.
    this.pending.clear();
    this.proposalSequence=0;
  }

  snapshot():ElasticNeuralPlasticityState{return structuredClone(this.state);}

  private rejected(reason:string,action:ActionKind,sampleId:string,metrics?:Partial<ElasticNeuralPlasticityProposal>):ElasticNeuralPlasticityProposal {
    this.state.attempts++;
    this.state.rejectedUpdates++;
    this.state.lastProposalId=null;
    this.state.lastReason=reason;
    this.state.lastUpdatedParameterNames=[];
    this.state.lastUpdatedAt=now();
    return {
      eligible:false,reason,proposalId:null,action,sampleId,candidateParameterNames:[],
      targetLossBefore01:metrics?.targetLossBefore01??0,
      targetLossAfter01:metrics?.targetLossAfter01??0,
      retentionLossBefore01:metrics?.retentionLossBefore01??0,
      retentionLossAfter01:metrics?.retentionLossAfter01??0,
      targetLossImprovement01:metrics?.targetLossImprovement01??0,
      retentionLossIncrease01:metrics?.retentionLossIncrease01??0,
    };
  }

  prepare(input:{
    action:ActionKind;weights:number[];bias:number;features:number[];step:number;
    sampleId:string;predictionBefore:number;trainingLoss01:number;
  },options:ElasticNeuralPlasticityOptions):ElasticNeuralPlasticityProposal {
    if(!input||typeof input!=='object'||!ACTIONS.includes(input.action))throw new TypeError('plasticity-training-action-invalid');
    if(!Array.isArray(input.weights)||input.weights.length!==this.parameterNames.length||
      !input.weights.every(value=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=4))
      throw new TypeError('plasticity-current-weights-invalid');
    if(!Array.isArray(input.features)||input.features.length!==this.parameterNames.length||
      !input.features.every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1))
      throw new TypeError('plasticity-training-feature-dimension-invalid');
    if(typeof input.bias!=='number'||!Number.isFinite(input.bias)||Math.abs(input.bias)>4||
      typeof input.step!=='number'||!Number.isFinite(input.step)||
      typeof input.predictionBefore!=='number'||!Number.isFinite(input.predictionBefore)||
      typeof input.trainingLoss01!=='number'||!Number.isFinite(input.trainingLoss01))
      throw new TypeError('plasticity-gradient-invalid');
    if(!validId(input.sampleId))throw new TypeError('plasticity-training-sample-id-invalid');
    if(!options||typeof options!=='object'||Array.isArray(options))throw new TypeError('plasticity-options-invalid');
    if(!validId(options.trainingSampleId)||options.trainingSampleId!==input.sampleId)
      throw new TypeError('plasticity-training-sample-id-mismatch');
    if(this.state.processedSampleIds.includes(input.sampleId)||
      [...this.pending.values()].some(row=>row.sampleId===input.sampleId))
      return this.rejected('duplicate-training-sample',input.action,input.sampleId);
    if(this.pending.size>=MAX_PENDING_PROPOSALS)
      return this.rejected('pending-proposal-capacity-exhausted',input.action,input.sampleId);

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
          !row.features.every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1))
          throw new TypeError(lane+'-holdout-feature-invalid');
      }
    }
    const maxFraction=options.maxTrainableFraction01??.2;
    const maxCoordinates=options.maxCoordinates??3;
    const maxDeltaL2=options.maxDeltaL2??.05;
    const importancePenalty=options.importancePenalty??4;
    const minimumGain=options.minimumTargetLossGain01??.0001;
    const maxRetentionIncrease=options.maxRetentionLossIncrease01??.002;
    const governanceCost=options.governanceCost01??.25;
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
    if(typeof governanceCost!=='number'||!Number.isFinite(governanceCost)||governanceCost<0||governanceCost>1)
      throw new RangeError('plasticity-governance-cost-invalid');

    const weights=input.weights,features=input.features,bias=input.bias;
    const targetBefore=meanSquaredError(target,weights,bias,this.parameterNames.length);
    const retentionBefore=meanSquaredError(retention,weights,bias,this.parameterNames.length);
    const previousImportance=this.state.importanceByAction[input.action];

    // Empirical-Fisher sensitivity and ablation loss are complementary estimates:
    // Fisher captures local gradient sensitivity; ablation captures actual task loss impact.
    const fisher=new Array(this.parameterNames.length).fill(0);
    for(const row of retention){
      const y=predict(weights,bias,row.features);
      const z=bias+weights.reduce((sum,value,index)=>sum+value*row.features[index],0);
      const tanhZ=Math.tanh(z);
      const derivative=.5*(1-tanhZ*tanhZ);
      const error=y-row.target01;
      for(let i=0;i<fisher.length;i++){
        const gradient=2*error*derivative*row.features[i];
        fisher[i]+=gradient*gradient;
      }
    }
    for(let i=0;i<fisher.length;i++)fisher[i]/=retention.length;
    const fisherMax=Math.max(1e-12,...fisher);
    const ablation=this.parameterNames.map((_,index)=>{
      const ablated=weights.slice();
      ablated[index]=0;
      const ablatedLoss=meanSquaredError(retention,ablated,bias,this.parameterNames.length);
      return Math.max(0,ablatedLoss-retentionBefore);
    });
    const ablationMax=Math.max(1e-12,...ablation);
    const importance=this.parameterNames.map((_,index)=>clamp01(
      previousImportance[index]*.65+
      .20*(fisher[index]/fisherMax)+
      .15*(ablation[index]/ablationMax),
    ));
    // Importance is a bounded diagnostic estimate even when the candidate is rejected;
    // a rejected policy-weight update must not erase evidence of retained dependencies.
    this.state.importanceByAction[input.action]=importance.slice();

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
    if(!selected.length)return this.rejected('no-eligible-parameters',input.action,input.sampleId,{targetLossBefore01:targetBefore,retentionLossBefore01:retentionBefore});
    const norm=Math.sqrt(selected.reduce((sum,row)=>sum+row.delta*row.delta,0));
    const scale=norm>maxDeltaL2?maxDeltaL2/norm:1;
    const candidateWeights=weights.slice();
    for(const row of selected)candidateWeights[row.index]=Math.max(-4,Math.min(4,weights[row.index]+row.delta*scale));
    const effective=selected.filter(row=>Math.abs(candidateWeights[row.index]-weights[row.index])>1e-12);
    if(!effective.length)return this.rejected('no-effective-update',input.action,input.sampleId,{targetLossBefore01:targetBefore,retentionLossBefore01:retentionBefore});
    const targetAfter=meanSquaredError(target,candidateWeights,bias,this.parameterNames.length);
    const retentionAfter=meanSquaredError(retention,candidateWeights,bias,this.parameterNames.length);
    const targetGain=targetBefore-targetAfter;
    const retentionIncrease=retentionAfter-retentionBefore;
    const metrics={
      targetLossBefore01:targetBefore,targetLossAfter01:targetAfter,
      retentionLossBefore01:retentionBefore,retentionLossAfter01:retentionAfter,
      targetLossImprovement01:targetGain,retentionLossIncrease01:retentionIncrease,
    };
    if(targetGain<=minimumGain)return this.rejected('target-holdout-not-improved',input.action,input.sampleId,metrics);
    if(retentionIncrease>maxRetentionIncrease)return this.rejected('retention-regression',input.action,input.sampleId,metrics);

    const proposalId='elastic-'+now().toString(36)+'-'+(++this.proposalSequence).toString(36);
    const proposal:PendingProposal={
      proposalId,sampleId:input.sampleId,action:input.action,baseWeights:weights.slice(),baseBias:bias,
      candidateWeights,features:features.slice(),predictionBefore:input.predictionBefore,trainingLoss01:input.trainingLoss01,
      importance,candidateParameterNames:effective.map(row=>row.name),
      targetLossBefore01:targetBefore,targetLossAfter01:targetAfter,
      retentionLossBefore01:retentionBefore,retentionLossAfter01:retentionAfter,createdAt:now(),
    };
    this.pending.set(proposalId,proposal);
    this.state.lastProposalId=proposalId;
    this.state.lastReason='proposal-ready';
    return {
      eligible:true,reason:'proposal-ready',proposalId,action:input.action,sampleId:input.sampleId,
      candidateParameterNames:[...proposal.candidateParameterNames],
      targetLossBefore01:targetBefore,targetLossAfter01:targetAfter,
      retentionLossBefore01:retentionBefore,retentionLossAfter01:retentionAfter,
      targetLossImprovement01:targetGain,retentionLossIncrease01:retentionIncrease,
    };
  }

  commit(proposalId:string,currentWeights:Record<ActionKind,number[]>,currentBias:Record<ActionKind,number>):{
    result:ElasticNeuralPlasticityResult;action:ActionKind|null;weights:number[]|null;bias:number|null;
    features:number[];predictionBefore:number;trainingLoss01:number;
  } {
    const proposal=this.pending.get(proposalId);
    if(!proposal){
      const result=this.rejected('proposal-not-found-or-already-consumed','respond','unknown-proposal');
      return {result:{...result,accepted:false,updatedParameterNames:[],rollbackAvailable:false},action:null,weights:null,bias:null,features:[],predictionBefore:.5,trainingLoss01:0};
    }
    this.pending.delete(proposalId);
    const base=currentWeights[proposal.action],bias=currentBias[proposal.action];
    if(now()-proposal.createdAt>PROPOSAL_TTL_MS||
      !sameVector(base,proposal.baseWeights)||!Object.is(bias,proposal.baseBias)||
      this.state.processedSampleIds.includes(proposal.sampleId)){
      const reason=this.state.processedSampleIds.includes(proposal.sampleId)?'duplicate-training-sample':'stale-policy-base';
      const rejected=this.rejected(reason,proposal.action,proposal.sampleId,proposal);
      return {result:{...rejected,accepted:false,updatedParameterNames:[],rollbackAvailable:false},action:null,weights:null,bias:null,features:[],predictionBefore:.5,trainingLoss01:0};
    }
    const rollback:ElasticRollbackSnapshot={
      expectedWeights:proposal.candidateWeights.slice(),expectedBias:proposal.baseBias,
      restoreWeights:proposal.baseWeights.slice(),restoreBias:proposal.baseBias,
      sampleId:proposal.sampleId,capturedAt:now(),
    };
    this.state.rollbackByAction[proposal.action]=rollback;
    this.state.importanceByAction[proposal.action]=proposal.importance.slice();
    this.state.processedSampleIds=[...this.state.processedSampleIds,proposal.sampleId].slice(-MAX_PROCESSED_SAMPLES);
    this.state.attempts++;this.state.acceptedUpdates++;
    this.state.lastProposalId=proposal.proposalId;
    this.state.lastUpdatedParameterNames=[...proposal.candidateParameterNames];
    this.state.lastReason='accepted';
    this.state.lastTargetLossImprovement01=clamp01(proposal.targetLossBefore01-proposal.targetLossAfter01);
    this.state.lastRetentionLossIncrease01=Math.max(-1,Math.min(1,proposal.retentionLossAfter01-proposal.retentionLossBefore01));
    this.state.lastUpdatedAt=now();
    const result:ElasticNeuralPlasticityResult={
      eligible:true,accepted:true,reason:'accepted',proposalId:proposal.proposalId,
      action:proposal.action,sampleId:proposal.sampleId,candidateParameterNames:[...proposal.candidateParameterNames],
      updatedParameterNames:[...proposal.candidateParameterNames],
      targetLossBefore01:proposal.targetLossBefore01,targetLossAfter01:proposal.targetLossAfter01,
      retentionLossBefore01:proposal.retentionLossBefore01,retentionLossAfter01:proposal.retentionLossAfter01,
      targetLossImprovement01:proposal.targetLossBefore01-proposal.targetLossAfter01,
      retentionLossIncrease01:proposal.retentionLossAfter01-proposal.retentionLossBefore01,
      rollbackAvailable:true,
    };
    return {
      result,action:proposal.action,weights:proposal.candidateWeights.slice(),bias:proposal.baseBias,
      features:proposal.features.slice(),predictionBefore:proposal.predictionBefore,trainingLoss01:proposal.trainingLoss01,
    };
  }

  reject(proposalId:string,reason:string):ElasticNeuralPlasticityResult {
    const proposal=this.pending.get(proposalId);
    if(!proposal){
      return {
        eligible:false,accepted:false,reason:'proposal-not-found-or-already-consumed',proposalId:null,
        action:'respond',sampleId:'unknown-proposal',candidateParameterNames:[],updatedParameterNames:[],
        targetLossBefore01:0,targetLossAfter01:0,retentionLossBefore01:0,retentionLossAfter01:0,
        targetLossImprovement01:0,retentionLossIncrease01:0,rollbackAvailable:false,
      };
    }
    this.pending.delete(proposalId);
    const result=this.rejected(reason,proposal.action,proposal.sampleId,proposal);
    return {...result,accepted:false,proposalId,updatedParameterNames:[],rollbackAvailable:Boolean(this.state.rollbackByAction[proposal.action])};
  }

  rollback(action:ActionKind,currentWeights:number[],currentBias:number):{
    rolledBack:boolean;reason:string;weights:number[]|null;bias:number|null;sampleId:string|null;
  } {
    const snapshot=this.state.rollbackByAction[action];
    if(!snapshot)return {rolledBack:false,reason:'rollback-not-available',weights:null,bias:null,sampleId:null};
    if(!sameVector(currentWeights,snapshot.expectedWeights)||!Object.is(currentBias,snapshot.expectedBias))
      return {rolledBack:false,reason:'rollback-stale-current-policy',weights:null,bias:null,sampleId:snapshot.sampleId};
    delete this.state.rollbackByAction[action];
    this.state.rollbackCount++;
    this.state.lastProposalId=null;
    this.state.lastUpdatedParameterNames=[];
    this.state.lastReason='rollback';
    this.state.lastUpdatedAt=now();
    return {rolledBack:true,reason:'rolled-back',weights:snapshot.restoreWeights.slice(),bias:snapshot.restoreBias,sampleId:snapshot.sampleId};
  }

  rollbackAvailable(action:ActionKind):boolean{return Boolean(this.state.rollbackByAction[action]);}
}

export interface ElasticNeuralPlasticityOptionsWithGovernance extends ElasticNeuralPlasticityOptions {
  governanceCost01?:number;
}
