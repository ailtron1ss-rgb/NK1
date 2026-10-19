const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface MetaMemoryState{version:1;
cycles:number;
retrievals:number;
replays:number;
compressions:number;
meanPrecision01:number;
semanticCompression01:number;
forgettingRisk01:number;
}
const d=():MetaMemoryState=>({version:1,cycles:0,retrievals:0,replays:0,compressions:0,meanPrecision01:.5,semanticCompression01:.3,forgettingRisk01:.2});

export class MetaMemoryController{private s=d();
restore(r?:Partial<MetaMemoryState>|null){this.s={...d(),...(r??{}),version:1};
}snapshot(){return structuredClone(this.s);
}step(i:{salience01:number;
repeat01:number;
reliability01:number;
load01:number;
uncertainty01:number}){const sa=c(i.salience01),re=c(i.repeat01),rel=c(i.reliability01),load=c(i.load01),u=c(i.uncertainty01);
const precision=c(sa*.3+re*.25+rel*.35+(1-u)*.1);
this.s.cycles++;
this.s.retrievals++;
if(sa>.55)this.s.replays++;
if(load>.65){this.s.compressions++;
this.s.semanticCompression01=c(this.s.semanticCompression01*.9+.72*.1);
}else this.s.semanticCompression01=c(this.s.semanticCompression01*.97+.18*.03);
this.s.meanPrecision01=c(this.s.meanPrecision01*.9+precision*.1);
this.s.forgettingRisk01=c(load*.45+(1-rel)*.3+u*.25);
return{precision01:precision,meanPrecision01:this.s.meanPrecision01,semanticCompression01:this.s.semanticCompression01,forgettingRisk01:this.s.forgettingRisk01,replay:sa>.55};
}summary(){return structuredClone(this.s);
}}
