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
const MODES:readonly P80Mode[]=['respond','explore','verify','reflect','rest','wait','defer'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const ownData=(value:unknown,key:string):unknown=>{
  if(value===null||typeof value!=='object')return undefined;
  const descriptor=Object.getOwnPropertyDescriptor(value,key);
  return descriptor&&Object.prototype.hasOwnProperty.call(descriptor,'value')?descriptor.value:undefined;
};
const safeCounter=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:fallback;
const safeUnit=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?clamp(value):fallback;
const safeText=(value:unknown,fallback:string,max=160)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max?value.trim():fallback;
function safeArray<T>(value:unknown,max:number,accept:(item:unknown)=>item is T):T[]|null{
  try{
    if(!Array.isArray(value))return null;
    const length=ownData(value,'length');
    if(typeof length!=='number'||!Number.isSafeInteger(length)||length<0||length>max)return null;
    const result:T[]=[];
    for(let i=0;i<length;i++){
      const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
      if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value')||!accept(descriptor.value))return null;
      result.push(descriptor.value);
    }
    return result;
  }catch{return null;}
}
const isMode=(value:unknown):value is P80Mode=>typeof value==='string'&&MODES.includes(value as P80Mode);
const isAction=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=96;
export const defaultP80=():P80State=>({version:1,cycles:0,continuity01:.9,coherence01:.8,agency01:.5,realityAlignment01:.5,currentMode:'wait',recentModes:[],recentActions:[],modeStreak:0,noveltyPressure01:.2,lastTick:0,lastAction:'wait',lastReason:''});
export class P80UnifiedSelfState {
  private state=defaultP80();
  restore(raw:unknown){
    const defaults=defaultP80();
    try{
      if(raw===null||typeof raw!=='object'||Array.isArray(raw)||Object.getPrototypeOf(raw)!==Object.prototype&&Object.getPrototypeOf(raw)!==null){this.state=defaults;return;}
      const version=ownData(raw,'version');
      if(version!==undefined&&version!==1){this.state=defaults;return;}
      const recentModesRaw=ownData(raw,'recentModes');
      const recentActionsRaw=ownData(raw,'recentActions');
      const recentModes=recentModesRaw===undefined?[]:safeArray(recentModesRaw,32,isMode);
      const recentActions=recentActionsRaw===undefined?[]:safeArray(recentActionsRaw,32,isAction);
      if(recentModes===null||recentActions===null){this.state=defaults;return;}
      const mode=ownData(raw,'currentMode');
      const lastAction=ownData(raw,'lastAction');
      this.state={
        version:1,
        cycles:safeCounter(ownData(raw,'cycles'),defaults.cycles),
        continuity01:safeUnit(ownData(raw,'continuity01'),defaults.continuity01),
        coherence01:safeUnit(ownData(raw,'coherence01'),defaults.coherence01),
        agency01:safeUnit(ownData(raw,'agency01'),defaults.agency01),
        realityAlignment01:safeUnit(ownData(raw,'realityAlignment01'),defaults.realityAlignment01),
        currentMode:isMode(mode)?mode:defaults.currentMode,
        recentModes,recentActions,
        modeStreak:safeCounter(ownData(raw,'modeStreak'),defaults.modeStreak),
        noveltyPressure01:safeUnit(ownData(raw,'noveltyPressure01'),defaults.noveltyPressure01),
        lastTick:safeCounter(ownData(raw,'lastTick'),defaults.lastTick),
        lastAction:isAction(lastAction)?lastAction:defaults.lastAction,
        lastReason:safeText(ownData(raw,'lastReason'),defaults.lastReason),
      };
    }catch{
      // A persisted self-model is untrusted input; recovery must not abort the organism loop.
      this.state=defaults;
    }
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
    // Apply the action-quality and uncertainty terms for both externally triggered
    // and self-initiated cycles; external input changes the prior, not the formula.
    const agency=clamp((i.externalInput?.55:.72)+(i.actionScore01-.5)*.18-i.uncertainty01*.08);
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
