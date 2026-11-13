export type P80Mode = 'respond'|'explore'|'verify'|'reflect'|'rest'|'wait'|'defer';
export interface P80Input {
  tick:number; mode:P80Mode; identity01:number; memoryContinuity01:number; realityGap01:number;
  predictionError01:number; uncertainty01:number; energy01:number; cognitiveCapacity01:number;
  goalPressure01:number; grounding01:number; causal01:number; workspace01:number;
  action:string; actionScore01:number; externalInput:boolean; novelty01:number;
}
export interface P80State {
  version:1; cycles:number; continuity01:number; coherence01:number; agency01:number; realityAlignment01:number;
  currentMode:P80Mode; recentModes:P80Mode[]; recentActions:string[]; modeStreak:number; noveltyPressure01:number;
  lastTick:number; lastAction:string; lastReason:string;
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const P80_MODES:readonly P80Mode[]=['respond','explore','verify','reflect','rest','wait','defer'];
const finiteOr=(value:unknown,fallback:number):number=>{
  const numeric=typeof value==='number'?value:typeof value==='string'&&value.trim().length?Number(value):NaN;
  return Number.isFinite(numeric)?numeric:(Number.isFinite(fallback)?fallback:0);
};
const countOr=(value:unknown,fallback:number):number=>Math.max(0,Math.floor(finiteOr(value,fallback)));
const modeOr=(value:unknown,fallback:P80Mode):P80Mode=>P80_MODES.includes(value as P80Mode)?value as P80Mode:fallback;
const textOr=(value:unknown,fallback:string):string=>typeof value==='string'?value.slice(0,240):fallback;
export const defaultP80=():P80State=>({version:1,cycles:0,continuity01:.9,coherence01:.8,agency01:.5,realityAlignment01:.5,currentMode:'wait',recentModes:[],recentActions:[],modeStreak:0,noveltyPressure01:.2,lastTick:0,lastAction:'wait',lastReason:''});
export class P80UnifiedSelfState {
  private state=defaultP80();
  /**
   * Restore from a persisted snapshot without trusting it. The four self-state
   * scalars feed multiplicative EMAs in `update`, so a single NaN would poison
   * unified self-state permanently; `recentModes`/`recentActions` are also
   * element-validated so a corrupt snapshot cannot inject unknown modes. Each
   * field is read from an own-data accessor that cannot throw.
   */
  restore(raw:Partial<P80State>|undefined){
    const d=defaultP80();
    const source=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};
    const read=(key:string):unknown=>{try{return (source as Record<string,unknown>)[key];}catch{return undefined;}};
    const recentModesRaw=read('recentModes');
    const recentActionsRaw=read('recentActions');
    this.state={
      version:1,
      cycles:countOr(read('cycles'),d.cycles),
      continuity01:clamp(finiteOr(read('continuity01'),d.continuity01)),
      coherence01:clamp(finiteOr(read('coherence01'),d.coherence01)),
      agency01:clamp(finiteOr(read('agency01'),d.agency01)),
      realityAlignment01:clamp(finiteOr(read('realityAlignment01'),d.realityAlignment01)),
      currentMode:modeOr(read('currentMode'),d.currentMode),
      recentModes:Array.isArray(recentModesRaw)?recentModesRaw.filter((m):m is P80Mode=>P80_MODES.includes(m as P80Mode)).slice(-32):[],
      recentActions:Array.isArray(recentActionsRaw)?recentActionsRaw.filter((a):a is string=>typeof a==='string').map(a=>a.slice(0,120)).slice(-32):[],
      modeStreak:countOr(read('modeStreak'),d.modeStreak),
      noveltyPressure01:clamp(finiteOr(read('noveltyPressure01'),d.noveltyPressure01)),
      lastTick:Math.max(0,finiteOr(read('lastTick'),d.lastTick)),
      lastAction:textOr(read('lastAction'),d.lastAction),
      lastReason:textOr(read('lastReason'),d.lastReason),
    };
  }
  snapshot(){return JSON.parse(JSON.stringify(this.state)) as P80State;}
  summary(){return{version:1,cycles:this.state.cycles,continuity01:this.state.continuity01,coherence01:this.state.coherence01,agency01:this.state.agency01,realityAlignment01:this.state.realityAlignment01,currentMode:this.state.currentMode,noveltyPressure01:this.state.noveltyPressure01,lastTick:this.state.lastTick,lastAction:this.state.lastAction};}
  update(i:P80Input){
    const modeStreak=i.mode===this.state.currentMode?this.state.modeStreak+1:1;
    const diversity = new Set([...this.state.recentModes.slice(-8),i.mode]).size/Math.max(1,Math.min(8,this.state.recentModes.length+1));
    const monotony=clamp(1-diversity);
    const noveltyPressure=clamp(monotony*.55+i.novelty01*.25+i.uncertainty01*.2);
    const continuity=clamp(i.identity01*.25+i.memoryContinuity01*.2+i.grounding01*.12+i.causal01*.12+i.workspace01*.11+(1-i.predictionError01)*.1+i.cognitiveCapacity01*.1);
    const coherence=clamp(i.workspace01*.2+i.grounding01*.16+i.causal01*.16+(1-i.uncertainty01)*.16+i.cognitiveCapacity01*.14+i.memoryContinuity01*.1+i.realityGap01*.08);
    const agency=clamp(i.externalInput?.55:.72 + (i.actionScore01-.5)*.18 - i.uncertainty01*.08);
    const realityAlignment=clamp(1-i.realityGap01);
    this.state.cycles++; this.state.lastTick=i.tick; this.state.lastAction=i.action; this.state.currentMode=i.mode; this.state.modeStreak=modeStreak;
    this.state.recentModes=[...this.state.recentModes,i.mode].slice(-32); this.state.recentActions=[...this.state.recentActions,i.action].slice(-32);
    this.state.continuity01=clamp(this.state.continuity01*.94+continuity*.06);
    this.state.coherence01=clamp(this.state.coherence01*.9+coherence*.1);
    this.state.agency01=clamp(this.state.agency01*.92+agency*.08);
    this.state.realityAlignment01=clamp(this.state.realityAlignment01*.93+realityAlignment*.07);
    this.state.noveltyPressure01=clamp(this.state.noveltyPressure01*.88+noveltyPressure*.12);
    this.state.lastReason=`mode=${i.mode};streak=${modeStreak};novelty=${this.state.noveltyPressure01.toFixed(3)}`;
    return this.snapshot();
  }
  actionBias(action:P80Mode):number {
    const same=this.state.recentActions.slice(-6).filter(a=>a===action).length/6;
    const repetitionPenalty=clamp(same)*this.state.noveltyPressure01*.08;
    const safety=action==='rest' ? .01 : 0;
    return clamp((action==='wait'?-repetitionPenalty:0)-repetitionPenalty+safety)-.5;
  }
}
