const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface LongitudinalBenchmarkState{version:1;
cycles:number;
episodes:number;
meanStability01:number;
meanTransfer01:number;
identityRetention01:number;
drift01:number;
holdout01:number;
}
const d=():LongitudinalBenchmarkState=>({version:1,cycles:0,episodes:0,meanStability01:.5,meanTransfer01:.5,identityRetention01:.9,drift01:0,holdout01:.5});

export class LongitudinalOrganismBenchmarkEngine{private s=d();
restore(r?:Partial<LongitudinalBenchmarkState>|null){this.s={...d(),...(r??{}),version:1};
}snapshot(){return structuredClone(this.s);
}observe(i:{stability01:number;
transfer01:number;
identity01:number;
drift01:number;
holdout01:number}){this.s.cycles++;
this.s.episodes++;
this.s.meanStability01=c(this.s.meanStability01*.94+c(i.stability01)*.06);
this.s.meanTransfer01=c(this.s.meanTransfer01*.94+c(i.transfer01)*.06);
this.s.identityRetention01=c(this.s.identityRetention01*.95+c(i.identity01)*.05);
this.s.drift01=c(this.s.drift01*.92+c(i.drift01)*.08);
this.s.holdout01=c(this.s.holdout01*.9+c(i.holdout01)*.1);
return{organismScore01:c(this.s.meanStability01*.25+this.s.meanTransfer01*.25+this.s.identityRetention01*.25+this.s.holdout01*.25),drift01:this.s.drift01};
}summary(){return structuredClone(this.s);
}}
