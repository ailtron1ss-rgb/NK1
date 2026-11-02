import type { ActionKind } from '../core/types.ts';
import { KURISU_ORGANISM_CANON } from '../language/KurisuCanonProfile.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const deep=<T>(x:T):T=>structuredClone(x);
const isPlainRecord=(value:unknown):value is Record<string,unknown>=>{
 if(value===null||typeof value!=='object'||Array.isArray(value))return false;
 const prototype=Object.getPrototypeOf(value);
 return prototype===Object.prototype||prototype===null;
};
const ownData=(value:unknown,key:string):unknown=>{
 if(value===null||typeof value!=='object')return undefined;
 const descriptor=Object.getOwnPropertyDescriptor(value,key);
 return descriptor&&Object.prototype.hasOwnProperty.call(descriptor,'value')?descriptor.value:undefined;
};

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
 restore(raw?:unknown|null){
  const d=defaultState();
  try{
   if(raw===undefined||raw===null){this.state=d;return;}
   if(!isPlainRecord(raw)){this.state=d;return;}
   const version=ownData(raw,'version');
   if(version!==undefined&&version!==1){this.state=d;return;}
   const readArray=(key:string,fallback:number[],min:number,max:number):number[]=>{
    const value=ownData(raw,key);
    if(value===undefined)return fallback.slice();
    if(!Array.isArray(value)||value.length!==fallback.length)return fallback.slice();
    const result:number[]=[];
    for(let i=0;i<value.length;i++){
     const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
     if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))return fallback.slice();
     const item=descriptor.value;
     if(typeof item!=='number'||!Number.isFinite(item))return fallback.slice();
     result.push(clamp(item,min,max));
    }
    return result;
   };
   const readCount=(key:string,fallback:number):number=>{
    const value=ownData(raw,key);
    return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:fallback;
   };
   const readRatio=(key:string,fallback:number):number=>{
    const value=ownData(raw,key);
    return typeof value==='number'&&Number.isFinite(value)?clamp(value):fallback;
   };
   const trustRaw=ownData(raw,'relationshipTrust');
   const relationshipTrust:Record<string,number>={};
   if(trustRaw!==undefined){
    if(!isPlainRecord(trustRaw)){this.state=d;return;}
    const keys=Object.keys(trustRaw);
    if(keys.length>32){this.state=d;return;}
    for(const key of keys){
     if(!key.trim()||key.length>120){this.state=d;return;}
     const descriptor=Object.getOwnPropertyDescriptor(trustRaw,key);
     if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value')||typeof descriptor.value!=='number'||!Number.isFinite(descriptor.value)){this.state=d;return;}
     Object.defineProperty(relationshipTrust,key,{value:clamp(descriptor.value),enumerable:true,writable:true,configurable:true});
    }
   }
   const preferenceRaw=ownData(raw,'actionPreference');
   const actionPreference={...d.actionPreference};
   if(preferenceRaw!==undefined){
    if(!isPlainRecord(preferenceRaw)){this.state=d;return;}
    for(const action of ACTIONS){
     const value=ownData(preferenceRaw,action);
     if(value!==undefined){
      if(typeof value!=='number'||!Number.isFinite(value)){this.state=d;return;}
      actionPreference[action]=Math.max(-1,Math.min(1,value));
     }
    }
   }
   this.state={
    version:1,
    tick:readCount('tick',d.tick),
    experienceCount:readCount('experienceCount',d.experienceCount),
    learningUpdates:readCount('learningUpdates',d.learningUpdates),
    // Trait names are canon-owned identifiers; snapshots may update values, never remap identities.
    invariantNames:d.invariantNames.slice(),invariantValues:readArray('invariantValues',d.invariantValues,0,1),
    adaptiveNames:d.adaptiveNames.slice(),adaptiveValues:readArray('adaptiveValues',d.adaptiveValues,0,1),
    valueNames:d.valueNames.slice(),valueWeights:readArray('valueWeights',d.valueWeights,0,1),
    relationshipTrust,
    selfBeliefs:readArray('selfBeliefs',d.selfBeliefs,0,1),
    selfUncertainty:readArray('selfUncertainty',d.selfUncertainty,.03,.97),
    tensionState:readArray('tensionState',d.tensionState,0,1),
    actionPreference,
    stability01:readRatio('stability01',d.stability01),
    coherence01:readRatio('coherence01',d.coherence01),
    identityContinuity01:readRatio('identityContinuity01',d.identityContinuity01),
    contradiction01:readRatio('contradiction01',d.contradiction01),
    plasticity01:readRatio('plasticity01',d.plasticity01),
    drift01:readRatio('drift01',d.drift01),
    autobiographicalStrength01:readRatio('autobiographicalStrength01',d.autobiographicalStrength01),
    lastReward01:readRatio('lastReward01',d.lastReward01),
   };
  }catch{
   // A hostile persisted personality snapshot must never execute accessors or break startup.
   this.state=d;
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
  const signal=clamp(reward*.55+verified*.25+(1-error)*.20);const eta=this.state.plasticity01*(.55+Math.abs(reward-.5));
  const actionIndex=ACTIONS.indexOf(args.action);const ai=actionIndex<0?0:actionIndex%this.state.adaptiveValues.length;
  this.state.adaptiveValues[ai]=clamp((this.state.adaptiveValues[ai]??.5)+(signal-.5)*eta);
  const valueEta=eta*.22;for(let i=0;i<this.state.valueWeights.length;i++)this.state.valueWeights[i]=clamp(this.state.valueWeights[i]!+(signal-.5)*valueEta*(i<2?.35:1));
  if(args.relationshipId){const prior=this.state.relationshipTrust[args.relationshipId]??.5;const trustSignal=clamp(reward*.55+verified*.3+(1-args.identityGap01)*.15);this.state.relationshipTrust[args.relationshipId]=clamp(prior*.94+trustSignal*.06);}
  const uncertaintyShift=clamp(error*.35+(1-verified)*.3);
  for(let i=0;i<this.state.selfUncertainty.length;i++)this.state.selfUncertainty[i]=clamp(this.state.selfUncertainty[i]!*.97+uncertaintyShift*.03,.03,.97);
  const drift=this.state.adaptiveValues.reduce((s,x)=>s+(x-(this.state.adaptiveValues.reduce((a,b)=>a+b,0)/Math.max(1,this.state.adaptiveValues.length)))**2,0)/Math.max(1,this.state.adaptiveValues.length);
  this.state.drift01=clamp(Math.sqrt(drift)*1.7);this.state.contradiction01=clamp(this.state.contradiction01*.92+Math.abs(.5-reward)*.08);
  this.state.autobiographicalStrength01=clamp(this.state.autobiographicalStrength01*.995+.005*(.5+verified*.5));
  this.state.stability01=clamp(this.state.stability01*.97+(1-this.state.drift01)*.03);this.state.coherence01=clamp(this.state.coherence01*.94+(signal*(1-this.state.contradiction01))*.06);
  this.state.learningUpdates++;
 }
 metrics(){return deep(this.state);}
}
export const defaultP2702PersistentPersonality=():P2702PersonalityState=>defaultState();
