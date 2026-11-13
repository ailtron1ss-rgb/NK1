export type B335Phase='baseline'|'training'|'holdout'|'closed';
export interface B335ActionStat { action:string; count:number; }
export interface B335PendingDecision{tick:number;action:string;projectId:string;phase:'training'|'holdout';at:number;}
export interface B335State {
  version:1;
  phase:B335Phase;
  cycles:number;
  baselineCycles:number;
  trainingCycles:number;
  holdoutCycles:number;
  projectObservations:number;
  trainingVerifiedOutcomes:number;
  holdoutVerifiedOutcomes:number;
  holdoutActionDivergence01:number;
  strategyRetention01:number;
  projectContinuity01:number;
  eligible:boolean;
  reason:string;
  projectId:string|null;
  baselineActions:B335ActionStat[];
  holdoutActions:B335ActionStat[];
  pendingDecisions:B335PendingDecision[];
  outcomeReceipts:string[];
  lastOutcomeTick:number;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const increment=(rows:B335ActionStat[],action:string)=>{
  const r=rows.find(x=>x.action===action);
  if(r) r.count++;
  else rows.push({action,count:1});
};
const distribution=(rows:B335ActionStat[])=>{
  const total=Math.max(1,rows.reduce((s,r)=>s+r.count,0));
  return new Map(rows.map(r=>[r.action,r.count/total] as const));
};
export const defaultB335State=():B335State=>({version:1,phase:'baseline',cycles:0,baselineCycles:0,trainingCycles:0,holdoutCycles:0,projectObservations:0,trainingVerifiedOutcomes:0,holdoutVerifiedOutcomes:0,holdoutActionDivergence01:0,strategyRetention01:0,projectContinuity01:0,eligible:false,reason:'phase-not-complete',projectId:null,baselineActions:[],holdoutActions:[],pendingDecisions:[],outcomeReceipts:[],lastOutcomeTick:-1});

export class B335AutonomousProjectHoldoutGate {
  private state=defaultB335State();
  restore(raw?:Partial<B335State>|null){
    const d=defaultB335State(),r=raw??{};
    const pendingDecisions=Array.isArray(r.pendingDecisions)
      ? r.pendingDecisions.filter((entry):entry is B335PendingDecision=>Boolean(entry)
        &&Number.isSafeInteger(entry.tick)&&entry.tick>=0
        &&typeof entry.action==='string'&&entry.action.length>0&&entry.action.length<=64
        &&typeof entry.projectId==='string'&&entry.projectId.length>0&&entry.projectId.length<=160
        &&(entry.phase==='training'||entry.phase==='holdout')
        &&typeof entry.at==='number'&&Number.isFinite(entry.at)&&entry.at>=0)
        .slice(-32).map(entry=>({...entry}))
      : [];
    const outcomeReceipts=Array.isArray(r.outcomeReceipts)
      ? r.outcomeReceipts.filter((entry):entry is string=>typeof entry==='string'&&entry.length>0&&entry.length<=200).slice(-128)
      : [];
    this.state={...d,...r,version:1,
      baselineActions:Array.isArray(r.baselineActions)?structuredClone(r.baselineActions).slice(0,32):[],
      holdoutActions:Array.isArray(r.holdoutActions)?structuredClone(r.holdoutActions).slice(0,32):[],
      pendingDecisions,outcomeReceipts,
      lastOutcomeTick:Number.isSafeInteger(r.lastOutcomeTick)&&Number(r.lastOutcomeTick)>=-1?Number(r.lastOutcomeTick):-1};
  }
  snapshot(){return structuredClone(this.state);}
  setPhase(phase:B335Phase){this.state.phase=phase;this.state.eligible=false;this.state.reason='phase-not-complete';}
  observe(input:{tick:number;at:number;projectId?:string|null;projectActive:boolean;externalInput:boolean;autonomous:boolean;contextKey:string;selectedAction:string|null}):void{
    this.state.cycles++;
    if(!this.state.projectId&&input.projectId)this.state.projectId=input.projectId;
    if(input.projectActive&&input.projectId===this.state.projectId)this.state.projectObservations++;
    const autonomousSelection=input.autonomous&&!input.externalInput&&Boolean(input.selectedAction);
    if(this.state.phase==='baseline'){
      this.state.baselineCycles++;
      if(autonomousSelection)increment(this.state.baselineActions,input.selectedAction!);
      return;
    }
    if(this.state.phase==='training')this.state.trainingCycles++;
    else if(this.state.phase==='holdout'){
      this.state.holdoutCycles++;
      if(autonomousSelection)increment(this.state.holdoutActions,input.selectedAction!);
    }
    if((this.state.phase==='training'||this.state.phase==='holdout')
      &&autonomousSelection&&input.projectActive&&input.projectId&&input.projectId===this.state.projectId){
      const pending:B335PendingDecision={tick:input.tick,action:input.selectedAction!,projectId:input.projectId,phase:this.state.phase,at:input.at};
      this.state.pendingDecisions=[...this.state.pendingDecisions.filter(item=>item.tick!==pending.tick||item.projectId!==pending.projectId),pending].slice(-32);
    }
    if(this.state.phase==='holdout')this.recomputeEligibility(input.projectActive,input.projectId??null);
    void input.contextKey;
  }
  recordVerifiedOutcome(input:{tick:number;action:string;success01:number;verified:boolean}):boolean{
    if(input.verified!==true||!Number.isSafeInteger(input.tick)||input.tick<0
      ||typeof input.action!=='string'||input.action.length===0||input.action.length>64
      ||typeof input.success01!=='number'||!Number.isFinite(input.success01)||input.success01<0||input.success01>1)return false;
    const pending=this.state.pendingDecisions.find(item=>item.tick===input.tick&&item.action===input.action);
    if(!pending||pending.projectId!==this.state.projectId)return false;
    const receiptKey=`${pending.tick}:${pending.action}:${pending.projectId}:${pending.phase}`;
    if(input.tick<=this.state.lastOutcomeTick||this.state.outcomeReceipts.includes(receiptKey))return false;
    if(pending.phase==='training')this.state.trainingVerifiedOutcomes++;
    else this.state.holdoutVerifiedOutcomes++;
    this.state.pendingDecisions=this.state.pendingDecisions.filter(item=>item!==pending);
    this.state.outcomeReceipts=[...this.state.outcomeReceipts,receiptKey].slice(-128);
    this.state.lastOutcomeTick=input.tick;
    this.recomputeEligibility(true,pending.projectId);
    return true;
  }
  private recomputeEligibility(projectActive:boolean,projectId:string|null){
    if(this.state.phase!=='holdout')return;
    const b=distribution(this.state.baselineActions),h=distribution(this.state.holdoutActions);
    const keys=new Set([...b.keys(),...h.keys()]);
    let l1=0;for(const key of keys)l1+=Math.abs((b.get(key)??0)-(h.get(key)??0));
    this.state.holdoutActionDivergence01=clamp(l1/2);
    const trained=this.state.trainingVerifiedOutcomes>=3;
    this.state.projectContinuity01=clamp(this.state.projectObservations/Math.max(1,this.state.cycles));
    const retained=projectActive&&Boolean(projectId&&this.state.projectId&&projectId===this.state.projectId);
    this.state.strategyRetention01=retained?1:0;
    const enoughHoldout=this.state.holdoutCycles>=4&&this.state.holdoutVerifiedOutcomes>=2;
    this.state.eligible=trained&&enoughHoldout&&this.state.strategyRetention01>=1&&this.state.holdoutActionDivergence01>.05;
    this.state.reason=this.state.eligible?'autonomous-project-holdout-transfer-observed':!trained?'insufficient-training-evidence':!enoughHoldout?'insufficient-holdout-evidence':this.state.strategyRetention01<1?'project-not-continuous-in-holdout':'no-behavioral-shift-in-holdout';
  }
  diagnostics(){return{...this.snapshot(),evaluation:{eligible:this.state.eligible,reason:this.state.reason,holdoutActionDivergence01:this.state.holdoutActionDivergence01,strategyRetention01:this.state.strategyRetention01}};}
}
