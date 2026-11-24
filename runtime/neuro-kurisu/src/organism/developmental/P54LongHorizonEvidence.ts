/** P54 — Long-horizon evidence ledger for developmental changes. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface P54Window { startTick:number; endTick:number; cycles:number; meanPredictionError01:number; meanSelfPredictionError01:number; meanIdentity01:number; meanGrounding01:number; meanCausalAlignment01:number; improvement01:number; stress01:number; }
export interface P54State { version:1; windows:P54Window[]; cycles:number; baselineError01:number; currentError01:number; stability01:number; drift01:number; lastAt:number; }
export const defaultP54=():P54State=>({version:1,windows:[],cycles:0,baselineError01:.5,currentError01:.5,stability01:.8,drift01:0,lastAt:0});
export class P54LongHorizonEvidence {
  private state=defaultP54(); private buffer:Array<{tick:number,p:number,sp:number,i:number,g:number,c:number,stress:number}> = [];
  restore(raw?:Partial<P54State>|null){const d=defaultP54(),r=raw??{};this.state={...d,...r,windows:Array.isArray(r.windows)?r.windows.slice(-64):[]};}
  snapshot(){return structuredClone(this.state);}
  observe(input:{tick:number;at:number;predictionError01:number;selfPredictionError01:number;identity01:number;grounding01:number;causalAlignment01:number;stress01?:number}){
    this.buffer.push({tick:input.tick,p:clamp(input.predictionError01),sp:clamp(input.selfPredictionError01),i:clamp(input.identity01),g:clamp(input.grounding01),c:clamp(input.causalAlignment01),stress:clamp(input.stress01??0)});
    this.buffer=this.buffer.slice(-48); this.state.cycles++; this.state.lastAt=input.at;
    if(this.buffer.length>=12 && input.tick%12===0){
      const a=this.buffer.slice(-12), mean=(k:keyof typeof a[number])=>a.reduce((s,x)=>s+x[k],0)/a.length;
      const w:P54Window={startTick:a[0].tick,endTick:a[a.length-1].tick,cycles:a.length,meanPredictionError01:mean('p'),meanSelfPredictionError01:mean('sp'),meanIdentity01:mean('i'),meanGrounding01:mean('g'),meanCausalAlignment01:mean('c'),improvement01:clamp((this.state.baselineError01-mean('p'))*2),stress01:mean('stress')};
      this.state.windows=[w,...this.state.windows].slice(0,64); this.state.currentError01=w.meanPredictionError01; this.state.stability01=clamp(this.state.stability01*.9+w.meanIdentity01*.05+(1-w.meanSelfPredictionError01)*.05); this.state.drift01=clamp(this.state.drift01*.84+Math.abs(this.state.baselineError01-w.meanPredictionError01)*.16);
      if(this.state.cycles===12)this.state.baselineError01=w.meanPredictionError01;
    }
    return this.snapshot();
  }
  summary(){return {cycles:this.state.cycles,currentError01:this.state.currentError01,stability01:this.state.stability01,drift01:this.state.drift01,windows:this.state.windows.length};}
}
