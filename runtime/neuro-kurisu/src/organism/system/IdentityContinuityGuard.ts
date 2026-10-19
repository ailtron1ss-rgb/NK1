/** BIG PASS 228 — identity continuity and autonomous boundary guard. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface IdentityContinuityState{
  version:1; checks:number; stable:number; rejected:number; revisionWindows:number;
  meanContinuity01:number; meanBoundarySafety01:number; lastReason:string; lastAt:number;
}
export const defaultIdentityContinuityGuard=():IdentityContinuityState=>({
  version:1,checks:0,stable:0,rejected:0,revisionWindows:0,meanContinuity01:.78,
  meanBoundarySafety01:.9,lastReason:'initial',lastAt:0
});
export class IdentityContinuityGuard {
  private state=defaultIdentityContinuityGuard();
  restore(raw?:Partial<IdentityContinuityState>|null){this.state={...defaultIdentityContinuityGuard(),...(raw??{}),version:1};}
  snapshot(){return structuredClone(this.state);}
  evaluate(input:{
    at:number;identity01:number;valueStability01:number;narrative01:number;projectContinuity01:number;
    externalPressure01:number;proposedRevision01:number;verifiedEvidence01:number;
  }) {
    const stability=clamp(input.identity01*.35+input.valueStability01*.25+input.narrative01*.18+input.projectContinuity01*.12+(1-input.externalPressure01)*.10);
    const boundary=clamp((1-input.externalPressure01)*.55+input.verifiedEvidence01*.3+input.identity01*.15);
    const safe=stability>.46&&boundary>.58;
    if(safe)this.state.stable++;else this.state.rejected++;
    if(input.proposedRevision01>.5&&input.verifiedEvidence01>.62)this.state.revisionWindows++;
    this.state.checks++;
    this.state.meanContinuity01=clamp(this.state.meanContinuity01*.93+stability*.07);
    this.state.meanBoundarySafety01=clamp(this.state.meanBoundarySafety01*.93+boundary*.07);
    this.state.lastReason=safe?'identity-coherent':'identity-protection';this.state.lastAt=input.at;
    return{safe,continuity01:stability,boundarySafety01:boundary,reason:this.state.lastReason};
  }
  summary(){return{
    checks:this.state.checks,stable:this.state.stable,rejected:this.state.rejected,revisionWindows:this.state.revisionWindows,
    meanContinuity01:this.state.meanContinuity01,meanBoundarySafety01:this.state.meanBoundarySafety01,lastReason:this.state.lastReason
  };}
}
