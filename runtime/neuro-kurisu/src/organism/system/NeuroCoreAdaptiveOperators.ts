const clamp=(x:number,a=-1,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:0));
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const sigmoid=(x:number)=>1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));

export interface NeuroCoreAdaptiveOperatorState {
  version:2;
  curvature:number[];
  lowRankBasis:number[][];
  lowRankStrength:number[];
  rankCursor:number;
  updates:number;
  vectorUpdates:number;
  meanCurvature01:number;
  meanPreconditioner01:number;
  meanLowRank01:number;
  meanEraseGate01:number;
  meanWriteGate01:number;
  eraseScale01:number;
  writeScale01:number;
  lowRankScale01:number;
}

export interface NeuroCoreAdaptiveOperatorInput {
  feature:number;
  gradient:number;
  surprise01:number;
  novelty01:number;
  uncertainty01:number;
  verification01:number;
  stability01:number;
  featureVector?:number[];
}

export interface NeuroCoreAdaptiveVectorInput {
  gradient:number[];
  featureVector:number[];
  surprise01:number;
  novelty01:number;
  uncertainty01:number;
  verification01:number;
  stability01:number;
}

export interface NeuroCoreAdaptiveOperatorResult {
  value:number;
  preconditioner01:number;
  eraseGate01:number;
  writeGate01:number;
  gradientStep:number;
}

export interface NeuroCoreAdaptiveVectorResult {
  values:number[];
  preconditionedGradient:number[];
  preconditioner01:number[];
  eraseGate01:number;
  writeGate01:number;
  updatedCount:number;
  meanLowRank01:number;
}

/**
 * CPU/Termux-safe curvature-aware plasticity operator.
 *
 * R26 extends the R25 diagonal estimate with a bounded low-rank correction
 * using a Woodbury-style update in feature space. It intentionally avoids
 * claiming equivalence with GPU KKT/WY kernels and caps rank/correction to
 * keep the mobile hot path predictable.
 */
export class NeuroCoreAdaptiveOperators {
  private readonly dimension:number;
  private readonly rank:number;
  private state:NeuroCoreAdaptiveOperatorState;
  constructor(dimension=96, rank=4){
    this.dimension=Math.max(1,Math.min(256,Math.floor(dimension)));
    this.rank=Math.max(0,Math.min(8,Math.floor(rank)));
    this.state={
      version:2,
      curvature:new Array(this.dimension).fill(.04),
      lowRankBasis:Array.from({length:this.rank},(_,r)=>Array.from({length:this.dimension},(_,i)=>((Math.sin((r+1)*.61+i*.17)*.015)))),
      lowRankStrength:new Array(this.rank).fill(.015),
      rankCursor:0,
      updates:0,
      vectorUpdates:0,
      meanCurvature01:.04,
      meanPreconditioner01:1,
      meanLowRank01:this.rank? .03:0,
      meanEraseGate01:.2,
      meanWriteGate01:.4,
      eraseScale01:1,
      writeScale01:1,
      lowRankScale01:0,
    };
  }
  restore(raw?:Partial<NeuroCoreAdaptiveOperatorState>|null){
    const r=raw??{};
    this.state={
      version:2,
      curvature:Array.from({length:this.dimension},(_,i)=>Math.max(.0001,Math.min(4,Number(r.curvature?.[i]??.04)))),
      lowRankBasis:Array.from({length:this.rank},(_,ri)=>Array.from({length:this.dimension},(_,i)=>clamp(Number(r.lowRankBasis?.[ri]?.[i]??0),-.5,.5))),
      lowRankStrength:Array.from({length:this.rank},(_,ri)=>clamp01(Number(r.lowRankStrength?.[ri]??.015))),
      rankCursor:Math.max(0,Math.floor(Number(r.rankCursor??0)))%Math.max(1,this.rank||1),
      updates:Math.max(0,Math.floor(Number(r.updates??0))),
      vectorUpdates:Math.max(0,Math.floor(Number(r.vectorUpdates??0))),
      meanCurvature01:clamp01(Number(r.meanCurvature01??.04)),
      meanPreconditioner01:clamp01(Number(r.meanPreconditioner01??1)),
      meanLowRank01:clamp01(Number(r.meanLowRank01??(this.rank?.03:0))),
      meanEraseGate01:clamp01(Number(r.meanEraseGate01??.2)),
      meanWriteGate01:clamp01(Number(r.meanWriteGate01??.4)),
      eraseScale01:clamp01(Number(r.eraseScale01??1)),
      writeScale01:clamp01(Number(r.writeScale01??1)),
      lowRankScale01:clamp01(Number(r.lowRankScale01??0)),
    };
  }
  snapshot(){return structuredClone(this.state);}
  configureGateScales(input:{eraseScale01?:number;writeScale01?:number;lowRankScale01?:number}){
    this.state.eraseScale01=clamp01(Number(input.eraseScale01??this.state.eraseScale01));
    this.state.writeScale01=clamp01(Number(input.writeScale01??this.state.writeScale01));
    this.state.lowRankScale01=clamp01(Number(input.lowRankScale01??this.state.lowRankScale01));
  }
  private gates(input:{surprise01:number;novelty01:number;uncertainty01:number;verification01:number;stability01:number}){
    const eraseGate=clamp01(sigmoid(1.35*input.surprise01+0.95*input.uncertainty01-0.55*input.stability01)*this.state.eraseScale01);
    const writeGate=clamp01(sigmoid(1.10*input.novelty01+1.05*input.verification01+0.45*input.stability01-0.85*input.uncertainty01)*this.state.writeScale01);
    return {eraseGate,writeGate};
  }
  apply(current:number,input:NeuroCoreAdaptiveOperatorInput,index:number):NeuroCoreAdaptiveOperatorResult{
    const i=Math.max(0,Math.min(this.dimension-1,Math.floor(index)));
    const feature=clamp(input.feature);
    const gradient=clamp(input.gradient);
    const oldCurvature=this.state.curvature[i]??.04;
    const curvature=Math.max(.0001,Math.min(4,oldCurvature*.985+(feature*feature)*.015));
    this.state.curvature[i]=curvature;
    const basePreconditioner=1/Math.sqrt(curvature+.02);
    const gates=this.gates(input);
    const gradientStep=gradient*basePreconditioner*(.55+.45*clamp01(basePreconditioner/6))*gates.writeGate*.024;
    const eraseFactor=.028*gates.eraseGate*(.25+.75*(1-input.verification01));
    const value=clamp(current*(1-eraseFactor)+gradientStep,-1,1);
    this.state.updates++;
    this.state.meanCurvature01=clamp01(this.state.meanCurvature01*.995+clamp01(curvature/2)*.005);
    this.state.meanPreconditioner01=clamp01(this.state.meanPreconditioner01*.995+clamp01(basePreconditioner/6)*.005);
    this.state.meanEraseGate01=clamp01(this.state.meanEraseGate01*.995+gates.eraseGate*.005);
    this.state.meanWriteGate01=clamp01(this.state.meanWriteGate01*.995+gates.writeGate*.005);
    return {value,preconditioner01:clamp01(basePreconditioner/6),eraseGate01:gates.eraseGate,writeGate01:gates.writeGate,gradientStep};
  }
  applyVector(current:number[],input:NeuroCoreAdaptiveVectorInput):NeuroCoreAdaptiveVectorResult{
    const n=Math.min(this.dimension,current.length,input.gradient.length,input.featureVector.length);
    const feature=Array.from({length:n},(_,i)=>clamp(Number(input.featureVector[i]??0)));
    let norm=Math.sqrt(feature.reduce((s,x)=>s+x*x,0))||1;
    const unit=feature.map(x=>x/norm);
    for(let i=0;i<n;i++){
      const x=feature[i]??0;
      this.state.curvature[i]=Math.max(.0001,Math.min(4,(this.state.curvature[i]??.04)*.985+(x*x)*.015));
    }
    const invD=Array.from({length:n},(_,i)=>1/Math.sqrt((this.state.curvature[i]??.04)+.02));
    let preconditioned=Array.from({length:n},(_,i)=>clamp(Number(input.gradient[i]??0))*invD[i]!);
    let lowRankEnergy=0;
    if(this.rank>0 && this.state.lowRankScale01>1e-6){
      const slot=this.state.rankCursor%this.rank;
      const basis=this.state.lowRankBasis[slot]!;
      for(let i=0;i<n;i++) basis[i]=clamp(basis[i]!*0.97+unit[i]!*0.03,-.5,.5);
      this.state.lowRankStrength[slot]=clamp01((this.state.lowRankStrength[slot]??.015)*.97+Math.min(1,Math.abs((unit.reduce((s,x,i)=>s+x*(basis[i]??0),0))))*.03);
      this.state.rankCursor=(slot+1)%this.rank;
      for(let r=0;r<this.rank;r++){
        const u=this.state.lowRankBasis[r]!; const strength=Math.max(.001,Math.min(.22,this.state.lowRankStrength[r]??.015));
        let udp=0,udu=0;
        for(let i=0;i<n;i++){const ui=u[i]??0; udp+=ui*(preconditioned[i]??0); udu+=ui*ui*(invD[i]??0);}
        const coeff=(strength*udp)/(1+strength*udu);
        for(let i=0;i<n;i++) preconditioned[i]=clamp(preconditioned[i]!-coeff*(u[i]??0)*invD[i]!, -2,2);
        lowRankEnergy+=Math.min(.25,Math.abs(coeff));
      }
    }
    const gates=this.gates(input);
    const values=current.slice();
    let updated=0;
    for(let i=0;i<n;i++){
      const step=(preconditioned[i]??0)*(.55+.45*clamp01((invD[i]??0)/6))*gates.writeGate*.024;
      const erase=.028*gates.eraseGate*(.25+.75*(1-input.verification01));
      values[i]=clamp(values[i]!-erase*(values[i]??0)+step,-1,1);
      if(Math.abs(step)>1e-10) updated++;
    }
    this.state.updates+=updated;
    this.state.vectorUpdates++;
    const meanPre=invD.reduce((s,x)=>s+clamp01(x/6),0)/Math.max(1,n);
    const lowRankMean=lowRankEnergy/Math.max(1,this.rank);
    this.state.meanCurvature01=clamp01(this.state.meanCurvature01*.992+clamp01(this.state.curvature.slice(0,n).reduce((s,x)=>s+x,0)/(2*Math.max(1,n)))*.008);
    this.state.meanPreconditioner01=clamp01(this.state.meanPreconditioner01*.992+meanPre*.008);
    this.state.meanLowRank01=clamp01(this.state.meanLowRank01*.992+clamp01(lowRankMean)*.008);
    this.state.meanEraseGate01=clamp01(this.state.meanEraseGate01*.992+gates.eraseGate*.008);
    this.state.meanWriteGate01=clamp01(this.state.meanWriteGate01*.992+gates.writeGate*.008);
    return {values,preconditionedGradient:preconditioned,preconditioner01:invD.map(x=>clamp01(x/6)),eraseGate01:gates.eraseGate,writeGate01:gates.writeGate,updatedCount:updated,meanLowRank01:clamp01(lowRankMean)};
  }
  diagnostics(){return {dimension:this.dimension,rank:this.rank,updates:this.state.updates,vectorUpdates:this.state.vectorUpdates,meanCurvature01:this.state.meanCurvature01,meanPreconditioner01:this.state.meanPreconditioner01,meanLowRank01:this.state.meanLowRank01,meanEraseGate01:this.state.meanEraseGate01,meanWriteGate01:this.state.meanWriteGate01,eraseScale01:this.state.eraseScale01,writeScale01:this.state.writeScale01,lowRankScale01:this.state.lowRankScale01};}
}
