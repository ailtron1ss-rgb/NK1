const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface PersistenceProjectionDecision {
  full:boolean;
  reason:'forced'|'pressure'|'interval';
  dirtyCyclesSinceFull:number;
  fullEvery:number;
}

export interface PersistenceProjectionState {
  version:1;
  hotCheckpoints:number;
  fullCheckpoints:number;
  dirtyCyclesSinceFull:number;
  lastDecision:'forced'|'pressure'|'interval';
  lastAt:number;
}

export const defaultPersistenceProjectionState=():PersistenceProjectionState=>({
  version:1, hotCheckpoints:0, fullCheckpoints:0, dirtyCyclesSinceFull:0, lastDecision:'forced', lastAt:0,
});

/**
 * Chooses a bounded persistence tier. Hot checkpoints keep the runtime durable without
 * re-snapshotting every advanced subsystem; full checkpoints periodically refresh the
 * advanced projection or accelerate when the organism is under resource pressure.
 */
export class PersistenceProjectionGovernor {
  private state=defaultPersistenceProjectionState();
  restore(raw?:Partial<PersistenceProjectionState>|null){ this.state={...defaultPersistenceProjectionState(),...(raw??{})}; }
  decide(input:{force:boolean;baseEvery:number;pressure01?:number;at?:number}):PersistenceProjectionDecision{
    const baseEvery=Math.max(1,Math.floor(input.baseEvery));
    const pressure=clamp(input.pressure01??0);
    const fullEvery=pressure>=.88?2:pressure>=.74?3:baseEvery;
    const nextDirty=this.state.dirtyCyclesSinceFull+1;
    const reason:PersistenceProjectionDecision['reason']=input.force?'forced':pressure>=.88?'pressure':'interval';
    const full=input.force||pressure>=.88||nextDirty>=fullEvery;
    this.state.lastAt=input.at??Date.now();
    this.state.lastDecision=reason;
    if(full){this.state.fullCheckpoints++;this.state.dirtyCyclesSinceFull=0;}else{this.state.hotCheckpoints++;this.state.dirtyCyclesSinceFull=nextDirty;}
    return {full,reason,dirtyCyclesSinceFull:this.state.dirtyCyclesSinceFull,fullEvery};
  }
  snapshot(){return structuredClone(this.state);}
}
