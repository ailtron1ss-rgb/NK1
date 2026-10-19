const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface SparsePredictiveState{version:1;
cycles:number;
nodes:number;
edges:number;
activeEdges:number;
meanError01:number;
prediction01:number;
lastNovelty01:number;
}
const d=():SparsePredictiveState=>({version:1,cycles:0,nodes:0,edges:0,activeEdges:0,meanError01:.5,prediction01:.5,lastNovelty01:0});

export class SparsePredictiveGraph{private s=d();
restore(r?:Partial<SparsePredictiveState>|null){this.s={...d(),...(r??{}),version:1};
}snapshot(){return structuredClone(this.s);
}step(i:{novelty01:number;
predictionError01:number;
coherence01:number;
sparsity01:number}){const n=c(i.novelty01),e=c(i.predictionError01),q=c(i.coherence01),sp=c(i.sparsity01);
this.s.cycles++;
this.s.nodes=Math.min(4096,this.s.nodes+Math.max(1,Math.round(n*4)));
this.s.edges=Math.min(16384,this.s.edges+Math.max(1,Math.round((.2+n*.8)*6)));
this.s.activeEdges=Math.min(this.s.edges,Math.max(1,Math.round(this.s.edges*(.06+.24*(1-sp)))));
this.s.meanError01=c(this.s.meanError01*.9+e*.1);
this.s.prediction01=c(this.s.prediction01*.86+(q*(1-e)+sp*.2)*.14);
this.s.lastNovelty01=n;
return{prediction01:this.s.prediction01,sparsity01:sp,activeEdges:this.s.activeEdges,error01:this.s.meanError01};
}summary(){return structuredClone(this.s);
}}
