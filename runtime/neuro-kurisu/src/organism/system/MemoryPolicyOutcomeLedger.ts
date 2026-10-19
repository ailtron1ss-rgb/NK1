const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface MemoryPolicyDecision {
  id:string;
  policy:'semantic'|'hybrid'|'causal'|'temporal'|'balanced';
  contextKey:string;
  queryHash:number;
  memoryIds:string[];
  at:number;
  hit01:number;
  computeCost01:number;
}

export interface MemoryPolicyDelayedOutcome {
  decisionId:string;
  policy:MemoryPolicyDecision['policy'];
  contextKey:string;
  quality01:number;
  retention01:number;
  transfer01:number;
  interference01:number;
  computeCost01:number;
  delayed01:number;
  reward01:number;
  causalCredit01:number;
  independentVerified:boolean;
  at:number;
}

export interface MemoryPolicyOutcomeLedgerState {
  version:1;
  registered:number;
  resolved:number;
  dropped:number;
  meanDelayedReward01:number;
  meanCausalCredit01:number;
  lastOutcome?:MemoryPolicyDelayedOutcome;
  /** Counts by evidence class; optional for snapshots written before WorkPass72. */
  verifiedResolved?:number;
  unverifiedResolved?:number;
  /** True if legacy reward means were discarded because verification provenance was absent. */
  legacyAggregatesDiscarded?:boolean;
  pending:MemoryPolicyDecision[];
}

const blank=():MemoryPolicyOutcomeLedgerState=>({version:1,registered:0,resolved:0,dropped:0,meanDelayedReward01:0,meanCausalCredit01:0,verifiedResolved:0,unverifiedResolved:0,legacyAggregatesDiscarded:false,pending:[]});
const hash=(s:string)=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const safeCount=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.floor(n)):0;};

/** Mobile-safe bridge: turns later replay evidence into a delayed policy-learning signal. */
export class MemoryPolicyOutcomeLedger {
  private state=blank();
  private readonly maxPending=128;
  private readonly maxPendingAgeMs=7*86400000;

  restore(raw?:Partial<MemoryPolicyOutcomeLedgerState>|null){
    const d=blank(),r=raw??{};
    const hasVerificationCounters=r.verifiedResolved!==undefined&&r.unverifiedResolved!==undefined&&Number.isFinite(Number(r.verifiedResolved))&&Number.isFinite(Number(r.unverifiedResolved));
    const legacyAggregatesDiscarded=Boolean(r.legacyAggregatesDiscarded)||(!hasVerificationCounters&&(Number(r.meanDelayedReward01??0)!==0||Number(r.meanCausalCredit01??0)!==0));
    this.state={...d,...r,version:1,registered:safeCount(r.registered),resolved:safeCount(r.resolved),dropped:safeCount(r.dropped),meanDelayedReward01:hasVerificationCounters?clamp(Number(r.meanDelayedReward01??0)):0,meanCausalCredit01:hasVerificationCounters?clamp(Number(r.meanCausalCredit01??0)):0,verifiedResolved:safeCount(r.verifiedResolved),unverifiedResolved:safeCount(r.unverifiedResolved),legacyAggregatesDiscarded,pending:Array.isArray(r.pending)?r.pending.slice(-this.maxPending).map(x=>this.cleanDecision(x)):[]};
  }
  snapshot(){return structuredClone(this.state);}
  diagnostics(){return {version:1,registered:this.state.registered,resolved:this.state.resolved,verifiedResolved:this.state.verifiedResolved??0,unverifiedResolved:this.state.unverifiedResolved??0,dropped:this.state.dropped,pending:this.state.pending.length,resolveRate01:clamp(this.state.resolved/Math.max(1,this.state.registered)),rewardEvidenceScope:'independently-verified-only' as const,legacyAggregatesDiscarded:Boolean(this.state.legacyAggregatesDiscarded),meanDelayedReward01:this.state.meanDelayedReward01,meanCausalCredit01:this.state.meanCausalCredit01,lastOutcome:this.state.lastOutcome?structuredClone(this.state.lastOutcome):null};}

  register(input:{policy:MemoryPolicyDecision['policy'];contextKey:string;query:string;memoryIds:string[];at?:number;hit01?:number;computeCost01?:number}){
    const at=Number.isFinite(input.at)?Number(input.at):Date.now();
    this.pruneStale(at);
    const decision:MemoryPolicyDecision={id:`mpd:${at}:${hash(input.query)}:${this.state.registered+1}`,policy:input.policy,contextKey:String(input.contextKey||'default').slice(0,96),queryHash:hash(input.query),memoryIds:[...new Set(input.memoryIds.map(String))].slice(0,16),at,hit01:clamp(input.hit01??(input.memoryIds.length?1:0)),computeCost01:clamp(input.computeCost01??0)};
    this.state.registered++;
    this.state.pending=[...this.state.pending,decision].slice(-this.maxPending);
    return structuredClone(decision);
  }

  resolve(input:{memoryId:string;validationAt:number;retentionScore01:number;transferPotential01:number;interferenceRisk01:number;causalCredit01:number;independentVerified:boolean;decisionId?:string}){
    const id=String(input.memoryId);
    const at=Number.isFinite(input.validationAt)?Number(input.validationAt):Date.now();
    let index=-1;
    for(let i=this.state.pending.length-1;i>=0;i--){
      const d=this.state.pending[i]!;
      if((input.decisionId?d.id===input.decisionId:d.memoryIds.includes(id))&&d.at<=at){index=i;break;}
    }
    if(index<0)return null;
    const d=this.state.pending[index]!;
    this.state.pending.splice(index,1);
    const retention=clamp(input.retentionScore01),transfer=clamp(input.transferPotential01),interference=clamp(1-input.interferenceRisk01),causal=clamp(input.causalCredit01);
    const delayed=clamp(.55*causal+.25*retention+.12*transfer+.08*interference);
    const quality=clamp(.55*d.hit01+.25*retention+.20*causal);
    const independentVerified=Boolean(input.independentVerified);
    const candidateReward=clamp(.32*quality+.18*retention+.16*transfer+.14*interference+.16*delayed-.04*d.computeCost01);
    // An unverified replay may be retained for audit, but it must never be
    // represented as policy reward. Reward aggregates are verified-only.
    const reward=independentVerified?candidateReward:0;
    const outcome:MemoryPolicyDelayedOutcome={decisionId:d.id,policy:d.policy,contextKey:d.contextKey,quality01:quality,retention01:retention,transfer01:transfer,interference01:interference,computeCost01:d.computeCost01,delayed01:delayed,reward01:reward,causalCredit01:causal,independentVerified,at};
    this.state.resolved++;
    if(independentVerified){
      this.state.verifiedResolved=(this.state.verifiedResolved??0)+1;
      this.state.meanDelayedReward01=clamp(this.state.meanDelayedReward01*.92+reward*.08);
      this.state.meanCausalCredit01=clamp(this.state.meanCausalCredit01*.92+causal*.08);
    }else{
      this.state.unverifiedResolved=(this.state.unverifiedResolved??0)+1;
    }
    this.state.lastOutcome=outcome;
    return structuredClone(outcome);
  }

  private pruneStale(now:number){
    const cutoff=Math.max(0,now-this.maxPendingAgeMs);
    const before=this.state.pending.length;
    if(before===0)return;
    this.state.pending=this.state.pending.filter(d=>d.at>=cutoff);
    this.state.dropped+=before-this.state.pending.length;
  }

  private cleanDecision(x:any):MemoryPolicyDecision{return {id:String(x?.id??''),policy:['semantic','hybrid','causal','temporal','balanced'].includes(x?.policy)?x.policy:'balanced',contextKey:String(x?.contextKey??'default').slice(0,96),queryHash:Math.max(0,Number(x?.queryHash??0)),memoryIds:Array.isArray(x?.memoryIds)?x.memoryIds.map(String).slice(0,16):[],at:Math.max(0,Number(x?.at??0)),hit01:clamp(Number(x?.hit01??0)),computeCost01:clamp(Number(x?.computeCost01??0))};}
}
export const defaultMemoryPolicyOutcomeLedger=()=>new MemoryPolicyOutcomeLedger();
