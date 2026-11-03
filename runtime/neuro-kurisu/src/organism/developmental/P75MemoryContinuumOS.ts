export interface P75Input { tick:number; pressure01:number; recentEpisodes:number; semanticNodes:number; activeGoals:number; energy01:number; textPresent:boolean; experienceHot?:number; experienceWarm?:number; experienceCold?:number; identityTension01?:number; }
export interface P75State { version:1; cycles:number; hotBudget:number; warmBudget:number; coldBudget:number; retrievalFocus:string; consolidationCount:number; forgottenCount:number; continuity01:number; health01:number; recentModes:string[]; }
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finiteOr=(value:unknown,fallback:number):number=>{
  const numeric=typeof value==='number'?value:typeof value==='string'&&value.trim().length?Number(value):NaN;
  return Number.isFinite(numeric)?numeric:(Number.isFinite(fallback)?fallback:0);
};
const countOr=(value:unknown,fallback:number):number=>Math.max(0,Math.floor(finiteOr(value,fallback)));
const textOr=(value:unknown,fallback:string):string=>typeof value==='string'&&value.length?value.slice(0,120):fallback;
export const defaultP75=():P75State=>({version:1,cycles:0,hotBudget:32,warmBudget:192,coldBudget:1024,retrievalFocus:'recent',consolidationCount:0,forgottenCount:0,continuity01:0.85,health01:0.85,recentModes:[]});
export class P75MemoryContinuumOS{
 private state=JSON.parse(JSON.stringify(defaultP75())) as P75State;
 /**
  * Restore without trusting the snapshot: continuity/health feed multiplicative
  * EMAs, budgets must stay finite integers, and `retrievalFocus`/`recentModes`
  * must not inject arbitrary strings. Every read is own-data and cannot throw.
  */
 restore(raw:Partial<P75State>|undefined){
  const d=defaultP75();
  const source=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};
  const read=(key:string):unknown=>{try{return (source as Record<string,unknown>)[key];}catch{return undefined;}};
  const modesRaw=read('recentModes');
  this.state={
   version:1,
   cycles:countOr(read('cycles'),d.cycles),
   hotBudget:countOr(read('hotBudget'),d.hotBudget),
   warmBudget:countOr(read('warmBudget'),d.warmBudget),
   coldBudget:countOr(read('coldBudget'),d.coldBudget),
   retrievalFocus:textOr(read('retrievalFocus'),d.retrievalFocus),
   consolidationCount:countOr(read('consolidationCount'),d.consolidationCount),
   forgottenCount:countOr(read('forgottenCount'),d.forgottenCount),
   continuity01:clamp(finiteOr(read('continuity01'),d.continuity01)),
   health01:clamp(finiteOr(read('health01'),d.health01)),
   recentModes:Array.isArray(modesRaw)?modesRaw.filter((m):m is string=>typeof m==='string').map(m=>m.slice(0,80)).slice(-24):[],
  };
 }
 snapshot(){return JSON.parse(JSON.stringify(this.state)) as P75State;}
 plan(i:P75Input){
  this.state.cycles++;
  const pressure=clamp(i.pressure01);
  const experienceHot=Math.max(0,Math.min(96,Math.floor(i.experienceHot??0)));
  const experienceWarm=Math.max(0,Math.min(320,Math.floor(i.experienceWarm??0)));
  const experienceCold=Math.max(0,Math.min(1024,Math.floor(i.experienceCold??0)));
  const identityTension=clamp(i.identityTension01??0);
  const hot=Math.max(16,Math.min(64,Math.round(24+i.recentEpisodes*.6+i.activeGoals*2-pressure*12+Math.min(32,experienceHot)*.18+identityTension*8)));
  const warm=Math.max(96,Math.min(320,Math.round(128+i.semanticNodes*.4-pressure*32+Math.min(64,experienceWarm)*.12)));
  const cold=Math.max(512,Math.min(2048,Math.round(768+i.semanticNodes*1.2+Math.min(192,experienceCold)*.18)));
  this.state.hotBudget=hot; this.state.warmBudget=warm; this.state.coldBudget=cold;
  this.state.retrievalFocus=identityTension>.55?'identity-critical':i.textPresent?'semantic-relevant':pressure>.65?'consolidation':'recent';
  if(pressure>.68||identityTension>.72){this.state.consolidationCount++;}
  this.state.health01=clamp(.72+(i.textPresent?.1:0)+((1-pressure)*.12));
  this.state.continuity01=clamp(.82+(Math.min(i.recentEpisodes,32)/32)*.12-(pressure*.08));
  this.state.recentModes=[...this.state.recentModes,this.state.retrievalFocus].slice(-24);
  const canonicalBudget=Math.max(128,Math.min(1600,Math.round(hot+warm+cold*(0.52-pressure*.22))));
  return {hotBudget:hot,warmBudget:warm,coldBudget:cold,canonicalBudget,retrievalFocus:this.state.retrievalFocus,health01:this.state.health01,continuity01:this.state.continuity01,shouldConsolidate:pressure>.68};
 }
 recordForget(count:number){this.state.forgottenCount+=Math.max(0,Math.floor(count));}
}
