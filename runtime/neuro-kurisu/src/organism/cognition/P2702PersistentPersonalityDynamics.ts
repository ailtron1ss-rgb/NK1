import type { ActionKind } from '../core/types.ts';
import { KURISU_ORGANISM_CANON } from '../language/KurisuCanonProfile.ts';

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


type OwnRecord=Record<string,unknown>;
function readOwnDataRecord(value:unknown):OwnRecord|null{
 if(value===null||typeof value!=="object")return null;
 try{
  if(Array.isArray(value))return null;
  const prototype=Object.getPrototypeOf(value);
  if(prototype!==Object.prototype&&prototype!==null)return null;
  const keys=Reflect.ownKeys(value);
  if(keys.length>128||keys.some(key=>typeof key!=="string"))return null;
  const output:OwnRecord=Object.create(null);
  for(const key of keys as string[]){
   const descriptor=Object.getOwnPropertyDescriptor(value,key);
   if(!descriptor||!("value" in descriptor))return null;
   output[key]=descriptor.value;
  }
  return output;
 }catch{return null;}
}
function readDenseArray(value:unknown,expectedLength:number):unknown[]|null{
 try{
  if(!Array.isArray(value))return null;
  const lengthDescriptor=Object.getOwnPropertyDescriptor(value,"length");
  if(!lengthDescriptor||!("value" in lengthDescriptor)||lengthDescriptor.value!==expectedLength)return null;
  const output:unknown[]=[];
  for(let index=0;index<expectedLength;index++){
   const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
   if(!descriptor||!("value" in descriptor))return null;
   output.push(descriptor.value);
  }
  return output;
 }catch{return null;}
}
function hasCanonicalNames(value:unknown,fallback:string[]):boolean{
 if(value===undefined)return true;
 const input=readDenseArray(value,fallback.length);
 return !!input&&input.every((item,index)=>item===fallback[index]);
}
function readMetricArray(value:unknown,fallback:number[],min=0,max=1):number[]{
 const input=readDenseArray(value,fallback.length);
 if(!input||input.some(item=>typeof item!=="number"||!Number.isFinite(item)))return fallback.slice();
 return input.map(item=>clamp(item as number,min,max));
}
function readCounter(value:unknown,fallback:number):number{
 return typeof value==="number"&&Number.isSafeInteger(value)&&value>=0?value:fallback;
}
function readMetric(value:unknown,fallback:number,min=0,max=1):number{
 return typeof value==="number"&&Number.isFinite(value)?clamp(value,min,max):fallback;
}
function readRelationshipTrust(value:unknown):Record<string,number>{
 const input=readOwnDataRecord(value);
 const output:Record<string,number>={};
 if(!input)return output;
 for(const key of Object.keys(input).slice(0,32)){
  if(!key||key.length>128||key==="__proto__"||key==="prototype"||key==="constructor")continue;
  const trust=input[key];
  if(typeof trust==="number"&&Number.isFinite(trust))Object.defineProperty(output,key,{value:clamp(trust),enumerable:true,configurable:true,writable:true});
 }
 return output;
}
function readActionPreferences(value:unknown,fallback:Record<ActionKind,number>):Record<ActionKind,number>{
 const input=readOwnDataRecord(value);
 const output={...fallback};
 if(!input)return output;
 for(const action of ACTIONS){
  const preference=input[action];
  if(typeof preference==="number"&&Number.isFinite(preference))output[action]=clamp(preference,-1,1);
 }
 return output;
}

export class P2702PersistentPersonalityDynamics{
 private state=defaultState();
 snapshot(){return deep(this.state);}
 restore(raw?:Partial<P2702PersonalityState>|null){
  const defaults=defaultState();
  const root=readOwnDataRecord(raw);
  if(!root||(root.version!==undefined&&root.version!==1)){this.state=defaults;return;}
  const invariantNamesValid=hasCanonicalNames(root.invariantNames,defaults.invariantNames);
  const adaptiveNamesValid=hasCanonicalNames(root.adaptiveNames,defaults.adaptiveNames);
  const valueNamesValid=hasCanonicalNames(root.valueNames,defaults.valueNames);
  const candidate:P2702PersonalityState={
   version:1,
   tick:readCounter(root.tick,defaults.tick),
   experienceCount:readCounter(root.experienceCount,defaults.experienceCount),
   learningUpdates:readCounter(root.learningUpdates,defaults.learningUpdates),
   invariantNames:defaults.invariantNames.slice(),
   invariantValues:invariantNamesValid?readMetricArray(root.invariantValues,defaults.invariantValues):defaults.invariantValues.slice(),
   adaptiveNames:defaults.adaptiveNames.slice(),
   adaptiveValues:adaptiveNamesValid?readMetricArray(root.adaptiveValues,defaults.adaptiveValues):defaults.adaptiveValues.slice(),
   valueNames:defaults.valueNames.slice(),
   valueWeights:valueNamesValid?readMetricArray(root.valueWeights,defaults.valueWeights):defaults.valueWeights.slice(),
   relationshipTrust:readRelationshipTrust(root.relationshipTrust),
   selfBeliefs:readMetricArray(root.selfBeliefs,defaults.selfBeliefs),
   selfUncertainty:readMetricArray(root.selfUncertainty,defaults.selfUncertainty,.03,.97),
   tensionState:readMetricArray(root.tensionState,defaults.tensionState),
   actionPreference:readActionPreferences(root.actionPreference,defaults.actionPreference),
   stability01:readMetric(root.stability01,defaults.stability01),
   coherence01:readMetric(root.coherence01,defaults.coherence01),
   identityContinuity01:readMetric(root.identityContinuity01,defaults.identityContinuity01),
   contradiction01:readMetric(root.contradiction01,defaults.contradiction01),
   plasticity01:readMetric(root.plasticity01,defaults.plasticity01),
   drift01:readMetric(root.drift01,defaults.drift01),
   autobiographicalStrength01:readMetric(root.autobiographicalStrength01,defaults.autobiographicalStrength01),
   lastReward01:readMetric(root.lastReward01,defaults.lastReward01),
  };
  this.state=candidate;
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
