const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const fin=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:typeof v==='string'&&v.trim().length?Number(v):NaN;return Number.isFinite(n)?n:(Number.isFinite(f)?f:0);};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(fin(v,f)));
const txt=(v:unknown,f:string):string=>typeof v==='string'&&v.length?v.slice(0,120):f;

export interface SubstratePortabilityState{version:1;
cycles:number;
assessments:number;
meanPortability01:number;
stateFidelity01:number;
drift01:number;
lastTarget:string;
}
const d=():SubstratePortabilityState=>({version:1,cycles:0,assessments:0,meanPortability01:.5,stateFidelity01:.5,drift01:.2,lastTarget:'phone-cpu'});

export class SubstratePortabilityEngine{private s=d();
/** Restore without trusting the snapshot: portability/fidelity/drift feed EMAs (NaN poisons portability assessment); counts non-negative; lastTarget validated. */
restore(r?:Partial<SubstratePortabilityState>|null){const base=d();const src:Record<string,unknown>=(r&&typeof r==='object')?r:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};this.s={version:1,cycles:cnt(read('cycles'),base.cycles),assessments:cnt(read('assessments'),base.assessments),meanPortability01:c(fin(read('meanPortability01'),base.meanPortability01)),stateFidelity01:c(fin(read('stateFidelity01'),base.stateFidelity01)),drift01:c(fin(read('drift01'),base.drift01)),lastTarget:txt(read('lastTarget'),base.lastTarget)};
}snapshot(){return structuredClone(this.s);
}assess(i:{sourceStability01:number;
targetResource01:number;
stateComplexity01:number;
target:string}){const st=c(i.sourceStability01),res=c(i.targetResource01),cx=c(i.stateComplexity01);
const port=c(st*.4+res*.35+(1-cx)*.25),fid=c(st*.5+res*.2+(1-cx)*.3);
this.s.cycles++;
this.s.assessments++;
this.s.meanPortability01=c(this.s.meanPortability01*.9+port*.1);
this.s.stateFidelity01=c(this.s.stateFidelity01*.9+fid*.1);
this.s.drift01=c(this.s.drift01*.92+(1-port)*.08);
this.s.lastTarget=String(i.target);
return{portable01:port,fidelity01:fid,drift01:this.s.drift01,target:this.s.lastTarget};
}summary(){return structuredClone(this.s);
}}
