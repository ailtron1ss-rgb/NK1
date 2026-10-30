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

export class P2702PersistentPersonalityDynamics{
 private state=defaultState();
 snapshot(){return deep(this.state);}
 restore(raw?:Partial<P2702PersonalityState>|null){
  const d=defaultState(),r:any=raw&&typeof raw==='object'?raw:{};
  const names=(value:unknown,fallback:string[])=>{
   const rows=Array.isArray(value)?value.filter((x):x is string=>typeof x==='string'&&x.trim().length>0).map(x=>x.trim().slice(0,64)).slice(0,32):fallback;
   return rows.length?rows:fallback.slice();
  };
  const values=(value:unknown,count:number,fallback:number[],min=0,max=1)=>Array.from({length:count},(_,i)=>{
   const candidate=Array.isArray(value)?Number(value[i]??fallback[i]??.5):Number(fallback[i]??.5);
   return clamp(candidate,min,max);
  });
  const count=(value:unknown)=>Math.max(0,Math.min(1_000_000,Math.floor(Number.isFinite(Number(value))?Number(value):0)));
  const invariantNames=names(r.invariantNames,d.invariantNames);
  const adaptiveNames=names(r.adaptiveNames,d.adaptiveNames);
  const valueNames=names(r.valueNames,d.valueNames);
  const trustSource=r.relationshipTrust&&typeof r.relationshipTrust==='object'&&!Array.isArray(r.relationshipTrust)?Object.entries(r.relationshipTrust):[];
  const relationshipTrust=Object.fromEntries(trustSource.filter(([k])=>typeof k==='string'&&k.trim().length>0).slice(0,32).map(([k,v])=>[String(k).slice(0,80),clamp(Number(v))]));
  const actionPreference=Object.fromEntries(ACTIONS.map(action=>[action,clamp(Number(r.actionPreference?.[action]??0),-1,1)])) as Record<ActionKind,number>;
  this.state={...d,...deep(r),version:1,
   tick:count(r.tick),experienceCount:count(r.experienceCount),learningUpdates:count(r.learningUpdates),
   invariantNames,invariantValues:values(r.invariantValues,invariantNames.length,d.invariantValues),
   adaptiveNames,adaptiveValues:values(r.adaptiveValues,adaptiveNames.length,d.adaptiveValues),
   valueNames,valueWeights:values(r.valueWeights,valueNames.length,d.valueWeights),
   relationshipTrust,
   selfBeliefs:values(r.selfBeliefs,8,d.selfBeliefs),
   selfUncertainty:values(r.selfUncertainty,8,d.selfUncertainty,.03,.97),
   tensionState:values(r.tensionState,d.tensionState.length,d.tensionState),
   actionPreference,
   stability01:clamp(Number(r.stability01??d.stability01)),
   coherence01:clamp(Number(r.coherence01??d.coherence01)),
   identityContinuity01:clamp(Number(r.identityContinuity01??d.identityContinuity01)),
   contradiction01:clamp(Number(r.contradiction01??d.contradiction01)),
   plasticity01:clamp(Number(r.plasticity01??d.plasticity01)),
   drift01:clamp(Number(r.drift01??d.drift01)),
   autobiographicalStrength01:clamp(Number(r.autobiographicalStrength01??d.autobiographicalStrength01)),
   lastReward01:clamp(Number(r.lastReward01??d.lastReward01))};
 }
 private updateRelationshipTrust(relationshipId:unknown,trustSignal:number,rate:number){
  if(typeof relationshipId!=='string')return;
  const key=relationshipId.trim().normalize('NFKC');
  if(!key||key.length>80||['__proto__','prototype','constructor'].includes(key)||[...key].some(char=>{const code=char.charCodeAt(0);return code<=31||(code>=127&&code<=159);}))return;
  if(!Object.prototype.hasOwnProperty.call(this.state.relationshipTrust,key)&&Object.keys(this.state.relationshipTrust).length>=32){
    const oldest=Object.keys(this.state.relationshipTrust)[0];
    if(oldest)delete this.state.relationshipTrust[oldest];
  }
  const prior=this.state.relationshipTrust[key]??.5;
  const boundedRate=clamp(rate);
  this.state.relationshipTrust[key]=clamp(prior*(1-boundedRate)+clamp(trustSignal)*boundedRate);
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
  const observedIdentity=Array.isArray(args.identityVector)?args.identityVector.slice(0,this.state.selfBeliefs.length).filter(Number.isFinite):[];
  const selfErr=observedIdentity.length?clamp(observedIdentity.reduce((sum,value,index)=>sum+Math.abs(clamp(value)-(this.state.selfBeliefs[index]??.5)),0)/observedIdentity.length*.8):clamp(args.identityGap01);
  this.state.contradiction01=clamp(this.state.contradiction01*.94+(selfErr*.55+tension*.45)*.06);
  this.state.identityContinuity01=clamp(this.state.identityContinuity01*.97+(1-selfErr)*.03);
  this.state.coherence01=clamp(this.state.coherence01*.95+(1-this.state.contradiction01)*.05);
  this.state.stability01=clamp(this.state.stability01*.98+(1-this.state.drift01)*.02);
  if(args.relationshipId)this.updateRelationshipTrust(args.relationshipId,1-clamp(args.identityGap01),.005);
  return {actionBias:bias,traitVector:this.state.adaptiveValues.slice(),valueVector:this.state.valueWeights.slice(),identityContinuity01:this.state.identityContinuity01,coherence01:this.state.coherence01,stability01:this.state.stability01,contradiction01:this.state.contradiction01};
 }
 afterOutcome(args:{tick?:number;reward01:number;verified01:number;predictionError01:number;identityGap01:number;action:ActionKind;identityVector?:number[];relationshipId?:string}){
  const reward=clamp(args.reward01),verified=clamp(args.verified01),error=clamp(args.predictionError01);
  const signal=clamp(reward*.55+verified*.25+(1-error)*.20);const eta=this.state.plasticity01*(.55+Math.abs(reward-.5));
  // Action semantics map to named traits, never to unrelated array positions.
  // A successful response must not train sarcasm merely because both enumerations
  // happen to have an item at index zero.
  const traitTargets:Partial<Record<ActionKind,Array<{name:string;weight:number}>>> = {
   respond:[{name:'warmth',weight:.62},{name:'directness',weight:.38}],
   explore:[{name:'playfulness',weight:1}],
   verify:[{name:'composure',weight:.58},{name:'guardedness',weight:.42}],
   rest:[{name:'composure',weight:1}],
   reflect:[{name:'guardedness',weight:1}],
   wait:[{name:'composure',weight:.72},{name:'guardedness',weight:.28}],
   defer:[{name:'composure',weight:.55},{name:'directness',weight:.45}],
  };
  for(const target of traitTargets[args.action]??[]){
   const index=this.state.adaptiveNames.indexOf(target.name);
   if(index<0||index>=this.state.adaptiveValues.length)continue;
   this.state.adaptiveValues[index]=clamp((this.state.adaptiveValues[index]??.5)+(signal-.5)*eta*target.weight);
  }
  const valueEta=eta*.22;for(let i=0;i<this.state.valueWeights.length;i++)this.state.valueWeights[i]=clamp(this.state.valueWeights[i]!+(signal-.5)*valueEta*(i<2?.35:1));
  if(args.relationshipId){const trustSignal=clamp(reward*.55+verified*.3+(1-clamp(args.identityGap01))*.15);this.updateRelationshipTrust(args.relationshipId,trustSignal,.06);}
  const uncertaintyShift=clamp(error*.35+(1-verified)*.3);
  for(let i=0;i<this.state.selfUncertainty.length;i++)this.state.selfUncertainty[i]=clamp(this.state.selfUncertainty[i]!*.97+uncertaintyShift*.03,.03,.97);
  // Identity beliefs learn more slowly than habits and only from the verified lane.
  const observedIdentity=Array.isArray(args.identityVector)?args.identityVector.slice(0,this.state.selfBeliefs.length):[];
  if(verified>=.9&&observedIdentity.length){
   for(let i=0;i<observedIdentity.length;i++){
    const observed=clamp(observedIdentity[i]!);
    const prior=this.state.selfBeliefs[i]??.5;
    const uncertainty=this.state.selfUncertainty[i]??.5;
    const beliefRate=Math.min(.045,eta*(.25+uncertainty*.5));
    this.state.selfBeliefs[i]=clamp(prior+(observed-prior)*beliefRate);
    this.state.selfUncertainty[i]=clamp(uncertainty*.985+Math.abs(observed-prior)*.015,.03,.97);
   }
  }
  this.state.learningUpdates++;
 }
 metrics(){return deep(this.state);}
}
export const defaultP2702PersistentPersonality=():P2702PersonalityState=>defaultState();
