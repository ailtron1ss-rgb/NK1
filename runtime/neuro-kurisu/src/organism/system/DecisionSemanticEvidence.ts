import type { IntentCandidate, OrganismDecisionTrace, OrganismState } from '../core/types.ts';

const finite01=(x:unknown)=>{const n=Number(x);return Number.isFinite(n)&&n>=0&&n<=1;};
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const stable=(value:unknown):unknown=>{
  if(value===null||typeof value!=='object')return value;
  if(Array.isArray(value))return value.map(stable);
  const out:Record<string,unknown>={};
  for(const key of Object.keys(value as Record<string,unknown>).sort())out[key]=stable((value as Record<string,unknown>)[key]);
  return out;
};
const hash=(value:unknown)=>{const json=JSON.stringify(stable(value));let h=2166136261;for(let i=0;i<json.length;i++){h^=json.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');};

export interface DecisionSemanticEvidence {
  version:1;
  stateBeforeHash:string;
  candidateHash:string;
  selectedHash:string;
  worldContextHash:string;
  invariant01:number;
  beforeMetrics:{predictionError:number;energy:number;cognitiveLoad:number;uncertainty:number};
  checks:{candidateScoresFinite:boolean;confidenceBounds:boolean;selectedBelongsToCandidates:boolean;worldContextPresent:boolean};
  closedAt?:number;
  stateAfterHash?:string;
  outcomeHash?:string;
  closureDelta01?:number;
}

export function buildDecisionSemanticEvidence(input:{stateBefore:OrganismState;candidates:IntentCandidate[];selected:IntentCandidate|null;worldContextKey?:string}):DecisionSemanticEvidence{
  const candidates=input.candidates.slice().sort((a,b)=>a.action.localeCompare(b.action));
  const selectedBelongs=!input.selected||input.candidates.some(c=>c.id===input.selected!.id);
  const candidateScoresFinite=input.candidates.every(c=>Number.isFinite(c.score)&&Number.isFinite(c.predictedUtility)&&Number.isFinite(c.confidence));
  const confidenceBounds=input.candidates.every(c=>finite01(c.confidence));
  const worldContextPresent=Boolean(input.worldContextKey);
  const checks={candidateScoresFinite,confidenceBounds,selectedBelongsToCandidates:selectedBelongs,worldContextPresent};
  const required=[candidateScoresFinite,confidenceBounds,selectedBelongs];
  return {version:1,stateBeforeHash:hash(input.stateBefore),candidateHash:hash(candidates.map(c=>({id:c.id,action:c.action,score:Number(c.score.toFixed(8)),confidence:Number(c.confidence.toFixed(8)),utility:Number(c.predictedUtility.toFixed(8))}))),selectedHash:hash(input.selected?{id:input.selected.id,action:input.selected.action,score:Number(input.selected.score.toFixed(8))}:null),worldContextHash:hash(input.worldContextKey??''),invariant01:required.filter(Boolean).length/required.length,beforeMetrics:{predictionError:input.stateBefore.predictionError,energy:input.stateBefore.needs.energy,cognitiveLoad:input.stateBefore.needs.cognitiveLoad,uncertainty:input.stateBefore.needs.uncertainty},checks};
}

export function closeDecisionSemanticEvidence(evidence:DecisionSemanticEvidence,stateAfter:OrganismState,outcome:unknown,createdAt:number):DecisionSemanticEvidence{
  const bm=evidence.beforeMetrics;
  const stateDrift=clamp((Math.abs(stateAfter.predictionError-bm.predictionError)+Math.abs(stateAfter.needs.energy-bm.energy)+Math.abs(stateAfter.needs.cognitiveLoad-bm.cognitiveLoad)+Math.abs(stateAfter.needs.uncertainty-bm.uncertainty))/4);
  return {...evidence,closedAt:createdAt,stateAfterHash:hash(stateAfter),outcomeHash:hash(outcome),closureDelta01:stateDrift};
}

export function verifyDecisionSemanticEvidence(trace:OrganismDecisionTrace):{pass:boolean;reasons:string[];invariants01:number}{
  const e=trace.semanticEvidence;const reasons:string[]=[];
  if(!e)reasons.push('missing-evidence');
  else{
    if(e.version!==1)reasons.push('version');
    if(!e.stateBeforeHash||!e.candidateHash||!e.selectedHash||!e.worldContextHash)reasons.push('missing-hash');
    if(e.invariant01<.999)reasons.push('invariant');
    if(e.selectedHash&&trace.selected&&e.selectedHash!==hash({id:trace.selected.id,action:trace.selected.action,score:Number(trace.selected.score.toFixed(8))}))reasons.push('selected-hash-drift');
    if(e.stateAfterHash&&!trace.stateAfter)reasons.push('after-hash-without-state');
  }
  return {pass:reasons.length===0,reasons,invariants01:e?.invariant01??0};
}


export interface OperationSemanticEvidence {
  version:1;
  operationId:string;
  owner:string;
  domain:string;
  stateBeforeHash:string;
  inputHash:string;
  expectedEffectHash:string;
  stateAfterHash?:string;
  outcomeHash?:string;
  evidenceKind:'direct'|'integration'|'persistence'|'replay'|'device'|'adversarial';
  verified:boolean;
  invariant01:number;
  openedAt:number;
  closedAt?:number;
}

export function openOperationSemanticEvidence(input:{operationId:string;owner:string;domain:string;stateBefore:unknown;input:unknown;expectedEffect:unknown;evidenceKind:OperationSemanticEvidence['evidenceKind'];invariant01?:number;openedAt?:number}):OperationSemanticEvidence{
  return {version:1,operationId:String(input.operationId),owner:String(input.owner),domain:String(input.domain),stateBeforeHash:hash(input.stateBefore),inputHash:hash(input.input),expectedEffectHash:hash(input.expectedEffect),evidenceKind:input.evidenceKind,verified:false,invariant01:clamp(input.invariant01??1),openedAt:Number(input.openedAt??Date.now())};
}

export function closeOperationSemanticEvidence(evidence:OperationSemanticEvidence,stateAfter:unknown,outcome:unknown,checks:{effectMatched:boolean;invariant01?:number;closedAt?:number}):OperationSemanticEvidence{
  const invariant=Math.min(evidence.invariant01,clamp(checks.invariant01??evidence.invariant01));
  return {...evidence,stateAfterHash:hash(stateAfter),outcomeHash:hash(outcome),verified:Boolean(checks.effectMatched)&&invariant>=.999, invariant01:invariant,closedAt:Number(checks.closedAt??Date.now())};
}

export function summarizeOperationSemanticEvidence(rows:OperationSemanticEvidence[]){
  const total=rows.length,verified=rows.filter(r=>r.verified).length; return {total,verified,verificationRate01:total?verified/total:0,domains:Object.fromEntries([...new Set(rows.map(r=>r.domain))].map(d=>[d,{total:rows.filter(r=>r.domain===d).length,verified:rows.filter(r=>r.domain===d&&r.verified).length}]))};
}
