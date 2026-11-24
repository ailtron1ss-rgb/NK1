const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface DevelopmentalPhaseState{version:1;
cycles:number;
phase:'stabilize'|'experiment'|'learn'|'consolidate'|'expand';
transitions:number;
freeze01:number;
phaseFitness01:number;
}
const d=():DevelopmentalPhaseState=>({version:1,cycles:0,phase:'stabilize',transitions:0,freeze01:.2,phaseFitness01:.5});

export class DevelopmentalPhaseScheduler{private s=d();
restore(r?:Partial<DevelopmentalPhaseState>|null){this.s={...d(),...(r??{}),version:1};
}snapshot(){return structuredClone(this.s);
}decide(i:{stability01:number;
causalConfidence01:number;
memoryLoad01:number;
capabilityGap01:number;
resource01:number}){const st=c(i.stability01),cc=c(i.causalConfidence01),ml=c(i.memoryLoad01),gap=c(i.capabilityGap01),res=c(i.resource01);
const freeze=c((1-st)*.45+(1-res)*.25+ml*.3);
let p:'stabilize'|'experiment'|'learn'|'consolidate'|'expand';
if(freeze>.7)p='stabilize';
else if(ml>.72)p='consolidate';
else if(cc<.42)p='experiment';
else if(gap>.5)p='learn';
else p='expand';
if(p!==this.s.phase)this.s.transitions++;
this.s.phase=p;
this.s.freeze01=freeze;
this.s.phaseFitness01=c(st*.35+cc*.35+(1-ml)*.15+res*.15);
this.s.cycles++;
return{phase:p,freeze01:freeze,fitness01:this.s.phaseFitness01};
}summary(){return structuredClone(this.s);
}}
