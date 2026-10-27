export type MemoryPolicyName='semantic'|'hybrid'|'causal'|'temporal'|'balanced';
export interface MemoryPolicyOutcome { quality01:number; retention01?:number; transfer01?:number; interference01?:number; computeCost01?:number; delayed01?:number; }
export interface AdaptiveMemoryPolicyState {
 version:2;
 weights:Record<MemoryPolicyName,number>;
 trials:Record<MemoryPolicyName,number>;
 reward:Record<MemoryPolicyName,number>;
 contextValue:Record<string,Record<MemoryPolicyName,number>>;
 contextTrials:Record<string,Record<MemoryPolicyName,number>>;
 cooldownUntil:number;
 lastPolicy:MemoryPolicyName;
 lastContextKey:string;
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const names:MemoryPolicyName[]=['semantic','hybrid','causal','temporal','balanced'];
const blank=()=>({semantic:0,hybrid:0,causal:0,temporal:0,balanced:0} as Record<MemoryPolicyName,number>);
const defaults=():AdaptiveMemoryPolicyState=>({version:2,weights:{semantic:.5,hybrid:.5,causal:.5,temporal:.5,balanced:.5},trials:blank(),reward:blank(),contextValue:{},contextTrials:{},cooldownUntil:0,lastPolicy:'balanced',lastContextKey:'default'});
function contextKey(c:{pressure01?:number;goal01?:number;causal01?:number;temporal01?:number;mobile?:boolean}){
 const q=(x:number|undefined)=>Math.min(3,Math.floor(clamp(x??0)*4));
 return `${q(c.pressure01)}:${q(c.goal01)}:${q(c.causal01)}:${q(c.temporal01)}:${c.mobile?'m':'g'}`;
}
/** Bounded contextual controller. It learns policy value from multi-objective outcomes, never code or memory contents. */
export class AdaptiveMemoryPolicy {
 private state=defaults();
 restore(raw?:Partial<AdaptiveMemoryPolicyState>|null){
   const d=defaults();
   const record=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
   const isPolicy=(value:unknown):value is MemoryPolicyName=>typeof value==='string'&&names.includes(value as MemoryPolicyName);
   const isContextKey=(key:string)=>key.length>0&&key.length<=96&&!['__proto__','prototype','constructor'].includes(key)&&/^[A-Za-z0-9_.:-]+$/.test(key);
   const boundedNumber=(value:unknown,mode:'unit'|'count'|'timestamp',fallback:number):number=>{
     if(typeof value!=='number'||!Number.isFinite(value))return fallback;
     return mode==='unit'?clamp(value):mode==='count'?Math.max(0,Math.min(10000,Math.floor(value))):Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Math.floor(value)));
   };
   const normalizeRow=(value:unknown,fallback:Record<MemoryPolicyName,number>,mode:'unit'|'count')=>{
     const source=record(value);
     const result={...fallback};
     for(const name of names)result[name]=boundedNumber(source[name],mode,fallback[name]);
     return result;
   };
   const source=record(raw);
   const weights=normalizeRow(source.weights,d.weights,'unit');
   const trials=normalizeRow(source.trials,d.trials,'count');
   const reward=normalizeRow(source.reward,d.reward,'unit');
   const rawContextValue=record(source.contextValue);
   const rawContextTrials=record(source.contextTrials);
   // Context keys are small opaque identifiers, never memory text. Bound the
   // persisted table to the most recent 512 accepted contexts and reject unsafe keys.
   const contextKeys=[...new Set([...Object.keys(rawContextValue),...Object.keys(rawContextTrials)].filter(isContextKey))].slice(-512);
   const contextValue:AdaptiveMemoryPolicyState['contextValue']={};
   const contextTrials:AdaptiveMemoryPolicyState['contextTrials']={};
   for(const key of contextKeys){
     contextValue[key]=normalizeRow(rawContextValue[key],blank(),'unit');
     contextTrials[key]=normalizeRow(rawContextTrials[key],blank(),'count');
   }
   const cooldownUntil=boundedNumber(source.cooldownUntil,'timestamp',d.cooldownUntil);
   const lastContextKey=typeof source.lastContextKey==='string'&&isContextKey(source.lastContextKey)?source.lastContextKey:d.lastContextKey;
   this.state={
     version:2,weights,trials,reward,contextValue,contextTrials,
     cooldownUntil,lastPolicy:isPolicy(source.lastPolicy)?source.lastPolicy:d.lastPolicy,
     lastContextKey,
   };
 }
 snapshot():AdaptiveMemoryPolicyState{return structuredClone(this.state);}
 choose(context:{pressure01?:number;goal01?:number;causal01?:number;temporal01?:number;mobile?:boolean},now=Date.now()):MemoryPolicyName{
   const key=contextKey(context); const previousContextKey=this.state.lastContextKey;
   const c={pressure01:clamp(context.pressure01??0),goal01:clamp(context.goal01??0),causal01:clamp(context.causal01??0),temporal01:clamp(context.temporal01??0)};
   const cv=this.state.contextValue[key]??blank(), ct=this.state.contextTrials[key]??blank();
   this.state.lastContextKey=key;
   // P2696: exploration is local to the context, not global. This prevents a
   // policy that happened to be sampled in another context from consuming the
   // cold-start budget and starving new context/policy pairs.
   const localLeastTried=names.find(n=>ct[n]<2);
   if(localLeastTried){this.state.lastPolicy=localLeastTried;return localLeastTried;}
   if(now<this.state.cooldownUntil && key===previousContextKey)return this.state.lastPolicy;
   let best:MemoryPolicyName='balanced',bestScore=-Infinity;
   for(const n of names){
     // P2696: contextual evidence is authoritative once observed. The previous
     // controller mixed global priors strongly enough to repeatedly select the
     // same policy across distinct contexts. Use a bounded contextual-UCB term,
     // while retaining the global value as a weak prior for cold contexts.
     const localTrials=ct[n];
     const globalTrials=this.state.trials[n];
     const localMean=localTrials>0?cv[n]:this.state.weights[n];
     const contextExplore=.24*Math.sqrt(Math.log(2+Object.values(ct).reduce((m,row)=>Math.max(m,row),0))/(1+localTrials));
     const globalExplore=.06/Math.sqrt(1+globalTrials);
     const prior=n==='causal'?c.causal01*.16:n==='temporal'?c.temporal01*.16:n==='hybrid'?(1-c.pressure01)*.12:n==='semantic'?(1-c.pressure01)*.08:c.goal01*.10;
     const score=.74*localMean+.26*this.state.weights[n]+contextExplore+globalExplore+prior;
     if(score>bestScore){bestScore=score;best=n;}
   }
   this.state.lastPolicy=best;return best;
 }
 observe(policy:MemoryPolicyName,reward:number,now=Date.now(),contextKeyOverride=this.state.lastContextKey){
   const r=clamp(reward); const n=Math.min(10000,this.state.trials[policy]+1); const old=this.state.weights[policy];
   this.state.trials[policy]=n;this.state.reward[policy]=this.state.reward[policy]+(r-this.state.reward[policy])/n;this.state.weights[policy]=clamp(old+.08*(r-old));
   const key=contextKeyOverride||'default'; const cv=this.state.contextValue[key]??blank();const ct=this.state.contextTrials[key]??blank();
   const cn=Math.min(10000,ct[policy]+1);ct[policy]=cn;cv[policy]=cv[policy]+(r-cv[policy])/cn;this.state.contextValue[key]=cv;this.state.contextTrials[key]=ct;
   this.state.cooldownUntil=now+250;
 }
 observeOutcome(policy:MemoryPolicyName,outcome:MemoryPolicyOutcome,now=Date.now(),contextKeyOverride=this.state.lastContextKey){
   const quality=clamp(outcome.quality01),retention=clamp(outcome.retention01??quality),transfer=clamp(outcome.transfer01??quality),interference=clamp(outcome.interference01??quality),cost=clamp(outcome.computeCost01??0),delayed=clamp(outcome.delayed01??quality);
   const reward=.38*quality+.18*retention+.16*transfer+.14*interference+.10*delayed-.04*cost;
   this.observe(policy,clamp(reward),now,contextKeyOverride);return clamp(reward);
 }
 diagnostics(){return {version:this.state.version,lastPolicy:this.state.lastPolicy,lastContextKey:this.state.lastContextKey,weights:{...this.state.weights},trials:{...this.state.trials},reward:{...this.state.reward},contextCount:Object.keys(this.state.contextValue).length,cooldownUntil:this.state.cooldownUntil};}
}
export const defaultAdaptiveMemoryPolicy=()=>new AdaptiveMemoryPolicy();
