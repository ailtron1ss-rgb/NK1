import { readRestorablePlainRecord, restoredCounter, restoredMetric, restoredText } from '../core/RestorableState.ts';
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
export const defaultP80=():P80State=>({version:1,cycles:0,continuity01:.9,coherence01:.8,agency01:.5,realityAlignment01:.5,currentMode:'wait',recentModes:[],recentActions:[],modeStreak:0,noveltyPressure01:.2,lastTick:0,lastAction:'wait',lastReason:''});
export class P80UnifiedSelfState {
  private state=defaultP80();
  restore(raw:Partial<P80State>|undefined){
  const r=readRestorablePlainRecord(raw);
  if(!r||(r.version!==undefined&&r.version!==1)){this.state=defaultP80();return;}
  const modes:P80Mode[]=['respond','explore','verify','reflect','rest','wait','defer'];
  const currentMode=restoredText(r.currentMode,'wait',16) as P80Mode;
  const recentModes=Array.isArray(r.recentModes)?r.recentModes.slice(-32).filter((mode):mode is P80Mode=>typeof mode==='string'&&modes.includes(mode as P80Mode)):[];
  const recentActions=Array.isArray(r.recentActions)?r.recentActions.slice(-32).flatMap(action=>{
    if(typeof action!=='string'||action.length>64)return [];
    const safe=restoredText(action,'',64);return safe?[safe]:[];
  }):[];
  this.state={
    version:1,
    cycles:restoredCounter(r.cycles),
    continuity01:restoredMetric(r.continuity01,.9),
    coherence01:restoredMetric(r.coherence01,.8),
    agency01:restoredMetric(r.agency01,.5),
    realityAlignment01:restoredMetric(r.realityAlignment01,.5),
    currentMode:modes.includes(currentMode)?currentMode:'wait',
    recentModes,
    recentActions,
    modeStreak:restoredCounter(r.modeStreak),
    noveltyPressure01:restoredMetric(r.noveltyPressure01,.2),
    lastTick:restoredCounter(r.lastTick),
    lastAction:restoredText(r.lastAction,'wait',64),
    lastReason:restoredText(r.lastReason,'',160),
  };
 } snapshot(){return JSON.parse(JSON.stringify(this.state)) as P80State;}
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
