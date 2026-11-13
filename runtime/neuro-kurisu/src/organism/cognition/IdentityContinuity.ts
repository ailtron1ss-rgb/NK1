import type { AdaptiveValueWeights } from './ValuePlasticity.ts';

export interface IdentityContinuityState {
  version:1;
  continuity: number;
  stability: number;
  drift: number;
  selfNarrativeFingerprint:string;
  valueDistance:number;
  goalContinuity:number;
  memoryContinuity:number;
  authorshipContinuity:number;
  lastAt:number;
  samples:number;
  anchorValues:number[];
  anchorGoals:string[];
  anchorMemories:string[];
}
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const vec=(v:AdaptiveValueWeights)=>[v.curiosity,v.truth,v.autonomy,v.evidence,v.care,v.responsibility,v.social];
function dist(a:number[],b:number[]){return Math.sqrt(a.reduce((s,x,i)=>s+(x-(b[i]??0))**2,0)/Math.max(1,a.length));}
function fingerprint(v:AdaptiveValueWeights, identityCoherence:number, activeGoalTitles:string[]):string{
  return [
    v.curiosity.toFixed(2),v.truth.toFixed(2),v.autonomy.toFixed(2),v.evidence.toFixed(2),v.care.toFixed(2),v.responsibility.toFixed(2),v.social.toFixed(2),
    identityCoherence.toFixed(2),...activeGoalTitles.slice(0,3).map(x=>x.toLowerCase().replace(/\s+/g,' ').slice(0,24))
  ].join('|');
}
export function defaultIdentityContinuity():IdentityContinuityState{return{version:1,continuity:0.88,stability:0.88,drift:0,valueDistance:0,goalContinuity:1,memoryContinuity:1,authorshipContinuity:0.5,selfNarrativeFingerprint:'',lastAt:0,samples:0,anchorValues:[],anchorGoals:[],anchorMemories:[]};}
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const strList=(v:unknown,cap:number):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'&&x.length>0).map(x=>x.slice(0,120)).slice(0,cap):[];
export class IdentityContinuityEngine{
  private state=defaultIdentityContinuity(); private previousValues:AdaptiveValueWeights|null=null; private previousGoals:string[]=[]; private previousMemoryIds:string[]=[];
  restore(s:IdentityContinuityState|undefined){const d=defaultIdentityContinuity();const src:Record<string,unknown>=(s&&typeof s==='object')?s as unknown as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const anchorValues=Array.isArray(read('anchorValues'))?(read('anchorValues') as unknown[]).slice(0,7).map(x=>clamp(finN(x,0))):[];this.state={version:1,continuity:clamp(finN(read('continuity'),d.continuity)),stability:clamp(finN(read('stability'),d.stability)),drift:clamp(finN(read('drift'),d.drift)),valueDistance:clamp(finN(read('valueDistance'),d.valueDistance)),goalContinuity:clamp(finN(read('goalContinuity'),d.goalContinuity)),memoryContinuity:clamp(finN(read('memoryContinuity'),d.memoryContinuity)),authorshipContinuity:clamp(finN(read('authorshipContinuity'),d.authorshipContinuity)),selfNarrativeFingerprint:typeof read('selfNarrativeFingerprint')==='string'?(read('selfNarrativeFingerprint') as string).slice(0,512):d.selfNarrativeFingerprint,lastAt:Math.max(0,finN(read('lastAt'),d.lastAt)),samples:cnt(read('samples'),d.samples),anchorValues,anchorGoals:strList(read('anchorGoals'),16),anchorMemories:strList(read('anchorMemories'),24)}; this.previousValues=this.state.anchorValues.length?{curiosity:this.state.anchorValues[0]??0.9,truth:this.state.anchorValues[1]??1,autonomy:this.state.anchorValues[2]??0.9,evidence:this.state.anchorValues[3]??0.9,care:this.state.anchorValues[4]??0.8,responsibility:this.state.anchorValues[5]??0.9,social:this.state.anchorValues[6]??0.6,updatedAt:0,plasticityBudget:0}:null; this.previousGoals=[...this.state.anchorGoals]; this.previousMemoryIds=[...this.state.anchorMemories]; }
  snapshot(){return structuredClone(this.state);}
  update(input:{values:AdaptiveValueWeights; identityCoherence:number; activeGoalTitles:string[]; memoryIds:string[]; authorshipScore:number}){
    const valueDistance=this.previousValues?clamp(dist(vec(input.values),vec(this.previousValues))*1.8):0;
    const overlap=(a:string[],b:string[])=>{if(!a.length||!b.length)return 0;const set=new Set(b);return a.filter(x=>set.has(x)).length/Math.max(1,a.length);};
    const goalContinuity=this.previousGoals.length?overlap(input.activeGoalTitles,this.previousGoals):1;
    const memoryContinuity=this.previousMemoryIds.length?overlap(input.memoryIds.slice(0,12),this.previousMemoryIds.slice(0,12)):1;
    const drift=clamp(valueDistance*0.5+(1-goalContinuity)*0.25+(1-memoryContinuity)*0.1+(1-clamp(input.authorshipScore))*0.15);
    const stability=clamp(1-drift);
    const continuity=clamp(input.identityCoherence*0.42+stability*0.33+goalContinuity*0.10+memoryContinuity*0.08+clamp(input.authorshipScore)*0.07);
    this.state={...this.state,version:1,continuity,stability,drift,valueDistance,goalContinuity,memoryContinuity,authorshipContinuity:clamp(input.authorshipScore),selfNarrativeFingerprint:fingerprint(input.values,input.identityCoherence,input.activeGoalTitles),lastAt:Date.now(),samples:this.state.samples+1,anchorValues:vec(input.values),anchorGoals:input.activeGoalTitles.slice(0,16),anchorMemories:input.memoryIds.slice(0,24)};
    this.previousValues=structuredClone(input.values); this.previousGoals=input.activeGoalTitles.slice(0,16); this.previousMemoryIds=input.memoryIds.slice(0,24);
    return this.snapshot();
  }
}
