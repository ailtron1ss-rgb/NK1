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
const P80_MODES:P80Mode[]=['respond','explore','verify','reflect','rest','wait','defer'];
const cleanText=(value:unknown,max:number)=>typeof value==='string'?value.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
const safeCount=(value:unknown)=>{const n=Number(value);return Number.isSafeInteger(n)&&n>=0?Math.min(1_000_000,n):0;};
export const defaultP80=():P80State=>({version:1,cycles:0,continuity01:.9,coherence01:.8,agency01:.5,realityAlignment01:.5,currentMode:'wait',recentModes:[],recentActions:[],modeStreak:0,noveltyPressure01:.2,lastTick:0,lastAction:'wait',lastReason:''});
export class P80UnifiedSelfState {
  private state=defaultP80();
  restore(raw:Partial<P80State>|undefined){if(!raw)return;const d=defaultP80(),r:any=raw;this.state={version:1,cycles:safeCount(r.cycles),continuity01:clamp(Number(r.continuity01??d.continuity01)),coherence01:clamp(Number(r.coherence01??d.coherence01)),agency01:clamp(Number(r.agency01??d.agency01)),realityAlignment01:clamp(Number(r.realityAlignment01??d.realityAlignment01)),currentMode:P80_MODES.includes(r.currentMode)?r.currentMode:d.currentMode,recentModes:Array.isArray(r.recentModes)?r.recentModes.filter((x:unknown):x is P80Mode=>P80_MODES.includes(x as P80Mode)).slice(-32):[],recentActions:Array.isArray(r.recentActions)?r.recentActions.filter((x:unknown):x is P80Mode=>P80_MODES.includes(x as P80Mode)).slice(-32):[],modeStreak:safeCount(r.modeStreak),noveltyPressure01:clamp(Number(r.noveltyPressure01??d.noveltyPressure01)),lastTick:safeCount(r.lastTick),lastAction:P80_MODES.includes(r.lastAction)?r.lastAction:d.lastAction,lastReason:cleanText(r.lastReason,240)};}
  snapshot(){return JSON.parse(JSON.stringify(this.state)) as P80State;}
  summary(){return{version:1,cycles:this.state.cycles,continuity01:this.state.continuity01,coherence01:this.state.coherence01,agency01:this.state.agency01,realityAlignment01:this.state.realityAlignment01,currentMode:this.state.currentMode,noveltyPressure01:this.state.noveltyPressure01,lastTick:this.state.lastTick,lastAction:this.state.lastAction};}
  update(i:P80Input){
    const mode=P80_MODES.includes(i.mode)?i.mode:'wait';
    const action=P80_MODES.includes(i.action as P80Mode)?i.action:'wait';
    const tick=safeCount(i.tick);
    const identity=clamp(i.identity01),memory=clamp(i.memoryContinuity01),gap=clamp(i.realityGap01);
    const predictionError=clamp(i.predictionError01),uncertainty=clamp(i.uncertainty01);
    const capacity=clamp(i.cognitiveCapacity01),grounding=clamp(i.grounding01);
    const causal=clamp(i.causal01),workspace=clamp(i.workspace01);
    const novelty=clamp(i.novelty01),actionScore=clamp(i.actionScore01);
    const modeStreak=mode===this.state.currentMode?Math.min(1_000_000,this.state.modeStreak+1):1;
    const diversity=new Set([...this.state.recentModes.slice(-8),mode]).size/Math.max(1,Math.min(8,this.state.recentModes.length+1));
    const monotony=clamp(1-diversity);
    const noveltyPressure=clamp(monotony*.55+novelty*.25+uncertainty*.2);
    const continuity=clamp(identity*.25+memory*.2+grounding*.12+causal*.12+workspace*.11+(1-predictionError)*.1+capacity*.1);
    const coherence=clamp(workspace*.2+grounding*.16+causal*.16+(1-uncertainty)*.16+capacity*.14+memory*.1+(1-gap)*.08);
    const agency=clamp((i.externalInput ? .55 : .72)+(actionScore-.5)*.18-uncertainty*.08);
    const realityAlignment=clamp(1-gap);
    this.state.cycles=Math.min(1_000_000,this.state.cycles+1);
    this.state.lastTick=tick;this.state.lastAction=action;this.state.currentMode=mode;this.state.modeStreak=modeStreak;
    this.state.recentModes=[...this.state.recentModes,mode].slice(-32);
    this.state.recentActions=[...this.state.recentActions,action].slice(-32);
    this.state.continuity01=clamp(this.state.continuity01*.94+continuity*.06);
    this.state.coherence01=clamp(this.state.coherence01*.9+coherence*.1);
    this.state.agency01=clamp(this.state.agency01*.92+agency*.08);
    this.state.realityAlignment01=clamp(this.state.realityAlignment01*.93+realityAlignment*.07);
    this.state.noveltyPressure01=clamp(this.state.noveltyPressure01*.88+noveltyPressure*.12);
    this.state.lastReason='mode='+mode+';streak='+modeStreak+';novelty='+this.state.noveltyPressure01.toFixed(3);
    return this.snapshot();
  }
  actionBias(action:P80Mode):number {
    const same=this.state.recentActions.slice(-6).filter(a=>a===action).length/6;
    const repetitionPenalty=clamp(same)*this.state.noveltyPressure01*.08;
    const safety=action==='rest' ? .01 : 0;
    return clamp((action==='wait'?-repetitionPenalty:0)-repetitionPenalty+safety)-.5;
  }
}
