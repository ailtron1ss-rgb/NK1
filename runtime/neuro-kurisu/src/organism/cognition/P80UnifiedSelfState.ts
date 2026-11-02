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
    // Persistence input is untrusted: use own data descriptors and rebuild an
    // allow-listed state rather than spreading caller-controlled objects.
    const defaults=defaultP80();
    const container=(value:unknown):Record<string,unknown>|null=>{
      try {
        if(!value || typeof value!=='object' || Array.isArray(value)) return null;
        const proto=Object.getPrototypeOf(value);
        return proto===Object.prototype || proto===null ? value as Record<string,unknown> : null;
      } catch { return null; }
    };
    const record=(value:unknown):Record<string,unknown>|null=>{
      const row=container(value);
      if(!row) return null;
      try {
        for(const key of Reflect.ownKeys(row)){
          const descriptor=Object.getOwnPropertyDescriptor(row,key);
          if(!descriptor || !('value' in descriptor)) return null;
        }
        return row;
      } catch { return null; }
    };
    const source=record(raw);
    if(!source){ this.state=defaults; return; }
    const read=(row:unknown,key:string):unknown=>{
      const safe=container(row);
      if(!safe) return undefined;
      try {
        const descriptor=Object.getOwnPropertyDescriptor(safe,key);
        return descriptor && 'value' in descriptor ? descriptor.value : undefined;
      } catch { return undefined; }
    };
    const bounded=(value:unknown,fallback:number):number=>
      typeof value==='number' && Number.isFinite(value) ? clamp(value) : fallback;
    const count=(value:unknown,fallback=0):number=>
      typeof value==='number' && Number.isSafeInteger(value) ? Math.max(0,Math.min(1_000_000_000,value)) : fallback;
    const values=(value:unknown):unknown[]=>{
      try {
        if(!Array.isArray(value)) return [];
        const descriptor=Object.getOwnPropertyDescriptor(value,'length');
        const length=descriptor && 'value' in descriptor && typeof descriptor.value==='number'
          ? Math.max(0,Math.min(128,Math.floor(descriptor.value))) : 0;
        const result:unknown[]=[];
        for(let i=0;i<length;i++){
          const item=Object.getOwnPropertyDescriptor(value,String(i));
          if(item && 'value' in item) result.push(item.value);
        }
        return result;
      } catch { return []; }
    };
    const modes:readonly P80Mode[]=['respond','explore','verify','reflect','rest','wait','defer'];
    const recentModes=values(read(source,'recentModes')).filter((item):item is P80Mode=>
      typeof item==='string' && modes.includes(item as P80Mode)).slice(-32);
    const recentActions=values(read(source,'recentActions')).filter((item):item is string=>
      typeof item==='string' && item.trim().length>0 && item.length<=120).map(item=>item.trim()).slice(-32);
    const current=read(source,'currentMode');
    const lastAction=read(source,'lastAction');
    const lastReason=read(source,'lastReason');
    this.state={
      version:1,
      cycles:count(read(source,'cycles'),defaults.cycles),
      continuity01:bounded(read(source,'continuity01'),defaults.continuity01),
      coherence01:bounded(read(source,'coherence01'),defaults.coherence01),
      agency01:bounded(read(source,'agency01'),defaults.agency01),
      realityAlignment01:bounded(read(source,'realityAlignment01'),defaults.realityAlignment01),
      currentMode:typeof current==='string' && modes.includes(current as P80Mode)?current as P80Mode:defaults.currentMode,
      recentModes,
      recentActions,
      modeStreak:count(read(source,'modeStreak'),defaults.modeStreak),
      noveltyPressure01:bounded(read(source,'noveltyPressure01'),defaults.noveltyPressure01),
      lastTick:count(read(source,'lastTick'),defaults.lastTick),
      lastAction:typeof lastAction==='string' && lastAction.trim().length>0 && lastAction.length<=80?lastAction.trim():defaults.lastAction,
      lastReason:typeof lastReason==='string'?lastReason.slice(0,240):defaults.lastReason,
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
