const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export type ConsolidationRoute='hippocampal'|'cortical'|'procedural'|'defer';
export interface ConsolidationCandidate { id:string; kind?:string; salience01:number; novelty01:number; predictionError01:number; uncertainty01:number; outcome01:number; recency01:number; procedural01?:number; storageCost01?:number; reinforcementGate01?:number; redundancy01?:number; semanticCompression01?:number; }
export interface ConsolidationDecision { id:string; route:ConsolidationRoute; priority01:number; reason:string; plasticity01:number; retention01:number; overconsolidationRisk01:number; reinforcement01:number; }
export interface MemoryConsolidationState { version:1; runs:number; selected:number; deferred:number; episodicRuns:number; proceduralRuns:number; corticalRuns:number; meanPriority01:number; meanOverconsolidationRisk01:number; feedbackUpdates:number; awakeBoundedRuns:number; sleepTimeRuns:number; lastFeedback?:{action:string;delta01:number;retention01:number}; lastBatch:ConsolidationDecision[]; }
const defaults=():MemoryConsolidationState=>({version:1,runs:0,selected:0,deferred:0,episodicRuns:0,proceduralRuns:0,corticalRuns:0,meanPriority01:0,meanOverconsolidationRisk01:0,feedbackUpdates:0,awakeBoundedRuns:0,sleepTimeRuns:0,lastFeedback:undefined,lastBatch:[]});

/** Distribution-aware consolidation controller. This is a computational design, not an anatomical equivalence claim. */
export class MemoryConsolidationController {
  private state=defaults();
  restore(raw?:Partial<MemoryConsolidationState>|null){const d=defaults();this.state={...d,...(raw??{}),lastBatch:Array.isArray(raw?.lastBatch)?raw!.lastBatch.slice(0,32):[]};}
  snapshot(){return structuredClone(this.state);}
  rank(candidates:ConsolidationCandidate[], limits={batchSize:8,pressure01:0.5,awake01:1}):ConsolidationDecision[]{
    const out=candidates.map(c=>{
      const procedural=clamp01(c.procedural01??(c.kind==='procedural'?1:0));
      const reinforcement=clamp01(c.reinforcementGate01??.5);
      const redundancy=clamp01(c.redundancy01??0);
      const compression=clamp01(c.semanticCompression01??0);
      const importance=clamp01(.22*c.salience01+.18*c.novelty01+.22*c.predictionError01+.20*c.uncertainty01+.12*c.outcome01+.10*c.recency01);
      const pressure=clamp01(.78+limits.pressure01*.14+limits.awake01*.08);
      const overconsolidationRisk=clamp01((1-c.novelty01)*.28+(1-c.predictionError01)*.18+(1-c.uncertainty01)*.14+redundancy*.28+compression*.12);
      const priority=clamp01(importance*pressure + procedural*.04 + reinforcement*.10 - overconsolidationRisk*.22);
      const route:ConsolidationRoute=procedural>.62 && reinforcement>.42?'procedural':priority>.64?'hippocampal':priority>.42?'cortical':'defer';
      const plasticity=clamp01(.25+.55*c.uncertainty01+.20*c.predictionError01 + procedural*(1-reinforcement)*.10);
      const retention=clamp01((.35+.35*c.salience01+.20*(1-c.novelty01)+.10*c.outcome01) * (.72+.28*reinforcement) * (1-overconsolidationRisk*.65));
      return {id:c.id,route,priority01:priority,reason:`priority=${priority.toFixed(3)} uncertainty=${c.uncertainty01.toFixed(3)} error=${c.predictionError01.toFixed(3)} redundancy=${redundancy.toFixed(3)}`,plasticity01:plasticity,retention01:retention,overconsolidationRisk01:overconsolidationRisk,reinforcement01:reinforcement};
    }).sort((a,b)=>b.priority01-a.priority01);
    const requestedBatch=Math.max(1,Math.min(32,Math.floor(limits.batchSize)));
    // Letta-inspired sleep-time budget: preserve the larger maintenance window for sleeping/idle cycles.
    // Active cycles are capped at four decisions; sleeping cycles get at least twelve, always bounded to 32.
    const awake=limits.awake01===undefined?null:clamp01(limits.awake01);
    const batchSize=awake===null?requestedBatch:awake>.5?Math.min(4,requestedBatch):Math.min(32,Math.max(12,requestedBatch));
    if(awake===null){} else if(awake>.5)this.state.awakeBoundedRuns++; else this.state.sleepTimeRuns++;
    const chosen=out.slice(0,batchSize);
    this.state.runs++;this.state.selected+=chosen.filter(x=>x.route!=='defer').length;this.state.deferred+=chosen.filter(x=>x.route==='defer').length;
    this.state.episodicRuns+=chosen.filter(x=>x.route==='hippocampal').length;
    this.state.proceduralRuns+=chosen.filter(x=>x.route==='procedural').length;
    this.state.corticalRuns+=chosen.filter(x=>x.route==='cortical').length;
    if(chosen.length){const m=chosen.reduce((s,x)=>s+x.priority01,0)/chosen.length;this.state.meanPriority01=this.state.meanPriority01*.9+m*.1;const r=chosen.reduce((s,x)=>s+x.overconsolidationRisk01,0)/chosen.length;this.state.meanOverconsolidationRisk01=this.state.meanOverconsolidationRisk01*.9+r*.1;}
    this.state.lastBatch=chosen;
    return chosen;
  }
  applyOutcomeFeedback(input:{action:string;predicted01:number;actual01:number;surprise01:number;reinforcementGate01?:number}){
    const predicted=clamp01(input.predicted01), actual=clamp01(input.actual01), surprise=clamp01(input.surprise01), gate=clamp01(input.reinforcementGate01??.5);
    const signedError=actual-predicted;
    const delta=clamp01(Math.abs(signedError))*(.45+.35*surprise)*(.65+.35*gate);
    const retention=clamp01(.5 + signedError*.4 - surprise*.08 + gate*.08);
    this.state.feedbackUpdates++;
    this.state.lastFeedback={action:String(input.action),delta01:Number(delta.toFixed(6)),retention01:Number(retention.toFixed(6))};
    return {action:String(input.action),predictionError01:Math.abs(signedError),learningDelta01:delta,retention01:retention,reinforcementGate01:gate};
  }
  diagnostics(){return {...this.state,lastBatch:this.state.lastBatch.map(x=>({...x}))};}
}
