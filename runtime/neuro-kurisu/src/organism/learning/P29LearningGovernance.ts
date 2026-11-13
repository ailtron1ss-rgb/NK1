import type { ActionKind } from '../core/types.ts';

const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clampSigned=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const fin=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:typeof v==='string'&&v.trim().length?Number(v):NaN;return Number.isFinite(n)?n:(Number.isFinite(f)?f:0);};
const now=()=>Date.now();

export interface LearningContribution {
  source:string;
  bias:number;
  confidence01:number;
  trust01?:number;
  cost01?:number;
  kind?:'policy'|'world'|'plasticity'|'information'|'adaptive';
}

export interface LearningArbitrationResult {
  netBias:number;
  accepted:boolean;
  conflict01:number;
  budgetScale01:number;
  dominantSource:string|null;
  weightedContributions:Array<{source:string;weighted:number;effectiveTrust01:number}>;
}

export interface LearningGovernanceState {
  version:1;
  cycles:number;
  acceptedUpdates:number;
  rejectedUpdates:number;
  conflictEvents:number;
  trustBySource:Record<string,number>;
  sourceSuccess:Record<string,{samples:number;meanReward01:number;meanDelta01:number}>;
  resourceBudget:{limit01:number;spent01:number;lastCost01:number;lastAt:number};
  lastArbitration:LearningArbitrationResult|null;
  lastByAction:Partial<Record<ActionKind,LearningArbitrationResult>>;
  lastAction:ActionKind|null;
  provenance:Array<{id:string;source:string;action:ActionKind|null;reason:string;evidence:string[];trust01:number;cost01:number;accepted:boolean;at:number}>;
  continual:{tasks:Record<string,{samples:number;best01:number;last01:number;at:number}>;forgetting01:number;retention01:number;lastTask:string|null};
  rollback:{generation:number;available:boolean;capturedAt:number;previousCapturedAt:number;lastReason:string};
}

export const defaultP29Governance=():LearningGovernanceState=>({
  version:1,cycles:0,acceptedUpdates:0,rejectedUpdates:0,conflictEvents:0,
  trustBySource:{'p23':.72,'p26-policy':.82,'p27-world':.78,'p28-plasticity':.76,'p28-information':.62,'adaptive':.65},
  sourceSuccess:{},
  resourceBudget:{limit01:.82,spent01:0,lastCost01:0,lastAt:0},
  lastArbitration:null,lastByAction:{},lastAction:null,provenance:[],
  continual:{tasks:{},forgetting01:0,retention01:1,lastTask:null},
  rollback:{generation:0,available:false,capturedAt:0,previousCapturedAt:0,lastReason:''},
});

type SnapshotBundle={p26:any;p27:any;p28:any};

export class P29LearningGovernanceEngine {
  private state=defaultP29Governance();
  private currentGood:SnapshotBundle|null=null;
  private previousGood:SnapshotBundle|null=null;

  restore(raw?:Partial<LearningGovernanceState>|null){
    const d=defaultP29Governance();
    const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw as unknown as Record<string,unknown>:{};
    const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    const obj=(v:unknown):Record<string,unknown>=>(v&&typeof v==='object')?v as Record<string,unknown>:{};
    const budget=obj(read('resourceBudget'));
    const rollback=obj(read('rollback'));
    const continual=obj(read('continual'));
    const trustBySource:Record<string,number>={};
    for(const [k,v] of Object.entries(obj(read('trustBySource'))))trustBySource[k.slice(0,64)]=clamp01(fin(v,.5));
    const sourceSuccess:LearningGovernanceState['sourceSuccess']={};
    for(const [k,v] of Object.entries(obj(read('sourceSuccess')))){const e=obj(v);sourceSuccess[k.slice(0,64)]={samples:Math.max(0,Math.floor(fin(e.samples,0))),meanReward01:clamp01(fin(e.meanReward01,.5)),meanDelta01:fin(e.meanDelta01,0)};}
    const tasks:LearningGovernanceState['continual']['tasks']={};
    for(const [k,v] of Object.entries(obj(continual.tasks))){const e=obj(v);tasks[k.slice(0,64)]={samples:Math.max(0,Math.floor(fin(e.samples,0))),best01:clamp01(fin(e.best01,.5)),last01:clamp01(fin(e.last01,.5)),at:Math.max(0,fin(e.at,0))};}
    this.state={
      version:1,
      cycles:Math.max(0,Math.floor(fin(read('cycles'),d.cycles))),
      acceptedUpdates:Math.max(0,Math.floor(fin(read('acceptedUpdates'),d.acceptedUpdates))),
      rejectedUpdates:Math.max(0,Math.floor(fin(read('rejectedUpdates'),d.rejectedUpdates))),
      conflictEvents:Math.max(0,Math.floor(fin(read('conflictEvents'),d.conflictEvents))),
      trustBySource:{...d.trustBySource,...trustBySource},
      sourceSuccess,
      resourceBudget:{limit01:clamp01(fin(budget.limit01,d.resourceBudget.limit01)),spent01:clamp01(fin(budget.spent01,d.resourceBudget.spent01)),lastCost01:clamp01(fin(budget.lastCost01,d.resourceBudget.lastCost01)),lastAt:Math.max(0,fin(budget.lastAt,d.resourceBudget.lastAt))},
      lastArbitration:(read('lastArbitration')&&typeof read('lastArbitration')==='object')?read('lastArbitration') as LearningGovernanceState['lastArbitration']:null,
      lastByAction:(read('lastByAction')&&typeof read('lastByAction')==='object')?read('lastByAction') as LearningGovernanceState['lastByAction']:{},
      lastAction:(read('lastAction')??null) as LearningGovernanceState['lastAction'],
      provenance:Array.isArray(read('provenance'))?(read('provenance') as unknown[]).filter((p):p is LearningGovernanceState['provenance'][number]=>Boolean(p&&typeof p==='object'&&typeof (p as Record<string,unknown>).id==='string')).slice(-256):[],
      continual:{tasks,forgetting01:clamp01(fin(continual.forgetting01,d.continual.forgetting01)),retention01:clamp01(fin(continual.retention01,d.continual.retention01)),lastTask:typeof continual.lastTask==='string'?continual.lastTask.slice(0,120):null},
      rollback:{generation:Math.max(0,Math.floor(fin(rollback.generation,d.rollback.generation))),available:Boolean(rollback.available),capturedAt:Math.max(0,fin(rollback.capturedAt,0)),previousCapturedAt:Math.max(0,fin(rollback.previousCapturedAt,0)),lastReason:typeof rollback.lastReason==='string'?rollback.lastReason.slice(0,160):''},
    };
  }

  snapshot():LearningGovernanceState{return structuredClone(this.state);}

  beginCycle(){this.state.cycles++;}

  setResourceBudget(limit01:number,spent01:number=0){
    this.state.resourceBudget.limit01=clamp01(limit01);
    this.state.resourceBudget.spent01=clamp01(spent01);
  }

  sourceTrust(source:string){return clamp01(this.state.trustBySource[source]??.5);}

  arbitrate(contributions:LearningContribution[],availableBudget01=this.state.resourceBudget.limit01,maxMagnitude=.11,action?:ActionKind):LearningArbitrationResult{
    const remainingBudget=clamp01(this.state.resourceBudget.limit01-this.state.resourceBudget.spent01);
    const budgetScale=clamp01(Math.min(availableBudget01,remainingBudget));
    const rows=contributions.filter(c=>Number.isFinite(c.bias)&&Math.abs(c.bias)>.0001).map(c=>{
      const trust=clamp01(c.trust01??this.sourceTrust(c.source));
      const conf=clamp01(c.confidence01);
      const cost=clamp01(c.cost01??.25);
      const weighted=clampSigned(c.bias)*trust*conf*(1-cost*.35);
      return {source:c.source,weighted,effectiveTrust01:trust};
    });
    const positive=rows.filter(r=>r.weighted>0).reduce((s,r)=>s+r.weighted,0);
    const negative=Math.abs(rows.filter(r=>r.weighted<0).reduce((s,r)=>s+r.weighted,0));
    const total=positive+negative;
    const conflict=total>0?clamp01((Math.min(positive,negative)*2)/total):0;
    const dominant=rows.slice().sort((a,b)=>Math.abs(b.weighted)-Math.abs(a.weighted))[0]?.source??null;
    const raw=total>0?rows.reduce((s,r)=>s+r.weighted,0)/Math.max(.35,rows.reduce((s,r)=>Math.abs(r.weighted),0)):0;
    const trustFloor=rows.length?Math.max(...rows.map(r=>r.effectiveTrust01)):.5;
    const reject = rows.length>1 && conflict>.78 && trustFloor<.9;
    const net=reject?0:Math.max(-maxMagnitude,Math.min(maxMagnitude,raw*maxMagnitude*1.9*budgetScale));
    if(conflict>.65)this.state.conflictEvents++;
    if(reject)this.state.rejectedUpdates++; else if(Math.abs(net)>.0005)this.state.acceptedUpdates++;
    const result={netBias:net,accepted:!reject && Math.abs(net)>.0005,conflict01:conflict,budgetScale01:budgetScale,dominantSource:dominant,weightedContributions:rows};
    this.state.lastArbitration=result;
    if(action) this.state.lastByAction[action]=result;
    return result;
  }

  recordOutcome(source:string,reward01:number,delta01:number,cost01:number,accepted=true){
    const r=this.state.sourceSuccess[source]??{samples:0,meanReward01:.5,meanDelta01:0};
    r.samples+=1; r.meanReward01=clamp01(r.meanReward01*.97+clamp01(reward01)*.03); r.meanDelta01=clampSigned(r.meanDelta01*.96+clampSigned(delta01)*.04);
    this.state.sourceSuccess[source]=r;
    const prior=this.sourceTrust(source);
    const rewardSignal=clamp01(reward01)*.65+clamp01(Math.abs(delta01))*.35;
    this.state.trustBySource[source]=clamp01(prior*.92+(accepted?(0.15+rewardSignal*.35):(0.02+rewardSignal*.08)));
    this.state.resourceBudget.spent01=clamp01(this.state.resourceBudget.spent01+clamp01(cost01)*.015);
    this.state.resourceBudget.lastCost01=clamp01(cost01); this.state.resourceBudget.lastAt=now();
  }

  recordProvenance(source:string,action:ActionKind|null,reason:string,evidence:string[],trust01:number,cost01:number,accepted:boolean){
    this.state.provenance=[...this.state.provenance.slice(-255),{id:`p29-${now()}-${this.state.provenance.length}`,source,action,reason,evidence:evidence.slice(0,12),trust01:clamp01(trust01),cost01:clamp01(cost01),accepted,at:now()}];
    this.state.lastAction=action;
  }

  recordContinualTask(taskId:string,score01:number){
    const id=String(taskId).slice(0,96)||'default';
    const old=this.state.continual.tasks[id]??{samples:0,best01:0,last01:0,at:0};
    old.samples+=1; old.last01=clamp01(score01); old.best01=Math.max(old.best01,old.last01); old.at=now();
    this.state.continual.tasks[id]=old; this.state.continual.lastTask=id;
    const entries=Object.values(this.state.continual.tasks);
    const forgetting=entries.length?entries.reduce((s,t)=>s+Math.max(0,t.best01-t.last01),0)/entries.length:0;
    const retention=entries.length?entries.reduce((s,t)=>s+(t.best01>0?t.last01/t.best01:1),0)/entries.length:1;
    this.state.continual.forgetting01=clamp01(forgetting); this.state.continual.retention01=clamp01(retention);
  }

  captureLastKnownGood(bundle:SnapshotBundle){
    this.previousGood=this.currentGood;
    this.currentGood=structuredClone(bundle);
    this.state.rollback={generation:this.state.rollback.generation+1,available:Boolean(this.previousGood),capturedAt:now(),previousCapturedAt:this.state.rollback.capturedAt,lastReason:'checkpoint'};
  }

  rollbackAvailable(){return Boolean(this.previousGood);}

  takeRollback(){
    if(!this.previousGood)return null;
    const target=structuredClone(this.previousGood);
    this.state.rollback={...this.state.rollback,available:Boolean(this.currentGood),lastReason:'manual-rollback',capturedAt:now()};
    this.currentGood=target;
    this.previousGood=null;
    return target;
  }

  diagnostics(){
    return {cycles:this.state.cycles,acceptedUpdates:this.state.acceptedUpdates,rejectedUpdates:this.state.rejectedUpdates,conflictEvents:this.state.conflictEvents,resourceBudget:this.state.resourceBudget,continual:this.state.continual,rollback:this.state.rollback,lastArbitration:this.state.lastArbitration,lastByAction:this.state.lastByAction,topSources:Object.entries(this.state.trustBySource).sort((a,b)=>b[1]-a[1]).slice(0,8)};
  }
}
