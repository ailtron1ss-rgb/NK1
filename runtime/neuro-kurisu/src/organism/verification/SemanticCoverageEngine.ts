/**
 * BIG PASS 160 — Semantic Coverage Engine.
 * Evidence-first verification primitives. Source existence is never treated
 * as behavioural proof.
 */
export type SemanticStatus = 'VERIFIED'|'INTEGRATION_ONLY'|'UNSAFE_TO_AUTO_RUN'|'UNVERIFIED';
export type EvidenceKind = 'static'|'direct'|'integration'|'persistence'|'replay'|'regression'|'device'|'adversarial';
export type SafetyClass = 'safe'|'stateful'|'external-side-effect'|'destructive'|'unknown';
export interface SemanticEvidence { kind:EvidenceKind; ok:boolean; at:number; source:string; details?:string; }
export interface FunctionContract {
  id:string; file:string; name:string; kind:'method'|'function'|'constructor'|'accessor';
  line:number; paramCount:number; exported:boolean; safety:SafetyClass; contract:string;
  expectedEffects:string[]; evidence:SemanticEvidence[]; status:SemanticStatus;
  staticReferences:number; testReferences:number;
}
export interface BehavioralTrace { contractId:string; startedAt:number; endedAt:number; ok:boolean; before?:unknown; after?:unknown; observedEffects:string[]; error?:string; }
export interface CoverageSummary { total:number; verified:number; integrationOnly:number; unsafe:number; unverified:number; proofRate01:number; }
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export function deriveSemanticStatus(c:Pick<FunctionContract,'evidence'|'safety'>):SemanticStatus{
  if(c.safety==='destructive'||c.safety==='external-side-effect')return'UNSAFE_TO_AUTO_RUN';
  const ok=new Set(c.evidence.filter(e=>e.ok).map(e=>e.kind));
  if(ok.has('direct')&&(ok.has('regression')||ok.has('integration'))&&(ok.has('persistence')||ok.has('replay')))return'VERIFIED';
  if(ok.has('integration')||ok.has('direct'))return'INTEGRATION_ONLY';
  return'UNVERIFIED';
}
export function makeFunctionContract(input:Omit<FunctionContract,'status'>):FunctionContract{const c={...input,status:'UNVERIFIED' as SemanticStatus};c.status=deriveSemanticStatus(c);return c;}
export function summarizeContracts(cs:FunctionContract[]):CoverageSummary{
  const total=cs.length,verified=cs.filter(c=>c.status==='VERIFIED').length,integrationOnly=cs.filter(c=>c.status==='INTEGRATION_ONLY').length,unsafe=cs.filter(c=>c.status==='UNSAFE_TO_AUTO_RUN').length,unverified=cs.filter(c=>c.status==='UNVERIFIED').length;
  return{total,verified,integrationOnly,unsafe,unverified,proofRate01:total?clamp01((verified+integrationOnly*.35)/total):0};
}
