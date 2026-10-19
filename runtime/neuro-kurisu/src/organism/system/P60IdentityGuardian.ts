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
export class P60IdentityGuardian{
 private state=defaultP60();
 restore(raw?:Partial<P60State>|null){const d=defaultP60(),r=raw??{};this.state={...d,...r,history:Array.isArray(r.history)?r.history.slice(-96):[]};}
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
