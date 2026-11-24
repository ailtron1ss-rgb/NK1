const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
export interface B2514MemoryItem{key:string;salience01:number;surprise01:number;novelty01:number;goalRelevance01:number;identityRelevance01:number;predictionError01:number;verified01:number;lastTick:number;need01:number;accesses:number;}
export interface B2514State{version:1;enabled:boolean;tick:number;cycles:number;ranked:number;replaySelections:number;semanticSelections:number;meanNeed01:number;coverage01:number;memoryItems:Record<string,B2514MemoryItem>;budget01:number;}
export const defaultB2514State=():B2514State=>({version:1,enabled:true,tick:0,cycles:0,ranked:0,replaySelections:0,semanticSelections:0,meanNeed01:0,coverage01:0,memoryItems:{},budget01:.5});
export class B2514MemoryNeedPrioritizer{
  readonly systemName='cognition:b2514-memory-need-prioritizer' as const;
  private state=defaultB2514State();
  snapshot(){return structuredClone(this.state);} restore(raw?:Partial<B2514State>|null){const d=defaultB2514State(),r:any=raw??{};this.state={...d,...structuredClone(r),version:1,memoryItems:{...d.memoryItems,...(r.memoryItems??{})}};}
  setEnabled(x:boolean){this.state.enabled=!!x;}
  observe(i:{tick:number;key:string;salience01:number;surprise01:number;novelty01:number;goalRelevance01:number;identityRelevance01:number;predictionError01:number;verified01:number}){
    if(!this.state.enabled)return;
    const q=this.state.memoryItems[i.key]??{key:i.key,salience01:.2,surprise01:.2,novelty01:.2,goalRelevance01:.2,identityRelevance01:.2,predictionError01:.2,verified01:0,lastTick:0,need01:.2,accesses:0};
    const decay=Math.min(1,(i.tick-q.lastTick)/600);
    q.salience01=clamp(q.salience01*(1-.08*decay)+clamp(i.salience01)*.08);
    q.surprise01=clamp(q.surprise01*.9+clamp(i.surprise01)*.1);
    q.novelty01=clamp(q.novelty01*.9+clamp(i.novelty01)*.1);
    q.goalRelevance01=clamp(q.goalRelevance01*.9+clamp(i.goalRelevance01)*.1);
    q.identityRelevance01=clamp(q.identityRelevance01*.94+clamp(i.identityRelevance01)*.06);
    q.predictionError01=clamp(q.predictionError01*.9+clamp(i.predictionError01)*.1);
    q.verified01=clamp(q.verified01*.9+clamp(i.verified01)*.1);
    q.need01=clamp(.20*q.salience01+.16*q.surprise01+.14*q.novelty01+.18*q.goalRelevance01+.14*q.identityRelevance01+.10*q.predictionError01+.08*q.verified01);
    q.lastTick=i.tick;this.state.memoryItems[i.key]=q;this.state.cycles++;this.state.tick=i.tick;
    this.state.meanNeed01=clamp(Object.values(this.state.memoryItems).reduce((s,x)=>s+x.need01,0)/Math.max(1,Object.keys(this.state.memoryItems).length));
  }
  rank(limit=8){if(!this.state.enabled)return [];const items=Object.values(this.state.memoryItems).sort((a,b)=>b.need01-a.need01).slice(0,Math.max(1,limit));this.state.ranked+=items.length;return items.map(x=>({...x}));}
  markAccess(keys:string[],kind:'replay'|'semantic'){for(const k of keys){const q=this.state.memoryItems[k];if(q)q.accesses++;}if(kind==='replay')this.state.replaySelections+=keys.length;else this.state.semanticSelections+=keys.length;const active=Object.values(this.state.memoryItems);this.state.coverage01=clamp(new Set(keys).size/Math.max(1,Math.min(16,active.length)));}
  diagnostics(){return {...structuredClone(this.state),itemCount:Object.keys(this.state.memoryItems).length};}
}
