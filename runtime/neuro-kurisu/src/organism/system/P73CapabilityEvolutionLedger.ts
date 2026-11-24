/**
 * P73 — Capability Evolution Ledger.
 *
 * A compact external-facing progress ledger. It separates capability signals
 * from implementation complexity and only treats observed outcomes as evidence.
 * It is deliberately agnostic about consciousness.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface P73State {
  version:1; cycles:number; evidenceEvents:number; capabilitySamples:number;
  baselineCapability01:number; currentCapability01:number; capabilityDelta01:number;
  baselineComplexity01:number; currentComplexity01:number; complexityDelta01:number;
  realityGap01:number; stability01:number; regressionEvents:number; sustainedImprovements:number;
  lastEvidenceAt:number; lastCapability01:number; lastComplexity01:number; lastOutcome01:number|null;
  recent:Array<{tick:number;capability01:number;complexity01:number;realityGap01:number;stability01:number;evidence:boolean}>;
}
export const defaultP73=():P73State=>({version:1,cycles:0,evidenceEvents:0,capabilitySamples:0,baselineCapability01:.5,currentCapability01:.5,capabilityDelta01:0,baselineComplexity01:.2,currentComplexity01:.2,complexityDelta01:0,realityGap01:.5,stability01:.8,regressionEvents:0,sustainedImprovements:0,lastEvidenceAt:0,lastCapability01:.5,lastComplexity01:.2,lastOutcome01:null,recent:[]});
export class P73CapabilityEvolutionLedger {
  private state=defaultP73();
  restore(raw?:Partial<P73State>|null){const d=defaultP73(),r=raw??{};this.state={...d,...r,recent:Array.isArray(r.recent)?r.recent.slice(-128):[]};}
  snapshot(){return structuredClone(this.state);}
  observe(input:{tick:number;at:number;workspace01:number;integration01:number;agency01:number;grounding01:number;causal01:number;identity01:number;predictionAccuracy01:number;realityGap01:number;stability01:number;complexity01:number;externalEvidence:boolean;outcome01?:number|null}){
    const cap=clamp(input.workspace01*.14+input.integration01*.18+input.agency01*.12+input.grounding01*.14+input.causal01*.12+input.identity01*.12+input.predictionAccuracy01*.18);
    const cx=clamp(input.complexity01); const delta=cap-this.state.lastCapability01; const evidence=Boolean(input.externalEvidence && input.outcome01!=null);
    this.state.cycles++; this.state.capabilitySamples++; if(evidence)this.state.evidenceEvents++;
    if(this.state.capabilitySamples===1){this.state.baselineCapability01=cap;this.state.baselineComplexity01=cx;} else if(evidence && delta>.025 && cap>=this.state.currentCapability01){this.state.sustainedImprovements++;}
    if(this.state.capabilitySamples>12 && delta<-.10 && cap<this.state.currentCapability01-.07)this.state.regressionEvents++;
    this.state.currentCapability01=clamp(this.state.currentCapability01*.97+cap*.03);this.state.capabilityDelta01=this.state.currentCapability01-this.state.baselineCapability01;
    this.state.currentComplexity01=clamp(this.state.currentComplexity01*.97+cx*.03);this.state.complexityDelta01=this.state.currentComplexity01-this.state.baselineComplexity01;
    this.state.realityGap01=clamp(this.state.realityGap01*.94+clamp(input.realityGap01)*.06);this.state.stability01=clamp(this.state.stability01*.94+clamp(input.stability01)*.06);this.state.lastCapability01=cap;this.state.lastComplexity01=cx;this.state.lastOutcome01=input.outcome01==null?this.state.lastOutcome01:clamp(input.outcome01);if(evidence)this.state.lastEvidenceAt=input.at;
    this.state.recent=[{tick:input.tick,capability01:cap,complexity01:cx,realityGap01:clamp(input.realityGap01),stability01:clamp(input.stability01),evidence},...this.state.recent].slice(0,128);
    return {capability01:cap,complexity01:cx,capabilityDelta01:this.state.capabilityDelta01,complexityDelta01:this.state.complexityDelta01,evidence,realityGap01:this.state.realityGap01,stability01:this.state.stability01};
  }
  summary(){return {cycles:this.state.cycles,evidenceEvents:this.state.evidenceEvents,capabilitySamples:this.state.capabilitySamples,baselineCapability01:this.state.baselineCapability01,currentCapability01:this.state.currentCapability01,capabilityDelta01:this.state.capabilityDelta01,baselineComplexity01:this.state.baselineComplexity01,currentComplexity01:this.state.currentComplexity01,complexityDelta01:this.state.complexityDelta01,realityGap01:this.state.realityGap01,stability01:this.state.stability01,regressionEvents:this.state.regressionEvents,sustainedImprovements:this.state.sustainedImprovements};}
}
