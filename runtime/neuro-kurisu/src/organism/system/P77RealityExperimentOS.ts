export interface P77Outcome { capabilityId:string; before01:number; after01:number; evidence:'external-outcome'|'holdout'|'device'|'none'; context?:string; }
export interface P77State { version:1; observations:number; experiments:number; realOutcomes:number; accepted:number; rejected:number; unresolved:number; capability01:number; realityGap01:number; evidenceQuality01:number; complexity01:number; history:Array<{tick:number;capabilityId:string;delta01:number;evidence:string}>; }
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export const defaultP77=():P77State=>({version:1,observations:0,experiments:0,realOutcomes:0,accepted:0,rejected:0,unresolved:0,capability01:0,realityGap01:.5,evidenceQuality01:0,complexity01:0,history:[]});
export class P77RealityExperimentOS{
 private state=JSON.parse(JSON.stringify(defaultP77())) as P77State;
 restore(raw:Partial<P77State>|undefined){if(!raw)return;const d=defaultP77();this.state={...d,...raw,history:Array.isArray(raw.history)?raw.history.slice(-128):[]};}
 snapshot(){return JSON.parse(JSON.stringify(this.state)) as P77State;}
 record(tick:number,o:P77Outcome){this.state.observations++; if(o.evidence!=='none'){this.state.realOutcomes++; this.state.evidenceQuality01=clamp(this.state.evidenceQuality01*.94+.06); const delta=o.after01-o.before01; if(delta>.03)this.state.accepted++; else if(delta<-.03)this.state.rejected++; else this.state.unresolved++; this.state.capability01=clamp(this.state.capability01*.92+o.after01*.08); this.state.realityGap01=clamp(this.state.realityGap01*.9+(1-clamp((o.after01+o.before01)/2))*.1); this.state.history=[...this.state.history,{tick,capabilityId:o.capabilityId,delta01:delta,evidence:o.evidence}].slice(-128); } else this.state.unresolved++; }
 noteComplexity(c01:number){this.state.complexity01=clamp(this.state.complexity01*.95+c01*.05);}
 summary(){return this.snapshot();}
}
