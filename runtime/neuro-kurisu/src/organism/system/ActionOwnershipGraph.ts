export type OwnershipStage = 'b297-pre'|'b297-post'|'b291-post'|'p31-post'|'p64-post'|'governance-post'|'final';

export interface OwnershipCandidate { action:string; score:number; predictedUtility?:number; confidence?:number; }
export interface OwnershipCheckpoint { tick:number; stage:OwnershipStage; fingerprint:string; changedFromPrevious:boolean; changedCandidates:number; selectedAction:string|null; at:number; }
export interface ActionOwnershipState {
  version:1;
  cycles:number;
  mutationEvents:number;
  postB297Mutations:number;
  unauthorizedAfterFinalizer:number;
  finalOwner:string;
  lastSelectedAction:string|null;
  checkpoints:OwnershipCheckpoint[];
}

const finite=(x:unknown,f=0)=>typeof x==='number'&&Number.isFinite(x)?x:f;
const stableFingerprint=(candidates:OwnershipCandidate[])=>JSON.stringify(candidates.map(c=>[
  String(c.action),
  Number(finite(c.score)).toFixed(6),
  Number(finite(c.predictedUtility,.5)).toFixed(6),
  Number(finite(c.confidence,.5)).toFixed(6),
]));

export const defaultActionOwnershipState=():ActionOwnershipState=>({
  version:1,cycles:0,mutationEvents:0,postB297Mutations:0,unauthorizedAfterFinalizer:0,
  finalOwner:'governance-finalization',lastSelectedAction:null,checkpoints:[]
});

export class ActionOwnershipGraph {
  private state=defaultActionOwnershipState();
  private previousFingerprint:string|null=null;
  private finalFingerprint:string|null=null;
  private finalizerReached=false;

  restore(raw?:Partial<ActionOwnershipState>|null){
    const d=defaultActionOwnershipState(),r=raw??{};
    this.state={...d,...r,version:1,cycles:Math.max(0,Math.floor(Number(r.cycles??0))),mutationEvents:Math.max(0,Math.floor(Number(r.mutationEvents??0))),postB297Mutations:Math.max(0,Math.floor(Number(r.postB297Mutations??0))),unauthorizedAfterFinalizer:Math.max(0,Math.floor(Number(r.unauthorizedAfterFinalizer??0))),checkpoints:Array.isArray(r.checkpoints)?r.checkpoints.slice(-192):[],lastSelectedAction:r.lastSelectedAction??null,finalOwner:String(r.finalOwner??d.finalOwner)};
    this.previousFingerprint=null;this.finalFingerprint=null;this.finalizerReached=false;
  }
  snapshot(){return structuredClone(this.state);}
  private record(tick:number,stage:OwnershipStage,candidates:OwnershipCandidate[],selectedAction:string|null){
    const fingerprint=stableFingerprint(candidates);
    const changedFromPrevious=this.previousFingerprint!==null && fingerprint!==this.previousFingerprint;
    let changedCandidates=0;
    if(this.previousFingerprint!==null && changedFromPrevious){
      const prev=JSON.parse(this.previousFingerprint) as unknown[][];
      const cur=JSON.parse(fingerprint) as unknown[][];
      const n=Math.max(prev.length,cur.length); for(let i=0;i<n;i++) if(JSON.stringify(prev[i])!==JSON.stringify(cur[i])) changedCandidates++;
      this.state.mutationEvents++;
      if(this.finalizerReached) this.state.unauthorizedAfterFinalizer++;
      if(this.finalizerReached===false && stage!=='b297-post') this.state.postB297Mutations++;
    }
    this.state.checkpoints=[{tick,stage,fingerprint,changedFromPrevious,changedCandidates,selectedAction,at:Date.now()},...this.state.checkpoints].slice(0,192);
    this.previousFingerprint=fingerprint;this.state.lastSelectedAction=selectedAction;
    if(stage==='final'){this.finalFingerprint=fingerprint;this.finalizerReached=true;}
  }
  beginCycle(tick:number,candidates:OwnershipCandidate[]){this.state.cycles++;this.finalizerReached=false;this.finalFingerprint=null;this.previousFingerprint=null;this.record(tick,'b297-pre',candidates,null);}
  checkpoint(tick:number,stage:OwnershipStage,candidates:OwnershipCandidate[],selectedAction?:string|null){this.record(tick,stage,candidates,selectedAction??null);}
  finalize(tick:number,candidates:OwnershipCandidate[],selectedAction:string|null){this.record(tick,'final',candidates,selectedAction);}
  diagnostics(){
    const recent=this.state.checkpoints.slice(0,12);
    return {version:1,cycles:this.state.cycles,mutationEvents:this.state.mutationEvents,postB297Mutations:this.state.postB297Mutations,unauthorizedAfterFinalizer:this.state.unauthorizedAfterFinalizer,finalOwner:this.state.finalOwner,lastSelectedAction:this.state.lastSelectedAction,recentStages:recent.map(x=>({tick:x.tick,stage:x.stage,changedFromPrevious:x.changedFromPrevious,changedCandidates:x.changedCandidates,selectedAction:x.selectedAction})),pass:this.state.unauthorizedAfterFinalizer===0};
  }
}
