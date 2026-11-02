import type { ActionKind } from '../core/types.ts';
import { KURISU_ORGANISM_CANON } from '../language/KurisuCanonProfile.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
type NamedLearningTarget=readonly [name:string,weight:number];
const ACTION_TRAIT_TARGETS:Record<ActionKind,readonly NamedLearningTarget[]>={
 respond:[['warmth',.45],['tenderness',.30],['directness',.25]],
 explore:[['playfulness',.75],['directness',.15],['sarcasm',.10]],
 verify:[['composure',.55],['guardedness',.20],['directness',.25]],
 rest:[['composure',.55],['tenderness',.25],['warmth',.20]],
 reflect:[['composure',.40],['guardedness',.30],['directness',.30]],
 wait:[['composure',.65],['guardedness',.35]],
 defer:[['composure',.50],['guardedness',.50]],
};
const ACTION_VALUE_TARGETS:Record<ActionKind,readonly NamedLearningTarget[]>={
 respond:[['relationship',.55],['loyalty',.25],['responsibility',.20]],
 explore:[['curiosity',.50],['science',.30],['autonomy',.20]],
 verify:[['truth',.50],['science',.40],['responsibility',.10]],
 rest:[['responsibility',.55],['privacy',.25],['autonomy',.20]],
 reflect:[['autonomy',.35],['science',.35],['truth',.20],['privacy',.10]],
 wait:[['responsibility',.50],['privacy',.30],['autonomy',.20]],
 defer:[['responsibility',.50],['privacy',.25],['autonomy',.25]],
};
function applyNamedLearning(names:string[],values:number[],targets:readonly NamedLearningTarget[],delta:number,rate:number){
 for(const [name,weight] of targets){
  const index=names.indexOf(name);
  if(index<0||index>=values.length)continue;
  values[index]=clamp(values[index]!+delta*rate*weight);
 }
}
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const finite01=(value:unknown,fallback:number,min=0,max=1)=>
 typeof value==='number'&&Number.isFinite(value)?clamp(value,min,max):fallback;
const nonNegativeInteger=(value:unknown,fallback:number)=>
 typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.floor(value)):fallback;
const boundedNumberArray=(value:unknown,fallback:number[],limit:number,min=0,max=1)=>{
 if(!Array.isArray(value))return fallback.slice();
 const length=Math.min(limit,Math.max(fallback.length,value.length));
 return Array.from({length},(_,index)=>finite01(value[index],fallback[index]??.5,min,max));
};
const isRecord=(value:unknown):value is Record<string,unknown> =>
 value!==null&&typeof value==='object'&&!Array.isArray(value);
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
  stability01:.86,coherence01:.78,identityContinuity01:.9,contradiction01:.08,plasticity01:.08,drift01:0,autobiographicalStrength01:.1,lastReward01:.5};
};

export class P2702PersistentPersonalityDynamics{
 private state=defaultState();
 snapshot(){return deep(this.state);}
 restore(raw?:Partial<P2702PersonalityState>|null){
  const d=defaultState(),r:any=raw??{};
  const rawTrust=isRecord(r.relationshipTrust)?Object.entries(r.relationshipTrust):[];
  const relationshipTrust=Object.fromEntries(rawTrust
   .filter(([key,value])=>typeof key==='string'&&key.trim().length>0&&key.length<=96&&typeof value==='number'&&Number.isFinite(value))
   .slice(0,32).map(([key,value])=>[key,clamp(value as number)]));
  const rawPreferences=isRecord(r.actionPreference)?r.actionPreference:{};
  this.state={...d,...deep(r),version:1,
   tick:nonNegativeInteger(r.tick,d.tick),
   experienceCount:nonNegativeInteger(r.experienceCount,d.experienceCount),
   learningUpdates:nonNegativeInteger(r.learningUpdates,d.learningUpdates),
   invariantNames:Array.isArray(r.invariantNames)?r.invariantNames.filter((x:unknown)=>typeof x==='string').slice(0,32):d.invariantNames,
   invariantValues:boundedNumberArray(r.invariantValues,d.invariantValues,32),
   adaptiveNames:Array.isArray(r.adaptiveNames)?r.adaptiveNames.filter((x:unknown)=>typeof x==='string').slice(0,32):d.adaptiveNames,
   adaptiveValues:boundedNumberArray(r.adaptiveValues,d.adaptiveValues,32),
   valueNames:Array.isArray(r.valueNames)?r.valueNames.filter((x:unknown)=>typeof x==='string').slice(0,32):d.valueNames,
   valueWeights:boundedNumberArray(r.valueWeights,d.valueWeights,32),
   relationshipTrust,
   selfBeliefs:boundedNumberArray(r.selfBeliefs,d.selfBeliefs,16),
   selfUncertainty:boundedNumberArray(r.selfUncertainty,d.selfUncertainty,16,.03,.97),
   tensionState:boundedNumberArray(r.tensionState,d.tensionState,16),
   actionPreference:Object.fromEntries(ACTIONS.map(action=>[action,finite01(rawPreferences[action],d.actionPreference[action])]))
  };
  for(const key of ['stability01','coherence01','identityContinuity01','contradiction01','plasticity01','drift01','autobiographicalStrength01','lastReward01'] as const){
   this.state[key]=finite01(r[key],d[key]);
  }
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
  if(args.relationshipId){const prior=this.state.relationshipTrust[args.relationshipId]??.5;this.state.relationshipTrust[args.relationshipId]=clamp(prior*.995+(1-args.identityGap01)*.005);}
  return {actionBias:bias,traitVector:this.state.adaptiveValues.slice(),valueVector:this.state.valueWeights.slice(),identityContinuity01:this.state.identityContinuity01,coherence01:this.state.coherence01,stability01:this.state.stability01,contradiction01:this.state.contradiction01};
 }
 afterOutcome(args:{tick?:number;reward01:number;verified01:number;predictionError01:number;identityGap01:number;action:ActionKind;identityVector?:number[];relationshipId?:string}){
  const reward=clamp(args.reward01),verified=clamp(args.verified01),error=clamp(args.predictionError01);
  // Plasticity is earned by verified, low-error feedback. An unverified reward
  // cannot rewrite enduring traits or values, while uncertainty can still rise.
  const signal=clamp(.5+verified*((reward-.5)*.55+(.5-error)*.45));
  const evidenceReliability=verified*(1-error*.5);
  const eta=this.state.plasticity01*(.55+Math.abs(reward-.5))*evidenceReliability;
  applyNamedLearning(this.state.adaptiveNames,this.state.adaptiveValues,ACTION_TRAIT_TARGETS[args.action],signal-.5,eta);
  applyNamedLearning(this.state.valueNames,this.state.valueWeights,ACTION_VALUE_TARGETS[args.action],signal-.5,eta*.22);
  if(args.relationshipId&&verified>0){
    const prior=this.state.relationshipTrust[args.relationshipId]??.5;
    const trustSignal=clamp(reward*.55+verified*.3+(1-args.identityGap01)*.15);
    const trustRate=.06*evidenceReliability;
    this.state.relationshipTrust[args.relationshipId]=clamp(prior+(trustSignal-prior)*trustRate);
  }
  // The first identity latent is the anchor already compared in beforeDecision.
  // Update only that aligned belief, and only when an outcome actually verified it.
  const identityAnchor=args.identityVector?.[0];
  if(verified>0&&typeof identityAnchor==='number'&&Number.isFinite(identityAnchor)){
    const prior=this.state.selfBeliefs[0]??.5;
    const beliefRate=eta*.35*(1-clamp(args.identityGap01)*.5);
    this.state.selfBeliefs[0]=clamp(prior+(clamp(identityAnchor)-prior)*beliefRate);
  }
  const uncertaintyShift=clamp(error*.35+(1-verified)*.3);
  for(let i=0;i<this.state.selfUncertainty.length;i++)this.state.selfUncertainty[i]=clamp(this.state.selfUncertainty[i]!*.97+uncertaintyShift*.03,.03,.97);
  const meanAdaptive=this.state.adaptiveValues.reduce((a,b)=>a+b,0)/Math.max(1,this.state.adaptiveValues.length);
  const drift=this.state.adaptiveValues.reduce((sum,value)=>sum+(value-meanAdaptive)**2,0)/Math.max(1,this.state.adaptiveValues.length);
  this.state.drift01=clamp(Math.sqrt(drift)*1.7);this.state.contradiction01=clamp(this.state.contradiction01*.92+Math.abs(.5-reward)*.08);
  this.state.autobiographicalStrength01=clamp(this.state.autobiographicalStrength01*.995+.005*verified);
  this.state.stability01=clamp(this.state.stability01*.97+(1-this.state.drift01)*.03);this.state.coherence01=clamp(this.state.coherence01*.94+(signal*(1-this.state.contradiction01))*.06);
  this.state.learningUpdates++;
 }
 metrics(){return deep(this.state);}
}
export const defaultP2702PersistentPersonality=():P2702PersonalityState=>defaultState();
