/** BIG PASS 228 — identity continuity and autonomous boundary guard. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finiteOr=(value:unknown,fallback:number):number=>{
  const numeric=typeof value==='number'?value:typeof value==='string'&&value.trim().length?Number(value):NaN;
  return Number.isFinite(numeric)?numeric:(Number.isFinite(fallback)?fallback:0);
};
const countOr=(value:unknown,fallback:number):number=>Math.max(0,Math.floor(finiteOr(value,fallback)));
const textOr=(value:unknown,fallback:string):string=>typeof value==='string'&&value.trim().length?value.trim().slice(0,240):fallback;
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
  /**
   * Restore from a persisted snapshot without trusting it. A bare merge would let
   * NaN/Infinity into `meanContinuity01` and permanently poison the continuity EMA
   * (NaN survives `NaN*.93+stability*.07`), let negative counts corrupt the summary,
   * and let a hostile accessor on the snapshot throw. Each field is sanitized from
   * an own-data read and falls back to the default when invalid.
   */
  restore(raw?:Partial<IdentityContinuityState>|null){
    const d=defaultIdentityContinuityGuard();
    const source=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};
    const read=(key:string):unknown=>{try{return (source as Record<string,unknown>)[key];}catch{return undefined;}};
    this.state={
      version:1,
      checks:countOr(read('checks'),d.checks),
      stable:countOr(read('stable'),d.stable),
      rejected:countOr(read('rejected'),d.rejected),
      revisionWindows:countOr(read('revisionWindows'),d.revisionWindows),
      meanContinuity01:clamp(finiteOr(read('meanContinuity01'),d.meanContinuity01)),
      meanBoundarySafety01:clamp(finiteOr(read('meanBoundarySafety01'),d.meanBoundarySafety01)),
      lastReason:textOr(read('lastReason'),d.lastReason),
      lastAt:Math.max(0,finiteOr(read('lastAt'),d.lastAt)),
    };
  }
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
