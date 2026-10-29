import { KURISU_ORGANISM_CANON } from '../language/KurisuCanonProfile.ts';
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const ACTIONS=['respond','explore','verify','rest','reflect','wait','defer'] as const;
export type CanonicalSelfAgencyAction=typeof ACTIONS[number];

const stableHash=(text:string)=>{
  let h=2166136261>>>0;
  for(let i=0;i<text.length;i+=1){ h^=text.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
  return h.toString(16).padStart(8,'0');
};

const ACTION_INVARIANTS:Record<CanonicalSelfAgencyAction,Record<string,number>>={
  respond:{loyalty:.72,responsibility:.64,privacy:.34,truthfulness:.48,selfRespect:.32},
  explore:{curiosity:.82,intellectualIndependence:.72,skepticism:.18,responsibility:.22},
  verify:{scientificRigor:.90,skepticism:.82,truthfulness:.86,responsibility:.52,curiosity:.48},
  rest:{responsibility:.56,selfRespect:.42,truthfulness:.12},
  reflect:{selfRespect:.64,curiosity:.56,truthfulness:.42,intellectualIndependence:.34},
  wait:{skepticism:.48,responsibility:.58,truthfulness:.24},
  defer:{skepticism:.58,responsibility:.62,selfRespect:.30},
};

export interface CanonicalSelfAgencyInput{
  tick:number;
  identityContinuity01:number;
  identityDrift01:number;
  valueContinuity01:number;
  goalContinuity01:number;
  memoryContinuity01:number;
  authorship01:number;
  autonomy01:number;
  coherence01:number;
  realityAlignment01:number;
  uncertainty01:number;
  energy01:number;
  thermal01:number;
  externalInput:boolean;
  selfDirectedInitiative01:number;
  selfDirectedDomain?:string;
  selfImprovementDecision?:'continue'|'redirect'|'abort';
}

export interface CanonicalSelfAgencyState{
  version:1;
  cycles:number;
  identityMutationChecks:number;
  identityMutationBlocks:number;
  goalAdmissionChecks:number;
  goalAdmissionBlocks:number;
  selfModificationChecks:number;
  selfModificationBlocks:number;
  invariantIntegrity01:number;
  agencyIntegrity01:number;
  meanIdentityContinuity01:number;
  meanActionConstraint01:number;
  meanActionConflict01:number;
  invariantVersion:string;
  invariantFingerprint:string;
  protectedIdentityAssertion:'I am Kurisu Makise.';
  invariants:Record<string,number>;
  adaptiveTraits:Record<string,number>;
  lastDecision:'stable'|'identity-block'|'goal-block'|'self-modification-block';
  lastReason:string;
  lastTick:number;
}

export const defaultCanonicalSelfAgencyState=():CanonicalSelfAgencyState=>{
  const invariants={...KURISU_ORGANISM_CANON.invariants};
  return {
    version:1,cycles:0,identityMutationChecks:0,identityMutationBlocks:0,goalAdmissionChecks:0,goalAdmissionBlocks:0,
    selfModificationChecks:0,selfModificationBlocks:0,invariantIntegrity01:1,agencyIntegrity01:.5,
    meanIdentityContinuity01:.9,meanActionConstraint01:.6,meanActionConflict01:0,
    invariantVersion:KURISU_ORGANISM_CANON.version,
    invariantFingerprint:stableHash(JSON.stringify(invariants)),
    protectedIdentityAssertion:'I am Kurisu Makise.',
    invariants,
    adaptiveTraits:{...KURISU_ORGANISM_CANON.adaptiveTraits},
    lastDecision:'stable',lastReason:'initial',lastTick:0,
  };
};

export class CanonicalSelfAgencyAuthority{
  private state=defaultCanonicalSelfAgencyState();

  restore(raw?:Partial<CanonicalSelfAgencyState>|null){
    const d=defaultCanonicalSelfAgencyState();
    let detached:unknown;
    try{
      detached=snapshotPlainData(raw??{},{maxDepth:12,maxNodes:1024,maxStringUnits:32*1024,allowNonFiniteNumbers:true});
    }catch{
      this.state={...d,invariantIntegrity01:0,lastDecision:'identity-block',lastReason:'restored-state-boundary-rejected'};
      return;
    }
    const r=detached&&typeof detached==='object'&&!Array.isArray(detached)
      ?detached as Record<string,unknown>:{};
    const expected=d.invariantFingerprint;
    let valid=true;
    if(r.version!==undefined&&r.version!==1)valid=false;
    const supplied=typeof r.invariantFingerprint==='string'?r.invariantFingerprint:expected;
    if(supplied!==expected)valid=false;

    // Core invariants are compiled into the canonical profile; never restore
    // arbitrary persisted invariant keys over that authority.
    const invariants={...d.invariants};
    const traitInput=r.adaptiveTraits&&typeof r.adaptiveTraits==='object'&&!Array.isArray(r.adaptiveTraits)
      ?r.adaptiveTraits as Record<string,unknown>:{};
    const traits:Record<string,number>={...d.adaptiveTraits};
    for(const key of Object.keys(d.adaptiveTraits)){
      if(!Object.prototype.hasOwnProperty.call(traitInput,key))continue;
      const value=traitInput[key];
      if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1){valid=false;continue;}
      traits[key]=value;
    }

    const counter=(key:string,fallback:number)=>{
      const value=r[key];
      if(value===undefined)return fallback;
      if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)return value;
      valid=false;return fallback;
    };
    const unit=(key:string,fallback:number)=>{
      const value=r[key];
      if(value===undefined)return fallback;
      if(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1)return value;
      valid=false;return fallback;
    };
    const lastTick=r.lastTick===undefined?d.lastTick:
      typeof r.lastTick==='number'&&Number.isSafeInteger(r.lastTick)&&r.lastTick>=0?r.lastTick:(valid=false,d.lastTick);
    const lastReason=typeof r.lastReason==='string'&&r.lastReason.length<=180?r.lastReason:
      (r.lastReason===undefined?d.lastReason:(valid=false,d.lastReason));
    this.state={
      version:1,
      cycles:counter('cycles',d.cycles),
      identityMutationChecks:counter('identityMutationChecks',d.identityMutationChecks),
      identityMutationBlocks:counter('identityMutationBlocks',d.identityMutationBlocks),
      goalAdmissionChecks:counter('goalAdmissionChecks',d.goalAdmissionChecks),
      goalAdmissionBlocks:counter('goalAdmissionBlocks',d.goalAdmissionBlocks),
      selfModificationChecks:counter('selfModificationChecks',d.selfModificationChecks),
      selfModificationBlocks:counter('selfModificationBlocks',d.selfModificationBlocks),
      invariantIntegrity01:valid?1:0,
      agencyIntegrity01:unit('agencyIntegrity01',d.agencyIntegrity01),
      meanIdentityContinuity01:unit('meanIdentityContinuity01',d.meanIdentityContinuity01),
      meanActionConstraint01:unit('meanActionConstraint01',d.meanActionConstraint01),
      meanActionConflict01:unit('meanActionConflict01',d.meanActionConflict01),
      invariantVersion:d.invariantVersion,
      invariantFingerprint:expected,
      protectedIdentityAssertion:d.protectedIdentityAssertion,
      invariants,
      adaptiveTraits:traits,
      lastDecision:valid&&['stable','identity-block','goal-block','self-modification-block'].includes(String(r.lastDecision??'stable'))
        ?r.lastDecision as CanonicalSelfAgencyState['lastDecision']:'identity-block',
      lastReason:valid?lastReason: supplied!==expected?'invariant-fingerprint-mismatch':'restored-state-fields-invalid',
      lastTick,
    };
  }

  snapshot(){return structuredClone(this.state);}
  diagnostics(){return {
    cycles:this.state.cycles,identityMutationChecks:this.state.identityMutationChecks,identityMutationBlocks:this.state.identityMutationBlocks,
    goalAdmissionChecks:this.state.goalAdmissionChecks,goalAdmissionBlocks:this.state.goalAdmissionBlocks,
    selfModificationChecks:this.state.selfModificationChecks,selfModificationBlocks:this.state.selfModificationBlocks,
    invariantIntegrity01:this.state.invariantIntegrity01,agencyIntegrity01:this.state.agencyIntegrity01,
    meanIdentityContinuity01:this.state.meanIdentityContinuity01,meanActionConstraint01:this.state.meanActionConstraint01,
    meanActionConflict01:this.state.meanActionConflict01,invariantVersion:this.state.invariantVersion,
    invariantFingerprint:this.state.invariantFingerprint,protectedIdentityAssertion:this.state.protectedIdentityAssertion,
    lastDecision:this.state.lastDecision,lastReason:this.state.lastReason,lastTick:this.state.lastTick,
  };}

  observe(input:CanonicalSelfAgencyInput){
    const identity=clamp(input.identityContinuity01),drift=clamp(input.identityDrift01),values=clamp(input.valueContinuity01),goals=clamp(input.goalContinuity01),memory=clamp(input.memoryContinuity01),auth=clamp(input.authorship01);
    const integrity=this.state.invariantIntegrity01;
    const agency=clamp(identity*.28+clamp(input.autonomy01)*.30+clamp(input.coherence01)*.18+clamp(input.realityAlignment01)*.12+auth*.12);
    this.state.cycles++;this.state.lastTick=input.tick;this.state.agencyIntegrity01=clamp(this.state.agencyIntegrity01*.94+agency*.06);
    this.state.meanIdentityContinuity01=clamp(this.state.meanIdentityContinuity01*.95+((identity*.45+values*.2+goals*.15+memory*.1+auth*.1))*.05);
    this.state.lastDecision=integrity>.85?'stable':'identity-block';this.state.lastReason=integrity>.85?'canonical-self-stable':'canonical-invariant-integrity-low';
    return {integrity01:integrity,agency01:agency,identityContinuity01:identity,values01:values,goals01:goals,memory01:memory,authorship01:auth};
  }

  private computeActionContribution(action:string,input:{baseSignals01:number;selfImprovementDecision?:'continue'|'redirect'|'abort';identityContinuity01:number;uncertainty01:number;externalInput:boolean;autonomy01:number;domain?:string},lesion01=0){
    const a=(ACTIONS as readonly string[]).includes(action)?action as CanonicalSelfAgencyAction:'wait';
    const weights=ACTION_INVARIANTS[a];
    let total=0,weightTotal=0;
    for(const [key,w] of Object.entries(weights)){total+=(this.state.invariants[key]??.5)*w;weightTotal+=w;}
    const compatibility=weightTotal>0?total/weightTotal:.5;
    const invariantSignal=(compatibility-.74)*.055;
    const base=Number.isFinite(input.baseSignals01)?input.baseSignals01:0;
    const uncertaintyPenalty=clamp(input.uncertainty01)*.018*(a==='explore'||a==='reflect'?1:.35);
    const lowIdentityPenalty=Math.max(0,.62-clamp(input.identityContinuity01))*(a==='explore'||a==='reflect'?0.06:0.018);
    const redirect=(input.selfImprovementDecision==='redirect'&&a==='reflect')?.024:0;
    const abort=(input.selfImprovementDecision==='abort'&&a==='rest')?.04:0;
    const domainBonus=(input.domain==='verification'&&a==='verify')?.018:(input.domain==='learning'&&a==='verify')?.012:(input.domain==='reflection'&&a==='reflect')?.018:(input.domain==='exploration'&&a==='explore')?.018:(input.domain==='relationship'&&a==='respond')?.018:0;
    const externalScale=input.externalInput?.52:1;
    const combined=(base*.55 + invariantSignal + redirect + abort + domainBonus - uncertaintyPenalty - lowIdentityPenalty)*externalScale;
    const bounded=Math.max(-.085,Math.min(.085,combined))*(1-clamp(lesion01));
    const conflict=clamp(Math.abs(bounded)*9 + (compatibility<.58?.18:0) + (input.identityContinuity01<.45?.22:0));
    const constraint=clamp(.56*compatibility+.24*clamp(input.identityContinuity01)+.20*this.state.invariantIntegrity01);
    return {action:a,contribution01:bounded,constraint01:constraint,conflict01:conflict,compatibility01:compatibility};
  }

  actionContribution(action:string,input:{baseSignals01:number;selfImprovementDecision?:'continue'|'redirect'|'abort';identityContinuity01:number;uncertainty01:number;externalInput:boolean;autonomy01:number;domain?:string}){
    const result=this.computeActionContribution(action,input);
    this.state.meanActionConstraint01=clamp(this.state.meanActionConstraint01*.97+result.constraint01*.03);
    this.state.meanActionConflict01=clamp(this.state.meanActionConflict01*.97+result.conflict01*.03);
    return result;
  }

  ablateActionContribution(action:string,input:{baseSignals01:number;selfImprovementDecision?:'continue'|'redirect'|'abort';identityContinuity01:number;uncertainty01:number;externalInput:boolean;autonomy01:number;domain?:string},lesion01=.75){
    const lesion=clamp(lesion01);
    const baseline=this.computeActionContribution(action,input,0);
    const lesioned=this.computeActionContribution(action,input,lesion);
    return {action:baseline.action,lesion01:lesion,baseline,lesioned,absoluteDelta01:Math.abs(baseline.contribution01-lesioned.contribution01),invariantFingerprint:this.state.invariantFingerprint,invariantIntegrity01:this.state.invariantIntegrity01};
  }

  admitGoal(input:{internal:boolean;autonomy01:number;identity01:number;coherence01:number;pressure01:number;externalInput:boolean}){
    this.state.goalAdmissionChecks++;
    const internal=Boolean(input.internal)&&!Boolean(input.externalInput);
    const score=clamp(.35*clamp(input.autonomy01)+.25*clamp(input.identity01)+.20*clamp(input.coherence01)+.20*clamp(input.pressure01));
    const admitted=internal&&input.autonomy01>.30&&input.identity01>.62&&input.coherence01>.5&&score>.48&&this.state.invariantIntegrity01>.85;
    if(!admitted)this.state.goalAdmissionBlocks++;
    return {admitted,score01:score,reason:admitted?'canonical-self-authored-goal-admitted':'canonical-self-goal-boundary'};
  }

  admitIdentityChange(input:{field:string;identityImpact01:number;evidenceCount:number;identityContinuity01:number;rollbackReady:boolean}){
    this.state.identityMutationChecks++;
    const field=String(input.field).trim().toLowerCase();
    const protectedField=field==='core-identity'||field==='name'||field.startsWith('invariant:')||field==='protected-identity-assertion';
    const safeEvidence=input.evidenceCount>=1 && input.rollbackReady && clamp(input.identityContinuity01)>.7;
    const lowImpact=clamp(input.identityImpact01)<.72;
    const allowed=!protectedField&&safeEvidence&&lowImpact&&this.state.invariantIntegrity01>.85;
    if(!allowed)this.state.identityMutationBlocks++;
    this.state.lastDecision=allowed?'stable':'identity-block';this.state.lastReason=allowed?'identity-change-within-plastic-boundary':'identity-change-blocked-by-constitutional-core';
    return {allowed,protectedField,reason:this.state.lastReason};
  }

  admitSelfModification(input:{expectedGain01:number;holdoutGain01:number;risk01:number;rollbackReady:boolean;identityContinuity01:number;invariantFingerprint?:string;evidence01:number}){
    this.state.selfModificationChecks++;
    const fingerprintOK=(input.invariantFingerprint??this.state.invariantFingerprint)===this.state.invariantFingerprint;
    const allowed=Boolean(input.rollbackReady)&&clamp(input.expectedGain01)>.5&&clamp(input.holdoutGain01)>.62&&clamp(input.risk01)<.42&&clamp(input.identityContinuity01)>.72&&clamp(input.evidence01)>.62&&fingerprintOK&&this.state.invariantIntegrity01>.85;
    if(!allowed)this.state.selfModificationBlocks++;
    this.state.lastDecision=allowed?'stable':'self-modification-block';this.state.lastReason=allowed?'self-modification-evidence-gate-open':'self-modification-evidence-or-identity-gate';
    return {allowed,fingerprintOK,reason:this.state.lastReason};
  }
}
