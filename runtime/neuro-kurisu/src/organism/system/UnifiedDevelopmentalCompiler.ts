const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface UnifiedDevelopmentalState{version:1;cycles:number;developmentIndex01:number;nextOperation:string;confidence01:number;evidenceScore01:number;rejectedOperations:number;acceptedOperations:number;}
export const defaultUnifiedDevelopmental=():UnifiedDevelopmentalState=>({version:1,cycles:0,developmentIndex01:.4,nextOperation:'observe',confidence01:.45,evidenceScore01:0,rejectedOperations:0,acceptedOperations:0});
export class UnifiedDevelopmentalCompiler{
 private state=defaultUnifiedDevelopmental();
 restore(raw?:Partial<UnifiedDevelopmentalState>|null){const d=defaultUnifiedDevelopmental(),r=raw??{};this.state={...d,...r,version:1};}
 snapshot(){return structuredClone(this.state);}
 decide(input:{gap01:number;uncertainty01:number;phaseFreeze01:number;counterfactualSupport01:number;coadaptation01:number;resourceDebt01:number;causalConfidence01:number}){
  const s=this.state,g=clamp(input.gap01),u=clamp(input.uncertainty01),freeze=clamp(input.phaseFreeze01),cf=clamp(input.counterfactualSupport01),co=clamp(input.coadaptation01),debt=clamp(input.resourceDebt01),ca=clamp(input.causalConfidence01);
  const evidence=clamp(ca*.34+cf*.22+co*.18+(1-u)*.14+(1-debt)*.12);let op='stabilize';
  if(freeze>.72||debt>.68)op='stabilize'; else if(g>.62&&evidence>.52)op='learn'; else if(u>.56&&evidence>.45)op='experiment'; else if(co<.42)op='align-substrate'; else op='consolidate';
  const accepted=evidence>.5 && freeze<.8 && debt<.75;if(accepted)s.acceptedOperations++;else s.rejectedOperations++;s.cycles++;s.evidenceScore01=evidence;s.confidence01=clamp(evidence*(1-freeze*.4));s.developmentIndex01=clamp(s.developmentIndex01*.92+(accepted?.08:0));s.nextOperation=op;
  return {operation:op,evidenceScore01:evidence,confidence01:s.confidence01,accepted,developmentIndex01:s.developmentIndex01};
 }
 summary(){return structuredClone(this.state);}
}
