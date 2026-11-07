/**
 * P60 — Identity Continuity Guardian.
 *
 * Treats identity preservation as an explicit invariant for developmental
 * changes. It is advisory in normal operation and authoritative only for the
 * promotion boundary; it never invents identity values by itself.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface P60Input {continuity01:number;drift01:number;valueContinuity01:number;goalContinuity01:number;memoryContinuity01:number;authorship01:number;candidateRisk01?:number;}
export interface P60State {version:1;checks:number;vetoes:number;nearMisses:number;meanContinuity01:number;meanStability01:number;lastDecision:'allow'|'caution'|'veto';lastReason:string;history:Array<{at:number;continuity01:number;stability01:number;decision:'allow'|'caution'|'veto';reason:string}>;}
export const defaultP60=():P60State=>({version:1,checks:0,vetoes:0,nearMisses:0,meanContinuity01:.88,meanStability01:.88,lastDecision:'allow',lastReason:'initial',history:[]});
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const C01=(v:unknown,f:number):number=>Math.max(0,Math.min(1,finN(v,f)));
const DECISIONS=['allow','caution','veto'] as const;
const decOr=(v:unknown,f:'allow'|'caution'|'veto'):'allow'|'caution'|'veto'=>(DECISIONS as readonly string[]).includes(v as string)?v as 'allow'|'caution'|'veto':f;
const str=(v:unknown,n=120):string=>typeof v==='string'?v.slice(0,n):'';
export class P60IdentityGuardian{
 private state=defaultP60();
 restore(raw?:Partial<P60State>|null){const d=defaultP60();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    const hRaw=read('history');
    const history=Array.isArray(hRaw)?hRaw.slice(-96).map((x):{at:number;continuity01:number;stability01:number;decision:'allow'|'caution'|'veto';reason:string}|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {at:cnt(r.at,0),continuity01:C01(r.continuity01,0),stability01:C01(r.stability01,0),decision:decOr(r.decision,'allow'),reason:str(r.reason)};}).filter((x):x is {at:number;continuity01:number;stability01:number;decision:'allow'|'caution'|'veto';reason:string}=>x!==null):[];
    this.state={version:1,checks:cnt(read('checks'),d.checks),vetoes:cnt(read('vetoes'),d.vetoes),nearMisses:cnt(read('nearMisses'),d.nearMisses),meanContinuity01:C01(read('meanContinuity01'),d.meanContinuity01),meanStability01:C01(read('meanStability01'),d.meanStability01),lastDecision:decOr(read('lastDecision'),d.lastDecision),lastReason:str(read('lastReason'))||d.lastReason,history};}
 snapshot(){return structuredClone(this.state);}
 evaluate(input:P60Input,at=Date.now()):'allow'|'caution'|'veto'{
  const continuity=clamp(input.continuity01),drift=clamp(input.drift01),values=clamp(input.valueContinuity01),goals=clamp(input.goalContinuity01),memory=clamp(input.memoryContinuity01),auth=clamp(input.authorship01),risk=clamp(input.candidateRisk01??0);
  const stability=clamp(continuity*.34+values*.22+goals*.16+memory*.14+auth*.14-drift*.25-risk*.20);
  let decision:'allow'|'caution'|'veto'='allow';
  if(continuity<.68||values<.62||drift>.42||risk>.6)decision='veto'; else if(continuity<.82||values<.78||goals<.7||memory<.7||drift>.24||risk>.34)decision='caution';
  this.state.checks++;if(decision==='veto')this.state.vetoes++;if(decision==='caution')this.state.nearMisses++;this.state.meanContinuity01=clamp(this.state.meanContinuity01*.96+continuity*.04);this.state.meanStability01=clamp(this.state.meanStability01*.96+stability*.04);this.state.lastDecision=decision;this.state.lastReason=decision==='veto'?'identity-invariant-breach':decision==='caution'?'identity-drift-watch':'identity-stable';this.state.history=[{at,continuity01:continuity,stability01:stability,decision,reason:this.state.lastReason},...this.state.history].slice(0,96);return decision;
 }
 summary(){return {checks:this.state.checks,vetoes:this.state.vetoes,nearMisses:this.state.nearMisses,meanContinuity01:this.state.meanContinuity01,meanStability01:this.state.meanStability01,lastDecision:this.state.lastDecision,lastReason:this.state.lastReason};}
}
