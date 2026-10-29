import type { ActionKind } from '../core/types.ts';
import { KURISU_ORGANISM_CANON } from '../language/KurisuCanonProfile.ts';
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';
import { isTrustedDecisionLinkedExternalPostcondition, type ExpectedDecisionOutcomeBinding, type OutcomeVerification } from '../system/OutcomeVerificationService.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const deep=<T>(x:T):T=>structuredClone(x);

/** P2702: persistent personality dynamics. Canon is an initialization prior; experience changes
 * adaptive traits, values, relationship trust and autobiographical self-beliefs while protected
 * invariants remain bounded. This is a stateful behavioral substrate, not a dialogue prompt. */
export interface P2702PersonalityState {
 version:1; tick:number; experienceCount:number; learningUpdates:number;
 invariantNames:string[]; invariantValues:number[]; adaptiveNames:string[]; adaptiveValues:number[];
 valueNames:string[]; valueWeights:number[]; relationshipTrust:Record<string,number>;
 selfBeliefs:number[]; selfUncertainty:number[]; tensionState:number[]; actionPreference:Record<ActionKind,number>;
 stability01:number; coherence01:number; identityContinuity01:number; contradiction01:number;
 plasticity01:number; drift01:number; autobiographicalStrength01:number; lastReward01:number;
 verifiedLearningUpdates:number; rejectedLearningUpdates:number; lastEvidenceGateReason:string;
}

const defaultState=():P2702PersonalityState=>{
 const inv=Object.entries(KURISU_ORGANISM_CANON.invariants);
 const ad=Object.entries(KURISU_ORGANISM_CANON.adaptiveTraits);
 const values=['truth','science','autonomy','responsibility','privacy','loyalty','curiosity','relationship'];
 return {version:1,tick:0,experienceCount:0,learningUpdates:0,
  invariantNames:inv.map(([k])=>k),invariantValues:inv.map(([,v])=>v),
  adaptiveNames:ad.map(([k])=>k),adaptiveValues:ad.map(([,v])=>v),
  valueNames:values,valueWeights:[.98,.96,.90,.92,.84,.88,.96,.72],relationshipTrust:{},
  selfBeliefs:[.72,.68,.76,.64,.58,.70,.62,.74],selfUncertainty:new Array(8).fill(.28),
  tensionState:new Array(KURISU_ORGANISM_CANON.tensions.length).fill(.5),
  actionPreference:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,
  stability01:.86,coherence01:.78,identityContinuity01:.9,contradiction01:.08,plasticity01:.08,drift01:0,autobiographicalStrength01:.1,lastReward01:.5,
  verifiedLearningUpdates:0,rejectedLearningUpdates:0,lastEvidenceGateReason:'initial'};
};

export class P2702PersistentPersonalityDynamics{
 private state=defaultState();
 snapshot(){return deep(this.state);}
 restore(raw?:Partial<P2702PersonalityState>|null){
  const d=defaultState();
  let detached:unknown;
  try{detached=snapshotPlainData(raw??{},{maxDepth:12,maxNodes:4096,maxStringUnits:64*1024,allowNonFiniteNumbers:true});}
  catch{this.state=d;this.state.lastEvidenceGateReason='restore-boundary-rejected';return;}
  const r=detached&&typeof detached==='object'&&!Array.isArray(detached)?detached as Record<string,unknown>:{};
  const finiteUnit=(v:unknown,f:number,lo=0,hi=1)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi?v:f;
  const count=(v:unknown,f:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:f;
  const vector=(v:unknown,f:number[],lo=0,hi=1)=>!Array.isArray(v)||v.length!==f.length?[...f]:v.map((x,i)=>finiteUnit(x,f[i]!,lo,hi));
  const keyOK=(key:string)=>key.length>0&&key.length<=128&&key.trim()===key&&key.normalize('NFKC')===key&&![...key].some(ch=>{const cp=ch.codePointAt(0)??0;return cp<=31||(cp>=127&&cp<=159);});
  const relationshipTrust:Record<string,number>={};
  if(r.relationshipTrust&&typeof r.relationshipTrust==='object'&&!Array.isArray(r.relationshipTrust))for(const [k,v] of Object.entries(r.relationshipTrust as Record<string,unknown>).slice(0,32))if(keyOK(k)&&typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)relationshipTrust[k]=v;
  const names=Array.isArray(r.adaptiveNames)?r.adaptiveNames.filter((x):x is string=>typeof x==='string'):[];
  const values=Array.isArray(r.adaptiveValues)?r.adaptiveValues:[];
  const adaptiveMap=new Map<string,number>();
  for(let i=0;i<Math.min(names.length,values.length,32);i++){const k=names[i]!,v=values[i];if(keyOK(k)&&typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)adaptiveMap.set(k,v);}
  // Protected invariants and their order always come from the compiled canonical profile.
  const adaptiveValues=d.adaptiveNames.map((name,i)=>adaptiveMap.get(name)??d.adaptiveValues[i]!);
  const valueWeights=vector(r.valueWeights,d.valueWeights);
  const selfBeliefs=vector(r.selfBeliefs,d.selfBeliefs);
  const selfUncertainty=vector(r.selfUncertainty,d.selfUncertainty,.03,.97);
  const tensionState=vector(r.tensionState,d.tensionState);
  const prefs=r.actionPreference&&typeof r.actionPreference==='object'&&!Array.isArray(r.actionPreference)?r.actionPreference as Record<string,unknown>:{};
  const actionPreference={...d.actionPreference};
  for(const action of ACTIONS){const v=prefs[action];if(typeof v==='number'&&Number.isFinite(v)&&v>=-1&&v<=1)actionPreference[action]=v;}
  this.state={...d,version:1,tick:count(r.tick,d.tick),experienceCount:count(r.experienceCount,d.experienceCount),learningUpdates:count(r.learningUpdates,d.learningUpdates),
   invariantNames:[...d.invariantNames],invariantValues:[...d.invariantValues],adaptiveNames:[...d.adaptiveNames],adaptiveValues,
   valueNames:[...d.valueNames],valueWeights,relationshipTrust,selfBeliefs,selfUncertainty,tensionState,actionPreference,
   stability01:finiteUnit(r.stability01,d.stability01),coherence01:finiteUnit(r.coherence01,d.coherence01),identityContinuity01:finiteUnit(r.identityContinuity01,d.identityContinuity01),
   contradiction01:finiteUnit(r.contradiction01,d.contradiction01),plasticity01:finiteUnit(r.plasticity01,d.plasticity01),drift01:finiteUnit(r.drift01,d.drift01),
   autobiographicalStrength01:finiteUnit(r.autobiographicalStrength01,d.autobiographicalStrength01),lastReward01:finiteUnit(r.lastReward01,d.lastReward01),
   verifiedLearningUpdates:count(r.verifiedLearningUpdates,d.verifiedLearningUpdates),rejectedLearningUpdates:count(r.rejectedLearningUpdates,d.rejectedLearningUpdates),
   lastEvidenceGateReason:typeof r.lastEvidenceGateReason==='string'?r.lastEvidenceGateReason.slice(0,120):d.lastEvidenceGateReason};
 }
 beforeDecision(args:{tick:number;novelty01:number;uncertainty01:number;goalPressure01:number;identityGap01:number;reward01?:number;actionUtilities:Record<ActionKind,number>;identityVector?:number[];relationshipId?:string}){
  this.state.tick=args.tick;this.state.experienceCount++;this.state.lastReward01=clamp(args.reward01??.5);
  const tension=clamp(args.identityGap01*.5+args.uncertainty01*.3+args.novelty01*.2);
  const canonCuriosity=this.state.invariantValues[this.state.invariantNames.indexOf('curiosity')]??.96;
  const rigor=this.state.invariantValues[this.state.invariantNames.indexOf('scientificRigor')]??.95;
  const autonomy=this.state.invariantValues[this.state.invariantNames.indexOf('intellectualIndependence')]??.92;
  const responsibility=this.state.invariantValues[this.state.invariantNames.indexOf('responsibility')]??.90;
  const adaptive=(name:string)=>this.state.adaptiveValues[this.state.adaptiveNames.indexOf(name)]??.5;
  const bias:Record<ActionKind,number>=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;
  bias.explore=clamp((adaptive('curiosity')*.05+canonCuriosity*.025)*args.novelty01 + adaptive('playfulness')*.008);
  bias.verify=clamp((rigor*.05+adaptive('composure')*.015)*args.uncertainty01);
  bias.reflect=clamp((autonomy*.028+adaptive('guardedness')*.014)*args.identityGap01);
  bias.respond=clamp((adaptive('warmth')*.025+adaptive('directness')*.018)*(1-args.identityGap01));
  bias.rest=clamp((1-args.goalPressure01)*.012);
  bias.wait=clamp(args.uncertainty01*.012*(1-responsibility*.5));
  bias.defer=clamp(args.uncertainty01*.016*(1-adaptive('directness')));
  for(const a of ACTIONS)this.state.actionPreference[a]=clamp((args.actionUtilities[a]??.5)-.5);
  const selfErr=args.identityVector?.length?clamp(Math.abs((args.identityVector[0]??0)-this.state.selfBeliefs[0]!)*.8):args.identityGap01;
  this.state.contradiction01=clamp(this.state.contradiction01*.94+(selfErr*.55+tension*.45)*.06);
  this.state.identityContinuity01=clamp(this.state.identityContinuity01*.97+(1-selfErr)*.03);
  this.state.coherence01=clamp(this.state.coherence01*.95+(1-this.state.contradiction01)*.05);
  this.state.stability01=clamp(this.state.stability01*.98+(1-this.state.drift01)*.02);
  // Relationship trust is updated only from the verified outcome path below, not from decision intent alone.
  return {actionBias:bias,traitVector:this.state.adaptiveValues.slice(),valueVector:this.state.valueWeights.slice(),identityContinuity01:this.state.identityContinuity01,coherence01:this.state.coherence01,stability01:this.state.stability01,contradiction01:this.state.contradiction01};
 }
 afterOutcome(args:{tick?:number;reward01:number;verified01:number;predictionError01:number;identityGap01:number;action:ActionKind;identityVector?:number[];relationshipId?:string;evidence?:{source:'external-verification'|'internal';verification?:unknown;expectedBinding?:ExpectedDecisionOutcomeBinding;traitFeedback?:{traitName:string;target01:number;confidence01:number};valueFeedback?:{valueName:string;target01:number;confidence01:number}}}){
  const reward=clamp(args.reward01),verified=clamp(args.verified01),error=clamp(args.predictionError01);
  const evidence=args.evidence;
  let trustedVerification:OutcomeVerification|null=null;
  if(evidence?.source==='external-verification'&&evidence.expectedBinding&&isTrustedDecisionLinkedExternalPostcondition(evidence.verification,evidence.expectedBinding)){
   trustedVerification=evidence.verification;
  }
  const accepted=Boolean(verified>=.99&&trustedVerification&&trustedVerification.verified===true&&trustedVerification.confidence01>=.65&&trustedVerification.externalObservation===true);
  this.state.learningUpdates++;if(Number.isSafeInteger(args.tick)&&Number(args.tick)>=0)this.state.tick=Number(args.tick);this.state.lastReward01=reward;
  if(!accepted){
   this.state.rejectedLearningUpdates++;
   this.state.lastEvidenceGateReason=!evidence?'missing-provenance':evidence.source!=='external-verification'?'untrusted-evidence-source':!evidence.expectedBinding?'missing-decision-binding':!trustedVerification?'untrusted-or-unbound-verification':verified<.99?'outcome-below-verification-threshold':'verification-confidence-too-low';
   // Unverified outcomes may increase uncertainty, but cannot rewrite stable personality state.
   const uncertaintyShift=clamp(error*.55+(1-verified)*.45);
   for(let i=0;i<this.state.selfUncertainty.length;i++)this.state.selfUncertainty[i]=clamp(this.state.selfUncertainty[i]!*.97+uncertaintyShift*.03,.03,.97);
   return;
  }
  this.state.verifiedLearningUpdates++;this.state.lastEvidenceGateReason='verified-independent-outcome-bound';
  const signal=clamp(reward*.55+verified*.25+(1-error)*.20);const eta=this.state.plasticity01*(.55+Math.abs(reward-.5));
  // Do not infer a personality dimension from an action index. Learn only the trait/value
  // dimension explicitly attributed by the independently verified evidence.
  const trait=evidence?.traitFeedback;
  if(trait&&typeof trait.traitName==='string'&&Number.isFinite(trait.target01)&&trait.target01>=0&&trait.target01<=1&&Number.isFinite(trait.confidence01)&&trait.confidence01>=0&&trait.confidence01<=1){
   const index=this.state.adaptiveNames.indexOf(trait.traitName);
   if(index>=0){const weight=eta*clamp(trait.confidence01)*.5;this.state.adaptiveValues[index]=clamp(this.state.adaptiveValues[index]!+(trait.target01-this.state.adaptiveValues[index]!)*weight);}
  }
  const value=evidence?.valueFeedback;
  if(value&&typeof value.valueName==='string'&&Number.isFinite(value.target01)&&value.target01>=0&&value.target01<=1&&Number.isFinite(value.confidence01)&&value.confidence01>=0&&value.confidence01<=1){
   const index=this.state.valueNames.indexOf(value.valueName);
   if(index>=0){const weight=eta*clamp(value.confidence01)*.22;this.state.valueWeights[index]=clamp(this.state.valueWeights[index]!+(value.target01-this.state.valueWeights[index]!)*weight);}
  }
  if(args.relationshipId){const prior=this.state.relationshipTrust[args.relationshipId]??.5;const trustSignal=clamp(reward*.55+verified*.3+(1-args.identityGap01)*.15);this.state.relationshipTrust[args.relationshipId]=clamp(prior*.94+trustSignal*.06);}
  const uncertaintyShift=clamp(error*.35+(1-verified)*.3);
  for(let i=0;i<this.state.selfUncertainty.length;i++)this.state.selfUncertainty[i]=clamp(this.state.selfUncertainty[i]!*.97+uncertaintyShift*.03,.03,.97);
  const drift=this.state.adaptiveValues.reduce((s,x)=>s+(x-(this.state.adaptiveValues.reduce((a,b)=>a+b,0)/Math.max(1,this.state.adaptiveValues.length)))**2,0)/Math.max(1,this.state.adaptiveValues.length);
  this.state.drift01=clamp(Math.sqrt(drift)*1.7);this.state.contradiction01=clamp(this.state.contradiction01*.92+Math.abs(.5-reward)*.08);
  this.state.autobiographicalStrength01=clamp(this.state.autobiographicalStrength01*.995+.005*(.5+verified*.5));
  this.state.stability01=clamp(this.state.stability01*.97+(1-this.state.drift01)*.03);this.state.coherence01=clamp(this.state.coherence01*.94+(signal*(1-this.state.contradiction01))*.06);
 }
 metrics(){return deep(this.state);}
}
export const defaultP2702PersistentPersonality=():P2702PersonalityState=>defaultState();
