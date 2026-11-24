import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const distance=(a:number[],b:number[])=>{
  const n=Math.min(8,Math.max(a.length,b.length));
  if(n<=0)return 0;
  let s=0;
  for(let i=0;i<n;i++){
    const d=Number(a[i]??0)-Number(b[i]??0);
    s+=d*d;
  }
  return Math.sqrt(s/n);
};

export interface VerifiedSyntheticTrajectoryStep{
  actionIndex:number;
  latent:number[];
  predictedNext:number[];
  reward01:number;
  confidence01:number;
  priority01:number;
}

export interface PendingVerifiedTrajectory{
  id:string;
  stagedTick:number;
  contextId:number;
  steps:VerifiedSyntheticTrajectoryStep[];
  confirmations:number;
  verifiedConfirmations:number;
  holdoutConfirmations:number;
  mismatches:number;
  lastObservedTick:number;
  status:'pending'|'promoted'|'rejected'|'expired';
}

export interface VerifiedSyntheticTrajectoryGateState{
  version:1;
  staged:number;
  confirmations:number;
  promotions:number;
  rejections:number;
  expirations:number;
  pending:PendingVerifiedTrajectory[];
  lastPromotionId:string|null;
  lastReason:string;
}

export interface PromotionUpdate{
  id:string;
  actionIndex:number;
  latent:number[];
  predictedNext:number[];
  gain01:number;
  confirmations:number;
  holdoutConfirmations:number;
}

export const defaultVerifiedSyntheticTrajectoryGate=():VerifiedSyntheticTrajectoryGateState=>({
  version:1,staged:0,confirmations:0,promotions:0,rejections:0,expirations:0,pending:[],lastPromotionId:null,lastReason:'init'
});

export class VerifiedSyntheticTrajectoryGate{
  private state:VerifiedSyntheticTrajectoryGateState=defaultVerifiedSyntheticTrajectoryGate();
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<VerifiedSyntheticTrajectoryGateState>|null){
    const d=defaultVerifiedSyntheticTrajectoryGate();
    const pending=Array.isArray(raw?.pending)?raw!.pending.slice(-8).map((x:any)=>({
      id:String(x?.id??''),stagedTick:Number(x?.stagedTick??0),contextId:Number(x?.contextId??0),
      steps:Array.isArray(x?.steps)?x.steps.slice(0,3).map((s:any)=>({
        actionIndex:Math.max(0,Math.min(ACTIONS.length-1,Math.floor(Number(s?.actionIndex??0)))),
        latent:Array.isArray(s?.latent)?s.latent.slice(0,8):[],predictedNext:Array.isArray(s?.predictedNext)?s.predictedNext.slice(0,8):[],
        reward01:clamp(Number(s?.reward01??.5)),confidence01:clamp(Number(s?.confidence01??0)),priority01:clamp(Number(s?.priority01??0))
      })):[],
      confirmations:Number(x?.confirmations??0),verifiedConfirmations:Number(x?.verifiedConfirmations??0),holdoutConfirmations:Number(x?.holdoutConfirmations??0),
      mismatches:Number(x?.mismatches??0),lastObservedTick:Number(x?.lastObservedTick??0),
      status:['pending','promoted','rejected','expired'].includes(x?.status)?x.status:'pending'
    })).filter(x=>x.id&&x.steps.length):[];
    this.state={...d,...(raw??{}),version:1,pending};
  }

  stage(input:{tick:number;contextId:number;steps:VerifiedSyntheticTrajectoryStep[];priority01:number;confidence01:number}):string|null{
    if(!input.steps?.length || clamp(input.priority01)<.56 || clamp(input.confidence01)<.56)return null;
    const first=input.steps[0]!;
    const id=`svt-${input.tick}-${input.contextId}-${first.actionIndex}-${Math.round(input.priority01*1000)}-${this.state.staged+1}`;
    const candidate:PendingVerifiedTrajectory={
      id,stagedTick:input.tick,contextId:Math.max(0,Math.floor(input.contextId)),
      steps:input.steps.slice(0,3).map(s=>({actionIndex:s.actionIndex,latent:s.latent.slice(0,8),predictedNext:s.predictedNext.slice(0,8),reward01:clamp(s.reward01),confidence01:clamp(s.confidence01),priority01:clamp(s.priority01)})),
      confirmations:0,verifiedConfirmations:0,holdoutConfirmations:0,mismatches:0,lastObservedTick:input.tick,status:'pending'
    };
    this.state.pending=[...this.state.pending.filter(x=>x.status==='pending'&&input.tick-x.stagedTick<=24),candidate].slice(-8);
    this.state.staged++;
    this.state.lastReason=`staged:${id}`;
    return id;
  }

  observeOutcome(input:{tick:number;action:ActionKind;reward01:number;nextLatent:number[];verified01:number;holdout01:number;contextId:number}):PromotionUpdate[]{
    const ai=ACTIONS.indexOf(input.action);
    if(ai<0)return [];
    const out:PromotionUpdate[]=[];
    const survivors:PendingVerifiedTrajectory[]=[];
    for(const candidate of this.state.pending){
      if(candidate.status!=='pending'){continue;}
      if(input.tick-candidate.stagedTick>24){candidate.status='expired';this.state.expirations++;continue;}
      const first=candidate.steps[0]!;
      const actionMatch=first.actionIndex===ai;
      const rewardMatch=Math.abs(first.reward01-clamp(input.reward01))<=.24;
      const latentMatch=distance(first.predictedNext,input.nextLatent)<=.34;
      const contextMatch=candidate.contextId===input.contextId;
      const verified=clamp(input.verified01)>=.62;
      const holdout=clamp(input.holdout01)>=.5 || (!contextMatch && actionMatch);
      const matched=actionMatch && rewardMatch && latentMatch && (contextMatch || holdout);
      candidate.lastObservedTick=input.tick;
      if(matched){
        candidate.confirmations++;
        if(verified)candidate.verifiedConfirmations++;
        if(holdout)candidate.holdoutConfirmations++;
        this.state.confirmations++;
      } else if(actionMatch || rewardMatch || latentMatch){
        candidate.mismatches++;
      } else {
        candidate.mismatches+=2;
      }
      if(candidate.confirmations>=2 && candidate.verifiedConfirmations>=1 && candidate.holdoutConfirmations>=1){
        candidate.status='promoted';
        const strength=clamp(.45*first.confidence01+.30*first.priority01+.15*(candidate.confirmations/3)+.10*(candidate.holdoutConfirmations/2));
        out.push({id:candidate.id,actionIndex:first.actionIndex,latent:first.latent.slice(),predictedNext:first.predictedNext.slice(),gain01:clamp(.0014*strength),confirmations:candidate.confirmations,holdoutConfirmations:candidate.holdoutConfirmations});
        this.state.promotions++;this.state.lastPromotionId=candidate.id;this.state.lastReason=`promoted:${candidate.id}`;
        continue;
      }
      if(candidate.mismatches>=3){candidate.status='rejected';this.state.rejections++;this.state.lastReason=`rejected:${candidate.id}`;continue;}
      survivors.push(candidate);
    }
    this.state.pending=survivors.slice(-8);
    return out;
  }

  metrics(){return {staged:this.state.staged,confirmations:this.state.confirmations,promotions:this.state.promotions,rejections:this.state.rejections,expirations:this.state.expirations,pending:this.state.pending.length,lastPromotionId:this.state.lastPromotionId,lastReason:this.state.lastReason};}
}
