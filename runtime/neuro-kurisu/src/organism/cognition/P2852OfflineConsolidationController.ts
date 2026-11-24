export type P2852OfflinePhase = 'wake'|'quiet'|'sleepRecent'|'sleepPrior'|'transfer';

export interface P2852OfflineConsolidationState {
  version:1;
  cycles:number;
  replaySamples:number;
  recentSamples:number;
  priorSamples:number;
  transferSamples:number;
  consolidationUpdates:number;
  utilityGain01:number;
  interference01:number;
  retention01:number;
  phase:P2852OfflinePhase;
  phaseTicks:number;
  lastTick:number;
  recentMix01:number;
  priorMix01:number;
  transferMix01:number;
}

const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));

export const defaultP2852OfflineConsolidation=():P2852OfflineConsolidationState=>({
  version:1,cycles:0,replaySamples:0,recentSamples:0,priorSamples:0,transferSamples:0,
  consolidationUpdates:0,utilityGain01:.5,interference01:0,retention01:.5,
  phase:'wake',phaseTicks:0,lastTick:0,recentMix01:.45,priorMix01:.35,transferMix01:.20,
});

export class P2852OfflineConsolidationController {
  private state=defaultP2852OfflineConsolidation();
  plan(tick:number, budget01:number, novelty01:number, forgetting01:number, taskShift01:number){
    const quiet=clamp((1-budget01)*.7+forgetting01*.25+taskShift01*.18);
    const transfer=clamp(taskShift01*.7+(1-forgetting01)*.12);
    const phase: P2852OfflinePhase = transfer>.72 && tick%96>=36 && tick%96<60 ? 'transfer' : tick%96>=72 ? 'sleepPrior' : tick%96>=60 ? 'sleepRecent' : tick%24>=18 ? 'quiet' : 'wake';
    const recent=clamp(.30+.42*clamp(novelty01)+(.20* (phase==='sleepRecent'?1:0)));
    const prior=clamp(.25+.50*clamp(forgetting01)+(.24*(phase==='sleepPrior'?1:0)));
    const transferMix=clamp(.10+.55*transfer+(phase==='transfer'?.20:0));
    const sum=Math.max(.001,recent+prior+transferMix);
    this.state.phase=phase;
    this.state.phaseTicks++;
    this.state.lastTick=tick;
    this.state.recentMix01=recent/sum;
    this.state.priorMix01=prior/sum;
    this.state.transferMix01=transferMix/sum;
    const scale=quiet>.72?.72:quiet>.48?.52:.36;
    return {phase,budget:Math.max(1,Math.floor(Math.max(1,budget01*12*scale))),recentMix01:this.state.recentMix01,priorMix01:this.state.priorMix01,transferMix01:this.state.transferMix01};
  }
  observe(samples:number, recent:number, prior:number, transfer:number, utilityGain01:number, interference01:number, retention01:number){
    this.state.cycles++;
    this.state.replaySamples+=Math.max(0,Math.floor(samples));
    this.state.recentSamples+=Math.max(0,Math.floor(recent));
    this.state.priorSamples+=Math.max(0,Math.floor(prior));
    this.state.transferSamples+=Math.max(0,Math.floor(transfer));
    this.state.consolidationUpdates+=Math.max(0,Math.floor(samples));
    const a=.08;
    this.state.utilityGain01=clamp(this.state.utilityGain01*(1-a)+clamp(utilityGain01)*a);
    this.state.interference01=clamp(this.state.interference01*(1-a)+clamp(interference01)*a);
    this.state.retention01=clamp(this.state.retention01*(1-a)+clamp(retention01)*a);
  }
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<P2852OfflineConsolidationState>|null){
    const d=defaultP2852OfflineConsolidation(),r:any=raw??{};
    this.state={...d,...structuredClone(r),version:1,
      cycles:Math.max(0,Math.floor(Number(r.cycles??0))),
      replaySamples:Math.max(0,Math.floor(Number(r.replaySamples??0))),
      recentSamples:Math.max(0,Math.floor(Number(r.recentSamples??0))),
      priorSamples:Math.max(0,Math.floor(Number(r.priorSamples??0))),
      transferSamples:Math.max(0,Math.floor(Number(r.transferSamples??0))),
      consolidationUpdates:Math.max(0,Math.floor(Number(r.consolidationUpdates??0))),
      utilityGain01:clamp(Number(r.utilityGain01??.5)),
      interference01:clamp(Number(r.interference01??0)),
      retention01:clamp(Number(r.retention01??.5)),
      phase:(['wake','quiet','sleepRecent','sleepPrior','transfer'] as const).includes(r.phase)?r.phase:d.phase,
      phaseTicks:Math.max(0,Math.floor(Number(r.phaseTicks??0))),
      lastTick:Math.floor(Number(r.lastTick??0)),
      recentMix01:clamp(Number(r.recentMix01??.45)),
      priorMix01:clamp(Number(r.priorMix01??.35)),
      transferMix01:clamp(Number(r.transferMix01??.20))};
  }
  metrics(){return this.snapshot();}
}
