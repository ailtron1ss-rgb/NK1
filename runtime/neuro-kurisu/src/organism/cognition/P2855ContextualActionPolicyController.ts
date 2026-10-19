export type P2855ActionPolicyPhase='wake'|'quiet'|'sleepRecent'|'sleepPrior'|'transfer';

export interface P2855ContextualActionPolicyState {
  version:1;
  enabled:boolean;
  contextSlots:number;
  dimension:number;
  actionCount:number;
  prototypes:number[][];
  values:number[][];
  visits:number[];
  actionVisits:number[][];
  selections:number;
  updates:number;
  correct01:number;
  rewardEMA01:number;
  confidence01:number;
  transferAccepted:number;
  transferRejected:number;
  lastContextId:number;
  lastActionIndex:number;
  lastSimilarity01:number;
  lastPhase:P2855ActionPolicyPhase;
  memoryBytes:number;
}

const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const slot=(x:number,max:number)=>Math.max(0,Math.min(max-1,Math.floor(Number.isFinite(x)?x:0)));
const cosine=(a:number[],b:number[])=>{
  let dot=0,a2=0,b2=0;
  for(let i=0;i<16;i++){const av=Number(a[i]??0),bv=Number(b[i]??0);dot+=av*bv;a2+=av*av;b2+=bv*bv;}
  return a2>1e-9&&b2>1e-9?clamp((dot/Math.sqrt(a2*b2)+1)/2):.5;
};
const cue16=(v:number[])=>{
  const out=new Array(16).fill(0);
  if(!Array.isArray(v)||!v.length)return out;
  for(let i=0;i<16;i++){
    let sum=0,count=0;
    for(let j=i;j<v.length;j+=16){sum+=Number(v[j]??0);count++;}
    out[i]=count?clamp((sum/count+1)/2)*2-1:0;
  }
  return out;
};

export const defaultP2855ContextualActionPolicy=():P2855ContextualActionPolicyState=>({
  version:1,enabled:true,contextSlots:8,dimension:16,actionCount:7,
  prototypes:Array.from({length:8},()=>new Array(16).fill(0)),
  values:Array.from({length:8},()=>new Array(7).fill(0)),
  visits:new Array(8).fill(0),actionVisits:Array.from({length:8},()=>new Array(7).fill(0)),
  selections:0,updates:0,correct01:.5,rewardEMA01:.5,confidence01:.2,
  transferAccepted:0,transferRejected:0,lastContextId:0,lastActionIndex:-1,lastSimilarity01:.5,lastPhase:'wake',memoryBytes:8*16*8+8*7*8+8*7*4+8*8
});

export class P2855ContextualActionPolicyController{
  private state=defaultP2855ContextualActionPolicy();

  private locate(context:number,cue:number[]){
    const base=slot(context,this.state.contextSlots),v=cue16(cue);
    const baseSeen=(this.state.visits[base]??0)>0;
    if(!baseSeen)return {slot:base,similarity:.5,v};
    let best=base,bestScore=cosine(v,this.state.prototypes[base]!)*(.74+.26*Math.min(1,(this.state.visits[base]??0)/16));
    for(let s=0;s<this.state.contextSlots;s++){
      const n=this.state.visits[s]??0;
      if(n<=0||s===base)continue;
      const sim=cosine(v,this.state.prototypes[s]!);
      const score=sim*(.58+.42*Math.min(1,n/16));
      if(score>bestScore+.035){bestScore=score;best=s;}
    }
    const similarity=bestScore>=0?bestScore:.5;
    return {slot:best,similarity,v};
  }

  private phaseGain(phase:P2855ActionPolicyPhase){
    return phase==='sleepPrior'?1:phase==='sleepRecent'?.82:phase==='transfer'?.68:phase==='quiet'?.58:.52;
  }

  actionBias(context:number,actionCount:number,budget01:number,phase:P2855ActionPolicyPhase,cue:number[]=[]){
    if(!this.state.enabled)return new Array(actionCount).fill(0);
    const loc=this.locate(context,cue),values=this.state.values[loc.slot]??[];
    this.state.selections++;
    this.state.lastContextId=loc.slot;
    this.state.lastSimilarity01=loc.similarity;
    this.state.lastPhase=phase;
    const confidence=clamp((.18+.82*loc.similarity)*(.45+.55*Math.min(1,(this.state.visits[loc.slot]??0)/12)));
    this.state.confidence01=clamp(this.state.confidence01*.96+confidence*.04);
    const scale=(.055+.085*confidence)*(.55+.45*clamp(budget01))*this.phaseGain(phase);
    return Array.from({length:actionCount},(_,a)=>clamp(Math.tanh((values[a]??0)*7)*scale,-.13,.13));
  }

  readOnlyActionBias(context:number,actionCount:number,cue:number[]=[]){
    if(!this.state.enabled)return new Array(actionCount).fill(0);
    const loc=this.locate(context,cue),values=this.state.values[loc.slot]??[];
    const confidence=clamp((.18+.82*loc.similarity)*Math.min(1,(this.state.visits[loc.slot]??0)/8));
    const scale=.12*confidence;
    return Array.from({length:actionCount},(_,a)=>clamp(Math.tanh((values[a]??0)*7)*scale,-.13,.13));
  }

  observe(context:number,cue:number[],actionIndex:number,reward01:number,error01:number,verified01:number,phase:P2855ActionPolicyPhase,budget01:number){
    if(!this.state.enabled||actionIndex<0||actionIndex>=this.state.actionCount)return {contextId:0,similarity01:.5,advantage01:0,eta:0};
    const loc=this.locate(context,cue),v=loc.v,prototype=this.state.prototypes[loc.slot]!;
    const confidence=clamp((.25+.75*loc.similarity)*(.55+.45*Math.min(1,(this.state.visits[loc.slot]??0)/12)));
    const phaseScale=this.phaseGain(phase),evidence=clamp(.48*clamp(verified01)+.22*(1-clamp(error01))+.20*confidence+.10*clamp(reward01));
    const eta=clamp((.018+.032*evidence)*phaseScale*(.55+.45*clamp(budget01)),.006,.055);
    const baseline=this.state.values[loc.slot]!.reduce((a,b)=>a+b,0)/Math.max(1,this.state.actionCount);
    const advantage=clamp(reward01-.5,-.5,.5);
    const oldReward=this.state.rewardEMA01;
    for(let i=0;i<16;i++)prototype[i]=clamp((prototype[i]??0)+(v[i]-(prototype[i]??0))*eta,-1,1);
    for(let a=0;a<this.state.actionCount;a++){
      const value=this.state.values[loc.slot]![a]??0;
      const selected=a===actionIndex;
      const target=selected?clamp(advantage-value*.24,-.5,.5):clamp((baseline-value)*.035,-.08,.08);
      const alpha=eta*(selected?1:.34);
      this.state.values[loc.slot]![a]=clamp(value+target*alpha,-.45,.45);
    }
    this.state.visits[loc.slot]=Math.min(65535,(this.state.visits[loc.slot]??0)+1);
    this.state.actionVisits[loc.slot]![actionIndex]=Math.min(65535,(this.state.actionVisits[loc.slot]![actionIndex]??0)+1);
    this.state.updates++;this.state.lastActionIndex=actionIndex;this.state.lastContextId=loc.slot;this.state.lastSimilarity01=loc.similarity;this.state.lastPhase=phase;
    const predicted=this.state.values[loc.slot]![actionIndex]??0;
    const correctness=reward01>=.65?1:reward01<=.35?0:.5;
    this.state.correct01=clamp(this.state.correct01*.97+correctness*.03);
    this.state.rewardEMA01=clamp(oldReward*.94+clamp(reward01)*.06);
    this.state.confidence01=clamp(this.state.confidence01*.97+confidence*.03);
    if(loc.similarity>=.62)this.state.transferAccepted++;else this.state.transferRejected++;
    return {contextId:loc.slot,similarity01:loc.similarity,advantage01:advantage,eta,predicted01:clamp(.5+predicted*.55),baseline01:baseline};
  }

  metrics(){return {...structuredClone(this.state),memoryKB:this.state.memoryBytes/1024};}
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<P2855ContextualActionPolicyState>|null){
    const d=defaultP2855ContextualActionPolicy(),r:any=raw??{};
    const matrix=(v:any,rows:number,cols:number,fill=0)=>Array.from({length:rows},(_,i)=>Array.isArray(v?.[i])?v[i].slice(0,cols).concat(new Array(Math.max(0,cols-v[i].length)).fill(fill)).slice(0,cols):new Array(cols).fill(fill));
    this.state={...d,...structuredClone(r),version:1,enabled:r.enabled!==false,contextSlots:8,dimension:16,actionCount:7,
      prototypes:matrix(r.prototypes,8,16),values:matrix(r.values,8,7),visits:Array.from({length:8},(_,i)=>Math.max(0,Math.floor(Number(r.visits?.[i]??0)))),
      actionVisits:matrix(r.actionVisits,8,7),selections:Math.max(0,Math.floor(Number(r.selections??0))),updates:Math.max(0,Math.floor(Number(r.updates??0))),
      correct01:clamp(Number(r.correct01??d.correct01)),rewardEMA01:clamp(Number(r.rewardEMA01??d.rewardEMA01)),confidence01:clamp(Number(r.confidence01??d.confidence01)),
      transferAccepted:Math.max(0,Math.floor(Number(r.transferAccepted??0))),transferRejected:Math.max(0,Math.floor(Number(r.transferRejected??0))),
      lastContextId:slot(Number(r.lastContextId??0),8),lastActionIndex:Math.max(-1,Math.min(6,Math.floor(Number(r.lastActionIndex??-1)))),lastSimilarity01:clamp(Number(r.lastSimilarity01??.5)),
      lastPhase:(['wake','quiet','sleepRecent','sleepPrior','transfer'] as const).includes(r.lastPhase)?r.lastPhase:'wake',memoryBytes:8*16*8+8*7*8+8*7*4+8*8};
  }
}
