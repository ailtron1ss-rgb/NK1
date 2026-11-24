const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

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
restore(r?:Partial<SubstratePortabilityState>|null){this.s={...d(),...(r??{}),version:1};
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
