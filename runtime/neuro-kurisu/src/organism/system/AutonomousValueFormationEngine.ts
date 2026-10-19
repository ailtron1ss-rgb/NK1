/** BIG PASS 229 — autonomous value formation with stability/evidence gates. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export type ValueRevisionReason='experience'|'learning'|'relationship'|'self-reflection'|'protection';
export interface ValueRevision { id:string; domain:string; delta01:number; confidence01:number; reason:ValueRevisionReason; evidence01:number; reversible:boolean; at:number; }
export interface AutonomousValueState { version:1; cycles:number; revisions:number; accepted:number; rejected:number; stability01:number; meanEvidence01:number; lastDomain:string; lastDecision:'accept'|'reject'|'hold'; values:Record<string,number>; history:ValueRevision[]; }
export const defaultAutonomousValue=():AutonomousValueState=>({version:1,cycles:0,revisions:0,accepted:0,rejected:0,stability01:.82,meanEvidence01:.55,lastDomain:'none',lastDecision:'hold',values:{autonomy:.72,learning:.68,truthfulness:.86,care:.62,selfPreservation:.84,coherence:.80},history:[]});
export class AutonomousValueFormationEngine{
 private state=defaultAutonomousValue();
 restore(raw?:Partial<AutonomousValueState>|null){const d=defaultAutonomousValue(),r=raw??{};this.state={...d,...r,values:{...d.values,...(r.values??{})},history:Array.isArray(r.history)?structuredClone(r.history).slice(0,96):[],version:1};}
 snapshot(){return structuredClone(this.state);}
 evaluate(input:{at:number;domain:string;pressure01:number;evidence01:number;uncertainty01:number;identity01:number;relationship01:number;novelty01:number}):{decision:'accept'|'reject'|'hold';valueDelta01:number;stability01:number;reason:ValueRevisionReason}{
  const p=clamp(input.pressure01), e=clamp(input.evidence01), u=clamp(input.uncertainty01), id=clamp(input.identity01);
  const reason:ValueRevisionReason=input.relationship01>.66?'relationship':e>.72?'learning':u>.62?'self-reflection':p>.78?'protection':'experience';
  const candidateDelta=(p-.5)*.12*(.45+id*.55); const contradiction=e<.3 || u>.82; const supported=e>.58 && id>.45 && !contradiction;
  const decision: 'accept'|'reject'|'hold'=contradiction?'reject':supported&&Math.abs(candidateDelta)>.018?'accept':'hold';
  this.state.cycles++; this.state.lastDomain=input.domain; this.state.lastDecision=decision;
  if(decision==='accept'){const prior=this.state.values[input.domain]??.5; this.state.values[input.domain]=clamp(prior+candidateDelta); this.state.accepted++; this.state.revisions++; this.state.stability01=clamp(this.state.stability01*.97+.03*(1-Math.abs(candidateDelta)*3)); this.state.history=[{id:`val:${this.state.cycles}:${input.domain}`,domain:input.domain,delta01:candidateDelta,confidence01:clamp(e*(1-u*.45)+id*.2),reason,evidence01:e,reversible:true,at:input.at},...this.state.history].slice(0,96);}
  else if(decision==='reject') { this.state.rejected++; this.state.stability01=clamp(this.state.stability01*.985+.015*.92); }
  this.state.meanEvidence01=clamp(this.state.meanEvidence01*.94+e*.06);
  return {decision,valueDelta01:candidateDelta,stability01:this.state.stability01,reason};
 }
 summary(){return{cycles:this.state.cycles,revisions:this.state.revisions,accepted:this.state.accepted,rejected:this.state.rejected,stability01:this.state.stability01,meanEvidence01:this.state.meanEvidence01,values:{...this.state.values},lastDecision:this.state.lastDecision};}
}
