export interface ConsolidationGateInput {
  tick:number;
  stepsSinceConsolidation:number;
  recurrence01:number;
  predictionError01:number;
  novelty01:number;
  memoryPressure01:number;
  ramPressure01:number;
  performanceProfile:'quality'|'balanced'|'mobile';
  explicit:boolean;
}

export interface ConsolidationGateDecision {
  run:boolean;
  due:boolean;
  reason:string;
  priority01:number;
  cooldownUntilTick:number;
}

export interface AdaptiveConsolidationGateState {
  version:1;
  decisions:number;
  executed:number;
  deferred:number;
  forced:number;
  lastTick:number;
  lastPriority01:number;
  lastReason:string;
  cooldownUntilTick:number;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export class AdaptiveConsolidationGate {
  private state:AdaptiveConsolidationGateState={version:1,decisions:0,executed:0,deferred:0,forced:0,lastTick:0,lastPriority01:0,lastReason:'initial',cooldownUntilTick:0};

  restore(raw?:Partial<AdaptiveConsolidationGateState>|null){
    const r:any=raw??{};
    this.state={
      version:1,
      decisions:Math.max(0,Math.floor(Number(r.decisions??0))),
      executed:Math.max(0,Math.floor(Number(r.executed??0))),
      deferred:Math.max(0,Math.floor(Number(r.deferred??0))),
      forced:Math.max(0,Math.floor(Number(r.forced??0))),
      lastTick:Math.max(0,Math.floor(Number(r.lastTick??0))),
      lastPriority01:clamp(Number(r.lastPriority01??0)),
      lastReason:String(r.lastReason??'initial').slice(0,160),
      cooldownUntilTick:Math.max(0,Math.floor(Number(r.cooldownUntilTick??0))),
    };
  }
  snapshot(){ return {...this.state}; }
  diagnostics(){
    return {...this.state, executionRate01:this.state.decisions?this.state.executed/this.state.decisions:0};
  }

  decide(input:ConsolidationGateInput):ConsolidationGateDecision{
    const steps=Math.max(0,Math.floor(Number(input.stepsSinceConsolidation||0)));
    const due=steps>=24;
    const hardBoundary=steps>=(input.performanceProfile==='mobile'?64:48);
    const recurrence=clamp(input.recurrence01);
    const predictionError=clamp(input.predictionError01);
    const novelty=clamp(input.novelty01);
    const memoryPressure=clamp(input.memoryPressure01);
    const ramPressure=clamp(input.ramPressure01);
    const priority=clamp(.34*recurrence+.24*predictionError+.16*novelty+.16*memoryPressure+.10*ramPressure);
    const forced=Boolean(input.explicit);
    this.state.decisions+=1;
    this.state.lastTick=Math.max(0,Math.floor(Number(input.tick||0)));
    this.state.lastPriority01=priority;

    if(!forced && due && input.tick<this.state.cooldownUntilTick){
      this.state.lastReason='cooldown';
      this.state.deferred+=1;
      return {run:false,due,reason:'cooldown',priority01:priority,cooldownUntilTick:this.state.cooldownUntilTick};
    }

    let run=forced||hardBoundary;
    let reason=forced?'explicit':hardBoundary?'hard-boundary':'not-due';
    if(!run && due){
      if(input.performanceProfile==='mobile'){
        run=priority>=.68 || recurrence>=.62 || predictionError>=.82 || memoryPressure>=.88 || ramPressure>=.94;
        reason=run?'mobile-signal':'mobile-recurrence-deferred';
      }else{
        run=priority>=.28 || input.performanceProfile==='quality';
        reason=run?'signal-threshold':'signal-deferred';
      }
    }
    this.state.lastReason=reason;
    if(run){
      this.state.executed+=1;
      if(forced)this.state.forced+=1;
      this.state.cooldownUntilTick=Math.max(this.state.cooldownUntilTick,input.tick+(input.performanceProfile==='mobile'?16:8));
    }else if(due){
      this.state.deferred+=1;
      this.state.cooldownUntilTick=Math.max(this.state.cooldownUntilTick,input.tick+(input.performanceProfile==='mobile'?12:4));
    }
    return {run,due,reason,priority01:priority,cooldownUntilTick:this.state.cooldownUntilTick};
  }
}
