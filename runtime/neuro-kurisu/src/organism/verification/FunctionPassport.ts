/**
 * BIG PASS 203 — Function Passport / Semantic Proof Contract.
 *
 * A source declaration is not a capability. A capability becomes trusted only
 * when its behavioural contract, safety policy, and required evidence are all
 * satisfied by evidence tied to the exact function identity.
 */
export type ProofTier = 'static'|'direct'|'integration'|'persistence'|'replay'|'regression'|'device'|'adversarial';
export type PassportVerdict = 'VERIFIED'|'INTEGRATION_ONLY'|'UNSAFE_TO_AUTO_RUN'|'UNVERIFIED';
export type SafetyClass = 'safe'|'stateful'|'external-side-effect'|'destructive'|'unknown';

export interface ProofRequirement {
  tier:ProofTier;
  required:boolean;
  rationale:string;
}

export interface BehaviouralContract {
  preconditions:string[];
  postconditions:string[];
  invariants:string[];
  expectedEffects:string[];
  forbiddenEffects:string[];
}

export interface PassportEvidence {
  tier:ProofTier;
  ok:boolean;
  at:number;
  source:string;
  functionId:string;
  details?:string;
}

export interface FunctionPassport {
  schemaVersion:1;
  id:string;
  file:string;
  line:number;
  name:string;
  kind:'method'|'function'|'constructor'|'accessor';
  domain:string;
  criticality:number;
  exported:boolean;
  paramCount:number;
  safety:SafetyClass;
  contract:BehaviouralContract;
  proofPlan:ProofRequirement[];
  evidence:PassportEvidence[];
  verdict:PassportVerdict;
  confidence01:number;
  blockers:string[];
  staticReferences:number;
  testReferences:number;
}

const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export function requiredProofFor(safety:SafetyClass, contract:BehaviouralContract, domain:string):ProofRequirement[]{
  const req:ProofRequirement[]=[
    {tier:'direct',required:true,rationale:'The exact function must execute successfully with meaningful postcondition checks.'},
    {tier:'regression',required:true,rationale:'A repeatable regression check must protect the observed behaviour.'}
  ];
  if(safety==='stateful') req.push({tier:'persistence',required:true,rationale:'Stateful behaviour must survive the project persistence boundary or explicitly prove rollback semantics.'});
  if(contract.expectedEffects.some(x=>/replay|determin|event|causal/i.test(x))) req.push({tier:'replay',required:true,rationale:'State transitions with replayable semantics need deterministic/reconstructable evidence.'});
  if(domain==='perception' || domain==='embodiment') req.push({tier:'device',required:true,rationale:'Embodied claims need provenance showing a real sensor/device boundary, not a host simulation.'});
  if(domain==='consciousness' || domain==='self') req.push({tier:'adversarial',required:true,rationale:'High-level self/consciousness claims require intervention or lesion-style evidence, not correlation alone.'});
  return req;
}

export function derivePassportVerdict(passport:Pick<FunctionPassport,'safety'|'proofPlan'|'evidence'>):PassportVerdict{
  if(passport.safety==='destructive'||passport.safety==='external-side-effect') return 'UNSAFE_TO_AUTO_RUN';
  const good=new Set(passport.evidence.filter(e=>e.ok).map(e=>e.tier));
  const required=passport.proofPlan.filter(p=>p.required);
  const missing=required.filter(p=>!good.has(p.tier));
  if(missing.length===0) return 'VERIFIED';
  if(good.has('direct') || good.has('integration')) return 'INTEGRATION_ONLY';
  return 'UNVERIFIED';
}

export function passportConfidence(passport:Pick<FunctionPassport,'proofPlan'|'evidence'|'safety'|'criticality'>):number{
  if(passport.safety==='destructive'||passport.safety==='external-side-effect') return 0;
  const required=passport.proofPlan.filter(p=>p.required);
  if(required.length===0)return .1;
  const score=required.reduce((sum,r)=>sum+(passport.evidence.some(e=>e.ok&&e.tier===r.tier)?1:0),0)/required.length;
  const criticalityPenalty=0.85+0.15*clamp01(passport.criticality);
  return clamp01(score*criticalityPenalty);
}

export function finalizePassport<T extends FunctionPassport>(passport:T):T{
  const verdict=derivePassportVerdict(passport);
  const confidence01=passportConfidence({...passport,proofPlan:passport.proofPlan,evidence:passport.evidence,safety:passport.safety,criticality:passport.criticality});
  const good=new Set(passport.evidence.filter(e=>e.ok).map(e=>e.tier));
  const blockers=passport.proofPlan.filter(p=>p.required&&!good.has(p.tier)).map(p=>`${p.tier}: ${p.rationale}`);
  return {...passport,verdict,confidence01,blockers};
}
