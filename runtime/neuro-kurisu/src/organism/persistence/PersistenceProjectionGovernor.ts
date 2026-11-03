const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const fin=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:typeof v==='string'&&v.trim().length?Number(v):NaN;return Number.isFinite(n)?n:(Number.isFinite(f)?f:0);};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(fin(v,f)));
const DECISIONS:readonly PersistenceProjectionState['lastDecision'][]=['forced','pressure','interval'];

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
  /** Restore without trusting the snapshot: counts are non-negative, lastDecision validated, lastAt finite. */
  restore(raw?:Partial<PersistenceProjectionState>|null){
    const d=defaultPersistenceProjectionState(); const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw:{};
    const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    this.state={version:1,hotCheckpoints:cnt(read('hotCheckpoints'),d.hotCheckpoints),fullCheckpoints:cnt(read('fullCheckpoints'),d.fullCheckpoints),dirtyCyclesSinceFull:cnt(read('dirtyCyclesSinceFull'),d.dirtyCyclesSinceFull),lastDecision:DECISIONS.includes(read('lastDecision') as PersistenceProjectionState['lastDecision'])?read('lastDecision') as PersistenceProjectionState['lastDecision']:d.lastDecision,lastAt:Math.max(0,fin(read('lastAt'),d.lastAt))};
  }
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
