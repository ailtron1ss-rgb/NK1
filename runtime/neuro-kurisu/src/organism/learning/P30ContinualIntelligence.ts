import { deflateRawSync, inflateRawSync } from 'node:zlib';
import type { ActionKind, OrganismState } from '../core/types.ts';
import { BalancedReservoirSampler, type ReservoirState } from '../system/UpstreamReplayPrimitives.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const DIM = 16;
const HORIZONS = 6;
const clamp01 = (x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clampSigned = (x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const now = ()=>Date.now();
const actionIndex=(a:ActionKind)=>Math.max(0,ACTIONS.indexOf(a));
function distance(a:number[],b:number[]){let s=0,n=Math.min(a.length,b.length);for(let i=0;i<n;i++)s+=(clamp01(a[i])-clamp01(b[i]))**2;return n?clamp01(Math.sqrt(s/n)*1.8):1;}

export interface ContinualTaskRecord {
  samples:number;
  best01:number;
  last01:number;
  previousBest01:number;
  forgetting01:number;
  retention01:number;
  transfer01:number;
  lastAt:number;
}

export interface P30TrajectoryModelState {
  version:1;
  weights:Record<ActionKind,number[][]>;
  bias:Record<ActionKind,number[]>;
  samples:number;
  updates:number;
  meanLoss01:number;
  oneStepError01:number;
  multiStepError01:number;
  maxHorizon:number;
  lastAt:number;
}

export interface P30TransferExemplar {
  id:string;
  taskId:string;
  action:ActionKind;
  features:number[];
  outcome01:number;
  count:number;
  at:number;
}

export interface P30ExperimentProposal {
  id:string;
  taskId:string;
  hypothesis:string;
  control:string;
  treatment:string;
  metric:string;
  expectedInformationGain01:number;
  estimatedCost01:number;
  priority01:number;
  status:'proposed'|'accepted'|'rejected'|'completed';
  at:number;
}

export interface P30ProvenanceNode {
  id:string;
  kind:'learning'|'observation'|'task'|'experiment'|'rollback';
  label:string;
  trust01:number;
  at:number;
}

export interface P30ProvenanceEdge { from:string; to:string; relation:string; weight01:number; }

export interface P30ContinualState {
  version:2;
  tasks:Record<string,ContinualTaskRecord>;
  trajectory:P30TrajectoryModelState;
  experiments:P30ExperimentProposal[];
  provenance:{nodes:P30ProvenanceNode[];edges:P30ProvenanceEdge[]};
  resource:{budget01:number;spent01:number;restored01:number;lastCost01:number;efficiency01:number;lastAt:number};
  rollback:{generation:number;available:boolean;capturedAt:number;compressedBytes:number;hash:string;lastReason:string;compressedBundleB64:string};
  transferExemplars:P30TransferExemplar[];
  metrics:{cycles:number;acceptedGates:number;rejectedGates:number;rollbackCount:number;experimentCount:number;trajectorySamples:number;continualChecks:number;lastGateScale01:number;lastForgetting01:number;lastRetention01:number;transferApplications:number;positiveTransferApplications:number;negativeTransferApplications:number;transferGain01:number};
  transferReservoirStreamCount:number;
  transferReservoirGroups:Record<string,ReservoirState>;
}

export const defaultP30Continual=():P30ContinualState=>{
  const weights={} as Record<ActionKind,number[][]>;
  const bias={} as Record<ActionKind,number[]>;
  for(const a of ACTIONS){weights[a]=Array.from({length:DIM},()=>new Array(DIM).fill(0));bias[a]=new Array(DIM).fill(0);}
  return {
    version:2,
    tasks:{},
    trajectory:{version:1,weights,bias,samples:0,updates:0,meanLoss01:0,oneStepError01:.5,multiStepError01:.5,maxHorizon:1,lastAt:0},
    experiments:[],
    transferExemplars:[],
    transferReservoirStreamCount:0,
    transferReservoirGroups:{},
    provenance:{nodes:[],edges:[]},
    resource:{budget01:.82,spent01:0,restored01:0,lastCost01:0,efficiency01:1,lastAt:0},
    rollback:{generation:0,available:false,capturedAt:0,compressedBytes:0,hash:'',lastReason:'',compressedBundleB64:''},
    metrics:{cycles:0,acceptedGates:0,rejectedGates:0,rollbackCount:0,experimentCount:0,trajectorySamples:0,continualChecks:0,lastGateScale01:1,lastForgetting01:0,lastRetention01:1,transferApplications:0,positiveTransferApplications:0,negativeTransferApplications:0,transferGain01:0},
  };
};

function vectorize(state:OrganismState):number[]{
  const n=state.needs;
  return [n.energy,n.cognitiveLoad,n.uncertainty,n.novelty,n.goalPressure,n.socialNeed,n.identityCoherence,state.predictionError,state.attentionBudget,state.selfPredictionError,1-n.energy,1-n.cognitiveLoad,1-n.uncertainty,1-n.novelty,1-n.goalPressure,1-n.socialNeed].map(clamp01);
}
function hashString(s:string):string{
  let h=2166136261>>>0;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  return h.toString(16).padStart(8,'0');
}
function deepClone<T>(x:T):T{return structuredClone(x);}

export class P30ContinualIntelligenceEngine {
  private state=defaultP30Continual();
  private readonly transferReservoir = new BalancedReservoirSampler<P30TransferExemplar,string>(96,(item)=>`${item.taskId}:${item.action}`,0x13579bdf);
  private lastStateVector:number[]|null=null;
  private lastAction:ActionKind|null=null;

  restore(raw?:Partial<P30ContinualState>|null){
    const d=defaultP30Continual();
    const r=raw??{};
    const tr=(r.trajectory ?? d.trajectory) as Partial<P30TrajectoryModelState>;
    const trajectory={
      ...d.trajectory,...tr,
      weights:{...d.trajectory.weights,...(tr.weights??{})},
      bias:{...d.trajectory.bias,...(tr.bias??{})},
    } as P30TrajectoryModelState;
    for(const a of ACTIONS){
      trajectory.weights[a]=Array.from({length:DIM},(_,i)=>Array.from({length:DIM},(_,j)=>clampSigned(Number(trajectory.weights[a]?.[i]?.[j]??0))));
      trajectory.bias[a]=Array.from({length:DIM},(_,i)=>clampSigned(Number(trajectory.bias[a]?.[i]??0)));
    }
    this.state={
      ...d,...r,
      version:2,
      tasks:{...d.tasks,...(r.tasks??{})},
      trajectory,
      experiments:Array.isArray(r.experiments)?r.experiments.slice(-64):[],
      transferExemplars:Array.isArray(r.transferExemplars)?r.transferExemplars.slice(-96).map((e:any)=>({id:String(e.id??''),taskId:String(e.taskId??'general'),action:(ACTIONS.includes(e.action)?e.action:'wait') as ActionKind,features:Array.isArray(e.features)?e.features.slice(0,DIM).map(clamp01):new Array(DIM).fill(.5),outcome01:clamp01(Number(e.outcome01??.5)),count:Math.max(1,Math.floor(Number(e.count??1))),at:Math.max(0,Number(e.at??0))})):[],
      transferReservoirStreamCount:Math.max(0,Math.floor(Number(r.transferReservoirStreamCount??0))),
      transferReservoirGroups:structuredClone(r.transferReservoirGroups??{}),
      provenance:{nodes:Array.isArray(r.provenance?.nodes)?r.provenance!.nodes.slice(-256):[],edges:Array.isArray(r.provenance?.edges)?r.provenance!.edges.slice(-512):[]},
      resource:{...d.resource,...(r.resource??{})},
      rollback:{...d.rollback,...(r.rollback??{})},
      metrics:{...d.metrics,...(r.metrics??{})},
    };
    this.transferReservoir.restore(this.state.transferExemplars,this.state.transferReservoirGroups,this.state.transferReservoirStreamCount);
    this.state.transferExemplars=this.transferReservoir.values();
    this.state.transferReservoirStreamCount=this.transferReservoir.streamCount();
    this.state.transferReservoirGroups=this.transferReservoir.groupStates();
  }

  snapshot():P30ContinualState{return deepClone(this.state);}

  beginCycle(){this.state.metrics.cycles++;this.state.resource.restored01=clamp01(this.state.resource.restored01+.012);this.state.resource.spent01=clamp01(Math.max(0,this.state.resource.spent01-.018));}

  private remember(kind:P30ProvenanceNode['kind'],label:string,trust01:number):string{
    const id=`p30-${kind}-${this.state.provenance.nodes.length}-${now()}`;
    this.state.provenance.nodes=[...this.state.provenance.nodes.slice(-255),{id,kind,label:String(label).slice(0,160),trust01:clamp01(trust01),at:now()}];
    return id;
  }
  private link(from:string,to:string,relation:string,weight01:number){this.state.provenance.edges=[...this.state.provenance.edges.slice(-511),{from,to,relation,weight01:clamp01(weight01)}];}

  gate(input:{action:ActionKind;candidateBias:number;confidence01:number;conflict01:number;cost01:number;learningCost01?:number;taskId?:string}):{accepted:boolean;scale01:number;reason:string;nodeId:string}{
    const cost=clamp01(input.learningCost01??input.cost01);
    const remaining=this.state.resource.budget01-this.state.resource.spent01;
    const forget=this.taskForgetting(input.taskId??input.action);
    let scale=clamp01(Math.min(1,Math.max(0,remaining+.18)));
    if(input.conflict01>.82)scale*=.35;
    if(input.confidence01<.3)scale*=.55;
    if(forget>.45)scale*=Math.max(.35,1-forget*.55);
    if(cost>.7)scale*=.72;
    const accepted=Math.abs(input.candidateBias)<.0005 || scale>.18;
    if(accepted)this.state.metrics.acceptedGates++;else this.state.metrics.rejectedGates++;
    this.state.metrics.lastGateScale01=scale;
    this.charge(cost*.018);
    const taskNode=this.remember('task',input.taskId??input.action,Math.max(.4,input.confidence01));
    const node=this.remember('learning',`${input.action}:${accepted?'accepted':'rejected'}`,input.confidence01);
    this.link(taskNode,node,'governs',scale);
    return {accepted,scale01:accepted?scale:0,reason:accepted?'continual-governance':'resource/conflict/forgetting guard',nodeId:node};
  }

  charge(cost01:number){const c=clamp01(cost01);this.state.resource.spent01=clamp01(this.state.resource.spent01+c*.05);this.state.resource.lastCost01=c;this.state.resource.efficiency01=clamp01(this.state.resource.efficiency01*.96+(1-c)*.04);this.state.resource.lastAt=now();}

  observeTrajectory(before:OrganismState,action:ActionKind,after:OrganismState,reward01:number,sharedLearningSignal01=0.5){
    const x=vectorize(before), y=vectorize(after), w=this.state.trajectory.weights[action], b=this.state.trajectory.bias[action];
    const pred=y.map((_,j)=>clamp01(.5+.5*Math.tanh((b[j]??0)+x.reduce((s,v,i)=>s+v*(w?.[j]?.[i]??0),0))));
    const err=y.map((v,i)=>v-(pred[i]??.5));
    const shared=clamp01(sharedLearningSignal01);
    const lr=(.035+shared*.02)/Math.sqrt(1+this.state.trajectory.updates/600);
    const sampleWeight=.45+.35*clamp01(reward01)+.20*shared;
    for(let j=0;j<DIM;j++){
      const deriv=Math.max(.08,2*(pred[j]??.5)*(1-(pred[j]??.5)));
      for(let i=0;i<DIM;i++)w[j][i]=clampSigned(w[j][i]+lr*err[j]*deriv*x[i]*sampleWeight);
      b[j]=clampSigned(b[j]+lr*err[j]*deriv*sampleWeight);
    }
    const loss=err.reduce((s,e)=>s+e*e,0)/DIM;
    this.state.trajectory.samples++;this.state.trajectory.updates++;this.state.trajectory.meanLoss01=clamp01(this.state.trajectory.meanLoss01*.97+loss*.03);this.state.trajectory.oneStepError01=clamp01(this.state.trajectory.oneStepError01*.97+Math.min(1,Math.sqrt(loss))*.03);this.state.trajectory.maxHorizon=Math.min(HORIZONS,Math.max(1,this.state.trajectory.maxHorizon));this.state.trajectory.lastAt=now();
    this.state.metrics.trajectorySamples=this.state.trajectory.samples;
    this.lastStateVector=y;this.lastAction=action;
    return {loss01:Math.min(1,loss),predictionError01:this.state.trajectory.oneStepError01};
  }

  predictIndependentActions(start:OrganismState,actions:ActionKind[]):{action:ActionKind;horizon:number;states:number[][];rewardProxy01:number}[]{
    const current=vectorize(start);
    return actions.map(action=>{
      const w=this.state.trajectory.weights[action];
      const b=this.state.trajectory.bias[action];
      const next=current.map((_,j)=>clamp01(.5+.5*Math.tanh((b[j]??0)+current.reduce((sum,v,i)=>sum+v*(w?.[j]?.[i]??0),0))));
      const energy=next[0]??.5,uncertainty=next[2]??.5,novelty=next[3]??.5;
      const rewardProxy=clamp01(.38*energy+.24*(1-uncertainty)+.2*novelty+.18*(1-(next[1]??.5)));
      return {action,horizon:1,states:[next],rewardProxy01:rewardProxy};
    });
  }

  predictTrajectory(start:OrganismState,actions:ActionKind[]):{horizon:number;states:number[][];rewardProxy01:number}[]{
    let current=vectorize(start);
    const out:{horizon:number;states:number[][];rewardProxy01:number}[]=[];
    for(let h=0;h<Math.min(HORIZONS,Math.max(1,actions.length));h++){
      const action=actions[h];const w=this.state.trajectory.weights[action];const b=this.state.trajectory.bias[action];
      const next=current.map((_,j)=>clamp01(.5+.5*Math.tanh((b[j]??0)+current.reduce((s,v,i)=>s+v*(w?.[j]?.[i]??0),0))));
      const energy=next[0]??.5;const uncertainty=next[2]??.5;const novelty=next[3]??.5;const rewardProxy=clamp01(.38*energy+.24*(1-uncertainty)+.2*novelty+.18*(1-(next[1]??.5)));
      out.push({horizon:h+1,states:[...out.slice(-2).flatMap(r=>r.states),next].slice(-3),rewardProxy01:rewardProxy});
      current=next;
    }
    this.state.trajectory.maxHorizon=Math.max(this.state.trajectory.maxHorizon,out.length);
    return out;
  }

  evaluateTrajectory(start:OrganismState,actions:ActionKind[],observedStates:number[][]){
    const predicted=this.predictTrajectory(start,actions);let total=0;let count=0;
    for(let i=0;i<Math.min(predicted.length,observedStates.length);i++){
      const p=predicted[i].states.at(-1)??[];const o=observedStates[i]??[];for(let j=0;j<Math.min(DIM,o.length,p.length);j++){total+=(o[j]-p[j])**2;count++;}
    }
    const err=count?Math.sqrt(total/count):1;this.state.trajectory.multiStepError01=clamp01(this.state.trajectory.multiStepError01*.8+err*.2);return {error01:err,horizon:Math.min(predicted.length,observedStates.length)};
  }

  recordTransferOutcome(taskId:string, action:ActionKind, state:OrganismState, outcome01:number){
    const id=String(taskId||'general').slice(0,96);
    const features=vectorize(state);
    const existing=this.state.transferExemplars.find(e=>e.taskId===id && e.action===action && distance(e.features,features)<.16);
    if(existing){
      existing.outcome01=clamp01(existing.outcome01*.82+clamp01(outcome01)*.18);
      existing.count=Math.min(64,existing.count+1);
      existing.features=existing.features.map((v,i)=>clamp01(v*.92+features[i]*.08));
      existing.at=now();
    } else {
      const insertion=this.transferReservoir.push({id:`tx-${id}-${action}-${now()}`,taskId:id,action,features,outcome01:clamp01(outcome01),count:1,at:now()});
      if(insertion.inserted || insertion.evictedGroup){
        this.state.transferExemplars=this.transferReservoir.values();
        this.state.transferReservoirGroups=this.transferReservoir.groupStates();
      }
    }
    this.state.transferReservoirStreamCount=this.transferReservoir.streamCount();
    return this.transferBias(state,id,action);
  }

  transferBias(state:OrganismState, taskId:string, action:ActionKind){
    const target=vectorize(state);
    const candidates=this.state.transferExemplars.filter(e=>e.taskId!==String(taskId||'general').slice(0,96) && e.action===action && e.count>=2);
    if(!candidates.length) return {bias01:0,confidence01:0,similarity01:0,sourceTaskId:null,eligible:false};
    let weighted=0,total=0,best:any=null,bestSim=0;
    for(const e of candidates){
      const sim=clamp01(1-distance(target,e.features));
      if(sim<.72) continue;
      const confidence=clamp01(Math.min(1,e.count/8)*.55+Math.abs(e.outcome01-.5)*.35+.10);
      const w=sim*confidence;
      weighted+=(e.outcome01-.5)*w; total+=w;
      if(sim>bestSim){bestSim=sim;best=e;}
    }
    if(!total) return {bias01:0,confidence01:0,similarity01:0,sourceTaskId:null,eligible:false};
    const signed=Math.max(-.035,Math.min(.035,weighted/total*.11));
    return {bias01:signed,confidence01:clamp01(total/candidates.length),similarity01:bestSim,sourceTaskId:best?.taskId??null,eligible:true};
  }

  noteTransferApplication(result:{bias01:number;eligible:boolean}){
    if(!result.eligible) return;
    this.state.metrics.transferApplications++;
    if(result.bias01>.004)this.state.metrics.positiveTransferApplications++;
    else if(result.bias01<-.004)this.state.metrics.negativeTransferApplications++;
    this.state.metrics.transferGain01=clamp01(this.state.metrics.transferGain01*.96+Math.max(0,result.bias01)*.4);
  }

  recordTaskScore(taskId:string,score01:number,state?:OrganismState,action?:ActionKind){
    const id=String(taskId||'general').slice(0,96);
    const t=this.state.tasks[id]??{samples:0,best01:0,last01:0,previousBest01:0,forgetting01:0,retention01:1,transfer01:0,lastAt:0};
    t.samples++;t.last01=clamp01(score01);t.previousBest01=t.best01;t.best01=Math.max(t.best01,t.last01);t.forgetting01=clamp01(t.best01-t.last01);t.retention01=t.best01>0?t.last01/t.best01:1;t.transfer01=t.samples>1?clamp01((t.last01-(t.previousBest01||t.last01)+.5)):.5;t.lastAt=now();this.state.tasks[id]=t;
    this.state.metrics.continualChecks++;this.state.metrics.lastForgetting01=t.forgetting01;this.state.metrics.lastRetention01=t.retention01;
    if(state && action) this.recordTransferOutcome(id,action,state,score01);
    return deepClone(t);
  }
  taskForgetting(taskId:string){return clamp01(this.state.tasks[String(taskId||'general').slice(0,96)]?.forgetting01??0);}

  proposeExperiment(input:{taskId:string;uncertainty01:number;predictionError01:number;novelty01:number;resourceBudget01:number}):P30ExperimentProposal|null{
    const need=clamp01(.42*input.uncertainty01+.38*input.predictionError01+.2*input.novelty01);
    const cost=clamp01(.12+need*.46);
    const priority=clamp01(need*.72+Math.min(1,input.resourceBudget01)*.18-cost*.1);
    if(priority<.48)return null;
    const id=`p30-exp-${now()}-${this.state.metrics.experimentCount}`;
    const p:P30ExperimentProposal={id,taskId:String(input.taskId||'general').slice(0,96),hypothesis:'Контролируемое вмешательство снизит неопределённость по выбранной задаче',control:'наблюдать без изменения стратегии',treatment:'применить альтернативный learned bias в пределах budget',metric:'holdout score / prediction error',expectedInformationGain01:need,estimatedCost01:cost,priority01:priority,status:'proposed',at:now()};
    this.state.experiments=[p,...this.state.experiments].slice(0,64);this.state.metrics.experimentCount++;const node=this.remember('experiment',p.id,need);this.link(node,this.remember('task',p.taskId,need),'targets',priority);return p;
  }

  memoryThermodynamicScore(input:{salience01:number;predictionError01:number;identity01:number;retrievalCount:number;storageCost01:number;age01:number}):number{
    const information=.3*clamp01(input.salience01)+.25*clamp01(input.predictionError01)+.25*clamp01(input.identity01)+.2*clamp01(Math.min(1,input.retrievalCount/24));
    return clamp01(information*(1-.55*clamp01(input.storageCost01))*(1-.25*clamp01(input.age01)));
  }

  captureRollback(bundle:{p26:any;p27:any;p28:any}){
    const payload=JSON.stringify(bundle);const compressed=deflateRawSync(new TextEncoder().encode(payload));
    this.state.rollback={generation:this.state.rollback.generation+1,available:true,capturedAt:now(),compressedBytes:compressed.length,hash:hashString(payload),lastReason:'known-good-before-learning',compressedBundleB64:btoa(String.fromCharCode(...compressed))};
  }
  rollbackBundle():{p26:any;p27:any;p28:any}|null{
    if(!this.state.rollback.available||!this.state.rollback.compressedBundleB64)return null;
    try{return JSON.parse(new TextDecoder().decode(inflateRawSync(Uint8Array.from(atob(this.state.rollback.compressedBundleB64),c=>c.charCodeAt(0)))));}catch{return null;}
  }
  markRollback(reason:string){this.state.rollback={...this.state.rollback,available:false,lastReason:String(reason).slice(0,160)};this.state.metrics.rollbackCount++;const node=this.remember('rollback',reason,.9);return node;}
  shouldRollback(taskId:string,score01:number):boolean{const t=this.state.tasks[String(taskId||'general').slice(0,96)];return Boolean(this.state.rollback.available&&t&&t.samples>=6&&t.best01-t.last01>=.30&&this.state.metrics.acceptedGates>0);}

  diagnostics(){return {tasks:this.state.tasks,trajectory:this.state.trajectory,resource:this.state.resource,rollback:{generation:this.state.rollback.generation,available:this.state.rollback.available,compressedBytes:this.state.rollback.compressedBytes,hash:this.state.rollback.hash,lastReason:this.state.rollback.lastReason},experiments:this.state.experiments.slice(0,16),provenance:{nodes:this.state.provenance.nodes.length,edges:this.state.provenance.edges.length},transfer:{exemplars:this.state.transferExemplars.length,applications:this.state.metrics.transferApplications,positive:this.state.metrics.positiveTransferApplications,negative:this.state.metrics.negativeTransferApplications,gain01:this.state.metrics.transferGain01},metrics:this.state.metrics};}
}
