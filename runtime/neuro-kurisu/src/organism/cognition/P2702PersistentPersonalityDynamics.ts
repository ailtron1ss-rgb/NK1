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
 selfBeliefNames:string[]; selfBeliefs:number[]; selfUncertainty:number[]; tensionNames:string[]; tensionState:number[]; actionPreference:Record<ActionKind,number>;
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
  selfBeliefNames:['continuity','coherence','agency','reality-grounding','stability','goal-continuity','memory-continuity','authorship-continuity'],
  selfBeliefs:[.72,.68,.76,.64,.58,.70,.62,.74],selfUncertainty:new Array(8).fill(.28),
  tensionNames:KURISU_ORGANISM_CANON.tensions.slice(),tensionState:new Array(KURISU_ORGANISM_CANON.tensions.length).fill(.5),
  actionPreference:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,
  stability01:.86,coherence01:.78,identityContinuity01:.9,contradiction01:.08,plasticity01:.08,drift01:0,autobiographicalStrength01:.1,lastReward01:.5};
};
const PERSONALITY_BASELINE=defaultState();

export class P2702PersistentPersonalityDynamics{
 private state=defaultState();
 snapshot(){return deep(this.state);}
 restore(raw?:Partial<P2702PersonalityState>|null){
  const d=defaultState(),r:any=raw&&typeof raw==='object'?raw:{};
  // Trait/value schemas are code-owned, not snapshot-owned. Restore by semantic name
  // so an older/reordered/corrupted array cannot silently change what a trait means.
  const mappedValues=(sourceNames:unknown,sourceValues:unknown,canonicalNames:string[],fallback:number[],min=0,max=1)=>{
   const names=Array.isArray(sourceNames)?sourceNames:[];
   return canonicalNames.map((name,index)=>{
    const sourceIndex=names.length?names.findIndex(x=>x===name):index;
    const raw=Array.isArray(sourceValues)&&sourceIndex>=0?sourceValues[sourceIndex]:fallback[index];
    return clamp(Number(raw??fallback[index]??.5),min,max);
   });
  };
  const values=(value:unknown,length:number,fallback:number[],min=0,max=1)=>Array.from({length},(_,i)=>clamp(Number(Array.isArray(value)?(value[i]??fallback[i]??.5):(fallback[i]??.5)),min,max));
  const count=(value:unknown)=>Math.max(0,Math.min(1_000_000,Math.floor(Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):0)));
  const invariantValues=mappedValues(r.invariantNames,r.invariantValues,d.invariantNames,d.invariantValues);
  const adaptiveValues=mappedValues(r.adaptiveNames,r.adaptiveValues,d.adaptiveNames,d.adaptiveValues);
  const valueWeights=mappedValues(r.valueNames,r.valueWeights,d.valueNames,d.valueWeights);
  const trustSource=r.relationshipTrust&&typeof r.relationshipTrust==='object'&&!Array.isArray(r.relationshipTrust)?Object.entries(r.relationshipTrust):[];
  const relationshipTrust:Record<string,number>={};
  for(const [rawKey,rawValue] of trustSource){
   if(typeof rawKey!=='string')continue;
   const key=rawKey.trim().normalize('NFKC');
   if(!key||key.length>80||['__proto__','prototype','constructor'].includes(key)||
      [...key].some(char=>{const code=char.charCodeAt(0);return code<=31||(code>=127&&code<=159);})||
      Object.prototype.hasOwnProperty.call(relationshipTrust,key))continue;
   if(Object.keys(relationshipTrust).length>=32)break;
   relationshipTrust[key]=clamp(Number(rawValue));
  }
  const actionPreference=Object.fromEntries(ACTIONS.map(action=>[action,clamp(Number(r.actionPreference?.[action]??0),-1,1)])) as Record<ActionKind,number>;
  this.state={...d,...deep(r),version:1,
   tick:count(r.tick),experienceCount:count(r.experienceCount),learningUpdates:count(r.learningUpdates),
   invariantNames:d.invariantNames.slice(),invariantValues,
   adaptiveNames:d.adaptiveNames.slice(),adaptiveValues,
   valueNames:d.valueNames.slice(),valueWeights,
   relationshipTrust,
   selfBeliefNames:d.selfBeliefNames.slice(),
   selfBeliefs:values(r.selfBeliefs,d.selfBeliefNames.length,d.selfBeliefs),
   selfUncertainty:values(r.selfUncertainty,8,d.selfUncertainty,.03,.97),
   tensionNames:d.tensionNames.slice(),
   tensionState:values(r.tensionState,d.tensionNames.length,d.tensionState),
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
  if(Number.isSafeInteger(args.tick)&&args.tick>=0)this.state.tick=args.tick;
  this.state.experienceCount=Math.min(1_000_000,this.state.experienceCount+1);this.state.lastReward01=clamp(args.reward01??.5);
  const tension=clamp(args.identityGap01*.5+args.uncertainty01*.3+args.novelty01*.2);
  const canonCuriosity=this.state.invariantValues[this.state.invariantNames.indexOf('curiosity')]??.96;
  const rigor=this.state.invariantValues[this.state.invariantNames.indexOf('scientificRigor')]??.95;
  const autonomy=this.state.invariantValues[this.state.invariantNames.indexOf('intellectualIndependence')]??.92;
  const adaptive=(name:string)=>this.state.adaptiveValues[this.state.adaptiveNames.indexOf(name)]??.5;
  const value=(name:string)=>this.state.valueWeights[this.state.valueNames.indexOf(name)]??.5;
  const rawRelationshipKey=typeof args.relationshipId==='string'?args.relationshipId.trim().normalize('NFKC'):'';
  const relationshipKey=rawRelationshipKey.length<=80&&!['__proto__','prototype','constructor'].includes(rawRelationshipKey)&&![...rawRelationshipKey].some(char=>{const code=char.charCodeAt(0);return code<=31||(code>=127&&code<=159);})?rawRelationshipKey:'';
  const relationshipTrust=relationshipKey&&Object.prototype.hasOwnProperty.call(this.state.relationshipTrust,relationshipKey)?this.state.relationshipTrust[relationshipKey]??.5:.5;
  const responsibility=this.state.invariantValues[this.state.invariantNames.indexOf('responsibility')]??.90;
  const privacy=value('privacy'),loyalty=value('loyalty'),relationshipValue=value('relationship');
  const skepticism=this.state.invariantValues[this.state.invariantNames.indexOf('skepticism')]??.86;
  const tensionTargets=[
    Math.abs(value('truth')-relationshipValue)*(relationshipKey ? 0.9 : 0.25),
    Math.abs(value('autonomy')-loyalty)*clamp(args.goalPressure01*.6+args.novelty01*.4),
    Math.abs(skepticism-canonCuriosity)*clamp(args.uncertainty01*.6+args.novelty01*.4),
    Math.abs(adaptive('composure')-adaptive('tenderness'))*clamp(args.identityGap01*.5+args.uncertainty01*.5),
    Math.abs(value('science')-privacy)*clamp(args.uncertainty01*.6+args.goalPressure01*.4),
  ];
  this.state.tensionState=tensionTargets.map((target,index)=>clamp((this.state.tensionState[index]??.5)*.94+target*.06));
  const bias:Record<ActionKind,number>=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;
  // Stable values and adaptive traits shape candidate preference, but remain a small
  // additive prior; OrganismCore's existing arbiters still choose the action.
  bias.explore=clamp((canonCuriosity*.043+value('curiosity')*.008)*args.novelty01 + adaptive('playfulness')*.008);
  bias.verify=clamp((rigor*.043+value('truth')*.008+value('science')*.008+adaptive('composure')*.012)*args.uncertainty01+(this.state.tensionState[2]??0)*0.003+(this.state.tensionState[4]??0)*0.003);
  bias.reflect=clamp((autonomy*.025+adaptive('guardedness')*.012)*args.identityGap01 + this.state.contradiction01*.006+(this.state.tensionState[0]??0)*0.003+(this.state.tensionState[3]??0)*0.003);
  const relationalApproach=(relationshipTrust-.5)*.025*(1-privacy*.45);
  const relationalCommitment=(loyalty-.5)*.006+(relationshipValue-.5)*.006;
  bias.respond=clamp((adaptive('warmth')*.020+adaptive('directness')*.015)*(1-args.identityGap01)+relationalApproach+relationalCommitment-(this.state.tensionState[0]??0)*0.002);
  bias.rest=clamp((1-args.goalPressure01)*.010);
  bias.wait=clamp(args.uncertainty01*.010*(1-responsibility*.5));
  bias.defer=clamp(args.uncertainty01*.014*(1-adaptive('directness')));
  for(const a of ACTIONS)this.state.actionPreference[a]=clamp((args.actionUtilities[a]??.5)-.5);
  const observedIdentity=Array.isArray(args.identityVector)?args.identityVector.slice(0,this.state.selfBeliefs.length):[];
  let identityError=0,identitySamples=0;
  for(let i=0;i<observedIdentity.length;i++)if(Number.isFinite(observedIdentity[i])){
   identityError+=Math.abs(clamp(observedIdentity[i]!)-(this.state.selfBeliefs[i]??.5));identitySamples++;
  }
  const selfErr=identitySamples?clamp(identityError/identitySamples*.8):clamp(args.identityGap01);
  this.state.contradiction01=clamp(this.state.contradiction01*.94+(selfErr*.55+tension*.45)*.06);
  this.state.identityContinuity01=clamp(this.state.identityContinuity01*.97+(1-selfErr)*.03);
  this.state.coherence01=clamp(this.state.coherence01*.95+(1-this.state.contradiction01)*.05);
  const canon=PERSONALITY_BASELINE;
  const traitDrift=this.state.adaptiveNames.reduce((sum,name,index)=>sum+Math.abs((this.state.adaptiveValues[index]??.5)-(canon.adaptiveValues[canon.adaptiveNames.indexOf(name)]??.5)),0)/Math.max(1,this.state.adaptiveNames.length);
  const valueDrift=this.state.valueNames.reduce((sum,name,index)=>sum+Math.abs((this.state.valueWeights[index]??.5)-(canon.valueWeights[canon.valueNames.indexOf(name)]??.5)),0)/Math.max(1,this.state.valueNames.length);
  const measuredDrift=clamp(traitDrift*.72+valueDrift*.28);
  this.state.drift01=clamp(this.state.drift01*.98+measuredDrift*.02);
  this.state.stability01=clamp(this.state.stability01*.98+(1-this.state.drift01)*.02);
  // Relationship trust is outcome evidence, not a proxy for the organism's own continuity.
  return {actionBias:bias,traitVector:this.state.adaptiveValues.slice(),valueVector:this.state.valueWeights.slice(),identityContinuity01:this.state.identityContinuity01,coherence01:this.state.coherence01,stability01:this.state.stability01,contradiction01:this.state.contradiction01};
 }
 afterOutcome(args:{tick?:number;reward01:number;verified01:number;predictionError01:number;identityGap01:number;action:ActionKind;identityVector?:number[];relationshipId?:string;learningScale01?:number;identityUpdateScale01?:number;evidence01?:number;independent01?:number;consequence01?:number;evidenceReceiptId?:string;evidenceRef?:string}){
  const reward=clamp(args.reward01),verified=clamp(args.verified01),error=clamp(args.predictionError01);
  const learningScale=clamp(args.learningScale01??.5),identityUpdateScale=clamp(args.identityUpdateScale01??0),evidence=clamp(args.evidence01??.5),independent=clamp(args.independent01??0),consequence=clamp(args.consequence01??0);
  const signal=clamp(reward*.55+verified*.25+(1-error)*.20);const eta=this.state.plasticity01*(.55+Math.abs(reward-.5))*learningScale;
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
  const receiptId=String(args.evidenceReceiptId??'').trim().slice(0,180);
  const receipt=/^reb:(\d+):(\d+):outcome$/.exec(receiptId);
  const receiptBound=Boolean(receipt&&Number(receipt[1])===args.tick&&args.evidenceRef===`external-verification:${receiptId}`);
  const strongIndependentOutcome=receiptBound&&verified>=.9&&identityUpdateScale>=.45&&evidence>=.72&&independent>=.8&&consequence>=.7;
  // Core values and relationship trust have a higher evidential bar than behavioral habits.
  if(strongIndependentOutcome){
   const autobiographicalEvidence=clamp(evidence*.45+independent*.30+consequence*.25);
   this.state.autobiographicalStrength01=clamp(this.state.autobiographicalStrength01*.985+autobiographicalEvidence*.015);
   const valueEta=eta*.12;
   for(let i=0;i<this.state.valueWeights.length;i++)this.state.valueWeights[i]=clamp(this.state.valueWeights[i]!+(signal-.5)*valueEta*(i<2?.35:1));
   if(args.relationshipId){const trustSignal=clamp(reward*.55+verified*.3+(1-clamp(args.identityGap01))*.15);this.updateRelationshipTrust(args.relationshipId,trustSignal,.025);}
  }
  const uncertaintyShift=clamp(error*.35+(1-verified)*.3);
  const uncertaintyRate=.03*learningScale;
  for(let i=0;i<this.state.selfUncertainty.length;i++)this.state.selfUncertainty[i]=clamp(this.state.selfUncertainty[i]!*(1-uncertaintyRate)+uncertaintyShift*uncertaintyRate,.03,.97);
  // Identity beliefs learn more slowly than habits and only from the verified lane.
  const observedIdentity=Array.isArray(args.identityVector)?args.identityVector.slice(0,this.state.selfBeliefs.length):[];
  if(strongIndependentOutcome&&observedIdentity.length){
   for(let i=0;i<observedIdentity.length;i++){
    if(!Number.isFinite(observedIdentity[i]))continue;
    const observed=clamp(observedIdentity[i]!);
    const prior=this.state.selfBeliefs[i]??.5;
    const uncertainty=this.state.selfUncertainty[i]??.5;
    const beliefRate=Math.min(.045,eta*(.25+uncertainty*.5));
    this.state.selfBeliefs[i]=clamp(prior+(observed-prior)*beliefRate);
    this.state.selfUncertainty[i]=clamp(uncertainty*.985+Math.abs(observed-prior)*.015,.03,.97);
   }
  }
  this.state.learningUpdates=Math.min(1_000_000,this.state.learningUpdates+1);
 }
 metrics(){return deep(this.state);}
 diagnostics(){
  const named=(names:string[],values:number[])=>Object.fromEntries(names.map((name,index)=>[name,clamp(values[index]??.5)]));
  return {
   tick:this.state.tick,experienceCount:this.state.experienceCount,learningUpdates:this.state.learningUpdates,
   invariants:named(this.state.invariantNames,this.state.invariantValues),
   traits:named(this.state.adaptiveNames,this.state.adaptiveValues),
   values:named(this.state.valueNames,this.state.valueWeights),
   tensions:named(this.state.tensionNames,this.state.tensionState),
   relationshipTrust:{...this.state.relationshipTrust},
   selfBeliefs:named(this.state.selfBeliefNames,this.state.selfBeliefs),
   selfUncertainty:named(this.state.selfBeliefNames,this.state.selfUncertainty),
   stability01:this.state.stability01,coherence01:this.state.coherence01,
   identityContinuity01:this.state.identityContinuity01,contradiction01:this.state.contradiction01,
   drift01:this.state.drift01,autobiographicalStrength01:this.state.autobiographicalStrength01,
  };
 }
}
export const defaultP2702PersistentPersonality=():P2702PersonalityState=>defaultState();
