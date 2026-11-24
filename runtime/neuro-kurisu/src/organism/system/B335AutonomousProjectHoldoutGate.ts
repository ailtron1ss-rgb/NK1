export type B335Phase='baseline'|'training'|'holdout'|'closed';
export interface B335ActionStat { action:string; count:number; }
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
export const defaultB335State=():B335State=>({version:1,phase:'baseline',cycles:0,baselineCycles:0,trainingCycles:0,holdoutCycles:0,projectObservations:0,trainingVerifiedOutcomes:0,holdoutVerifiedOutcomes:0,holdoutActionDivergence01:0,strategyRetention01:0,projectContinuity01:0,eligible:false,reason:'phase-not-complete',projectId:null,baselineActions:[],holdoutActions:[]});

export class B335AutonomousProjectHoldoutGate {
  private state=defaultB335State();
  restore(raw?:Partial<B335State>|null){
    const d=defaultB335State(),r=raw??{};
    this.state={...d,...r,version:1,baselineActions:Array.isArray(r.baselineActions)?structuredClone(r.baselineActions).slice(0,32):[],holdoutActions:Array.isArray(r.holdoutActions)?structuredClone(r.holdoutActions).slice(0,32):[]};
  }
  snapshot(){return structuredClone(this.state);}
  setPhase(phase:B335Phase){this.state.phase=phase;this.state.eligible=false;this.state.reason='phase-not-complete';}
  observe(input:{projectId?:string|null;projectActive:boolean;contextKey:string;selectedAction:string|null;outcome01:number|null;verifiedOutcome:boolean}):void{
    this.state.cycles++;
    if(input.projectId)this.state.projectId=input.projectId;
    if(input.projectActive)this.state.projectObservations++;
    if(this.state.phase==='baseline'){
      this.state.baselineCycles++;
      if(input.selectedAction)increment(this.state.baselineActions,input.selectedAction);
      return;
    }
    if(this.state.phase==='training'){
      this.state.trainingCycles++;
      if(input.verifiedOutcome)this.state.trainingVerifiedOutcomes++;
      return;
    }
    if(this.state.phase==='holdout'){
      this.state.holdoutCycles++;
      if(input.selectedAction)increment(this.state.holdoutActions,input.selectedAction);
      if(input.verifiedOutcome)this.state.holdoutVerifiedOutcomes++;
      const b=distribution(this.state.baselineActions),h=distribution(this.state.holdoutActions);
      const keys=new Set([...b.keys(),...h.keys()]);
      let l1=0; for(const k of keys)l1+=Math.abs((b.get(k)??0)-(h.get(k)??0));
      this.state.holdoutActionDivergence01=clamp(l1/2);
      const trained=this.state.trainingVerifiedOutcomes>=3;
      this.state.projectContinuity01=clamp(this.state.projectObservations/Math.max(1,this.state.cycles));
      const retained=input.projectActive&&Boolean(input.projectId&&(!this.state.projectId||input.projectId===this.state.projectId));
      this.state.strategyRetention01=retained?1:0;
      const enoughHoldout=this.state.holdoutCycles>=4&&this.state.holdoutVerifiedOutcomes>=2;
      this.state.eligible=trained&&enoughHoldout&&this.state.strategyRetention01>=1&&this.state.holdoutActionDivergence01>.05;
      this.state.reason=this.state.eligible?'autonomous-project-holdout-transfer-observed':!trained?'insufficient-training-evidence':!enoughHoldout?'insufficient-holdout-evidence':this.state.strategyRetention01<1?'project-not-continuous-in-holdout':'no-behavioral-shift-in-holdout';
    }
  }
  diagnostics(){return{...this.snapshot(),evaluation:{eligible:this.state.eligible,reason:this.state.reason,holdoutActionDivergence01:this.state.holdoutActionDivergence01,strategyRetention01:this.state.strategyRetention01}};}
}
