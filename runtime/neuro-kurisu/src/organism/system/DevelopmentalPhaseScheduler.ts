const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const fin=(value:unknown,fallback:number):number=>{const n=typeof value==='number'?value:typeof value==='string'&&value.trim().length?Number(value):NaN;return Number.isFinite(n)?n:(Number.isFinite(fallback)?fallback:0);};
const cnt=(value:unknown,fallback:number):number=>Math.max(0,Math.floor(fin(value,fallback)));
const PHASES:readonly DevelopmentalPhaseState['phase'][]=['stabilize','experiment','learn','consolidate','expand'];

export interface DevelopmentalPhaseState{version:1;
cycles:number;
phase:'stabilize'|'experiment'|'learn'|'consolidate'|'expand';
transitions:number;
freeze01:number;
phaseFitness01:number;
}
const d=():DevelopmentalPhaseState=>({version:1,cycles:0,phase:'stabilize',transitions:0,freeze01:.2,phaseFitness01:.5});

export class DevelopmentalPhaseScheduler{private s=d();
/** Restore without trusting the snapshot: `phase` must be a known phase (an arbitrary string would force a spurious transition on the next decide) and freeze/fitness feed state; counts are non-negative. */
restore(r?:Partial<DevelopmentalPhaseState>|null){const base=d();const src:Record<string,unknown>=(r&&typeof r==='object')?r:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const phase=PHASES.includes(read('phase') as DevelopmentalPhaseState['phase'])?read('phase') as DevelopmentalPhaseState['phase']:base.phase;this.s={version:1,cycles:cnt(read('cycles'),base.cycles),phase,transitions:cnt(read('transitions'),base.transitions),freeze01:c(fin(read('freeze01'),base.freeze01)),phaseFitness01:c(fin(read('phaseFitness01'),base.phaseFitness01))};
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
