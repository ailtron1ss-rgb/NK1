export type IdentityAxis='values'|'relationships'|'preferences'|'autobiography'|'goals';
export interface P76Input { tick:number; identity01:number; drift01:number; valueContinuity01:number; memoryContinuity01:number; authoredContinuity01:number; relationshipContinuity01:number; goalContinuity01:number; contradiction01:number; }
export interface P76State { version:1; samples:number; continuity01:number; drift01:number; conservation01:number; narrativeContinuity01:number; relationshipContinuity01:number; goalContinuity01:number; protectedViolations:number; recentEvents:Array<{tick:number;kind:string;delta01:number}>; }
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export const defaultP76=():P76State=>({version:1,samples:0,continuity01:.86,drift01:0,conservation01:.92,narrativeContinuity01:.65,relationshipContinuity01:.65,goalContinuity01:.55,protectedViolations:0,recentEvents:[]});
export class P76IdentityLifeOS{
 private state=JSON.parse(JSON.stringify(defaultP76())) as P76State;
 restore(raw:Partial<P76State>|undefined){if(!raw)return;const d=defaultP76();this.state={...d,...raw,recentEvents:Array.isArray(raw.recentEvents)?raw.recentEvents.slice(-64):[]};}
 snapshot(){return JSON.parse(JSON.stringify(this.state)) as P76State;}
 summary(){return{version:1,samples:this.state.samples,continuity01:this.state.continuity01,drift01:this.state.drift01,conservation01:this.state.conservation01,narrativeContinuity01:this.state.narrativeContinuity01,relationshipContinuity01:this.state.relationshipContinuity01,goalContinuity01:this.state.goalContinuity01,protectedViolations:this.state.protectedViolations,lastReason:this.state.recentEvents.at(-1)?.kind??'none'};}
 observe(i:P76Input){
  const continuity=clamp(i.identity01*.25+i.valueContinuity01*.2+i.memoryContinuity01*.18+i.authoredContinuity01*.12+i.relationshipContinuity01*.1+i.goalContinuity01*.15);
  const conservation=clamp(1-Math.min(1,i.drift01*.65+i.contradiction01*.35));
  this.state.samples++; this.state.continuity01=clamp(this.state.continuity01*.9+continuity*.1); this.state.drift01=clamp(this.state.drift01*.88+i.drift01*.12); this.state.conservation01=clamp(this.state.conservation01*.9+conservation*.1); this.state.relationshipContinuity01=i.relationshipContinuity01; this.state.goalContinuity01=i.goalContinuity01; this.state.narrativeContinuity01=clamp(this.state.narrativeContinuity01*.95+(i.memoryContinuity01*.05));
  const delta=Math.abs(continuity-this.state.continuity01);
  this.state.recentEvents=[...this.state.recentEvents,{tick:i.tick,kind:conservation>.85?'stable':'identity-pressure',delta01:delta}].slice(-64);
  return {continuity01:this.state.continuity01,conservation01:this.state.conservation01,drift01:this.state.drift01,narrativeContinuity01:this.state.narrativeContinuity01};
 }
 guard(change:{axis:IdentityAxis; magnitude01:number; reason:string}){const protectedAxis=change.axis==='values'||change.axis==='autobiography'; const allowed=!protectedAxis||change.magnitude01<.25; if(!allowed)this.state.protectedViolations++; return {allowed,requiresEvidence:protectedAxis||change.magnitude01>.12,reason:allowed?'allowed':'protected-axis'};}
}
