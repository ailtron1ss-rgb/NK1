export interface P78Event {at:number; tick:number; action:string; outcome?:number|null; text?:string; mode?:string;}
export interface P78State {version:2; chapters:number; samples:number; continuity01:number; narrativeCoherence01:number; selfAuthorship01:number; turningPoints:number; recentSummary:string; chaptersData:Array<{id:string;fromTick:number;toTick:number;summary:string;significance01:number}>; lastObservationKey:string;}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finiteOr=(value:unknown,fallback:number):number=>{
  const numeric=typeof value==='number'?value:typeof value==='string'&&value.trim().length?Number(value):NaN;
  return Number.isFinite(numeric)?numeric:(Number.isFinite(fallback)?fallback:0);
};
const countOr=(value:unknown,fallback:number):number=>Math.max(0,Math.floor(finiteOr(value,fallback)));
const textOr=(value:unknown,fallback:string,max=512):string=>typeof value==='string'?value.slice(0,max):fallback;
export const defaultP78=():P78State=>({version:2,chapters:0,samples:0,continuity01:.72,narrativeCoherence01:.65,selfAuthorship01:.5,turningPoints:0,recentSummary:'Начало текущего жизненного периода.',chaptersData:[],lastObservationKey:''});
export class P78AutobiographicalSelfContinuity{
 private state=JSON.parse(JSON.stringify(defaultP78())) as P78State;
 /**
  * Restore without trusting the snapshot: continuity/coherence/authorship feed
  * multiplicative EMAs, so NaN would permanently poison the autobiographical
  * self. Chapter rows are element-validated and bounded; every read is own-data
  * and cannot throw.
  */
 restore(raw:Partial<P78State>|undefined){
  const d=defaultP78();
  const source=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};
  const read=(key:string):unknown=>{try{return (source as Record<string,unknown>)[key];}catch{return undefined;}};
  const chaptersRaw=read('chaptersData');
  this.state={
   version:2,
   chapters:countOr(read('chapters'),d.chapters),
   samples:countOr(read('samples'),d.samples),
   continuity01:clamp(finiteOr(read('continuity01'),d.continuity01)),
   narrativeCoherence01:clamp(finiteOr(read('narrativeCoherence01'),d.narrativeCoherence01)),
   selfAuthorship01:clamp(finiteOr(read('selfAuthorship01'),d.selfAuthorship01)),
   turningPoints:countOr(read('turningPoints'),d.turningPoints),
   recentSummary:textOr(read('recentSummary'),d.recentSummary,2000),
   chaptersData:Array.isArray(chaptersRaw)?chaptersRaw.filter((c):c is {id:string;fromTick:number;toTick:number;summary:string;significance01:number}=>Boolean(c)&&typeof c==='object'&&typeof (c as any).id==='string').map((c:any)=>({id:String(c.id).slice(0,120),fromTick:countOr(c.fromTick,0),toTick:countOr(c.toTick,0),summary:String(c.summary??'').slice(0,600),significance01:clamp(finiteOr(c.significance01,0))})).slice(-32):[],
   lastObservationKey:textOr(read('lastObservationKey'),d.lastObservationKey,4096),
  };
 }
 snapshot(){return JSON.parse(JSON.stringify(this.state)) as P78State;}
 observe(events:P78Event[]){
  const recent=events.slice(-16);
  if(!recent.length) return this.snapshot();
  const observationKey=recent.map(e=>`${e.tick}|${e.at}|${e.action}|${e.outcome??''}|${e.text??''}`).join('\u001f').slice(-4096);
  if(observationKey===this.state.lastObservationKey) return this.snapshot();
  this.state.lastObservationKey=observationKey;
  this.state.samples+=recent.length;
  const actions=new Set(recent.map(e=>e.action)); const outcomes=recent.filter(e=>typeof e.outcome==='number');
  const outcomeVariance=outcomes.length>1?Math.min(1,new Set(outcomes.map(e=>Math.round((e.outcome??0)*10))).size/5):.2;
  const authored=recent.filter(e=>e.action&&!['respond','wait'].includes(e.action)).length/Math.max(1,recent.length);
  const significance=clamp(.18+outcomeVariance*.28+authored*.3+(actions.size/6)*.24);
  const from=recent[0]!.tick,to=recent[recent.length-1]!.tick;
  const summary=`Период ${from}–${to}: действия=${[...actions].slice(0,4).join(',')||'none'}; внешние результаты=${outcomes.length}; режимы=${new Set(recent.map(e=>e.mode??'unknown')).size}.`;
  this.state.narrativeCoherence01=clamp(this.state.narrativeCoherence01*.92+((actions.size/6)*.35+.65)*.08);
  this.state.selfAuthorship01=clamp(this.state.selfAuthorship01*.9+authored*.1);
  this.state.continuity01=clamp(this.state.continuity01*.94+(1-Math.min(1,Math.abs(outcomeVariance-.4))*.3)*.06);
  if(significance>.6){this.state.turningPoints++;this.state.chapters++;this.state.chaptersData=[...this.state.chaptersData,{id:`p78:${to}:${this.state.chapters}`,fromTick:from,toTick:to,summary,significance01:significance}].slice(-32);}
  this.state.recentSummary=summary;
  return this.snapshot();
 }

}
