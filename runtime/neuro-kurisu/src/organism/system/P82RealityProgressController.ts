export interface P82Outcome { tick:number; capability01:number; complexity01:number; externalEvidence:boolean; identity01:number; continuity01:number; }
export interface P82State { version:1; observations:number; evidenceCount:number; capability01:number; complexity01:number; evidenceQuality01:number; complexityAdjustedProgress01:number; realityGap01:number; progressTrend01:number; lastExternalTick:number; recentProgress:number[]; }
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
export const defaultP82=():P82State=>({version:1,observations:0,evidenceCount:0,capability01:0,complexity01:0,evidenceQuality01:0,complexityAdjustedProgress01:0,realityGap01:1,progressTrend01:.5,lastExternalTick:0,recentProgress:[]});
export class P82RealityProgressController {
 private state=defaultP82();
 restore(raw:Partial<P82State>|undefined){if(!raw)return;const d=defaultP82();const src:Record<string,unknown>=raw as unknown as Record<string,unknown>;const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const rp=read('recentProgress');this.state={version:1,observations:cnt(read('observations'),d.observations),evidenceCount:cnt(read('evidenceCount'),d.evidenceCount),capability01:clamp(finN(read('capability01'),d.capability01)),complexity01:clamp(finN(read('complexity01'),d.complexity01)),evidenceQuality01:clamp(finN(read('evidenceQuality01'),d.evidenceQuality01)),complexityAdjustedProgress01:clamp(finN(read('complexityAdjustedProgress01'),d.complexityAdjustedProgress01)),realityGap01:clamp(finN(read('realityGap01'),d.realityGap01)),progressTrend01:clamp(finN(read('progressTrend01'),d.progressTrend01)),lastExternalTick:cnt(read('lastExternalTick'),d.lastExternalTick),recentProgress:Array.isArray(rp)?rp.slice(-32).map(x=>clamp(finN(x,0))):[]};}
 snapshot(){return JSON.parse(JSON.stringify(this.state)) as P82State;}
 observe(o:P82Outcome){
  this.state.observations++;
  const rawProgress=clamp(o.capability01*(.72+.28*o.identity01));
  const complexityPenalty=clamp(o.complexity01*.35);
  const adjusted=clamp(rawProgress*(1-complexityPenalty));
  if(o.externalEvidence){this.state.evidenceCount++; this.state.evidenceQuality01=clamp(this.state.evidenceQuality01*.94+.06); this.state.lastExternalTick=o.tick; this.state.realityGap01=clamp(this.state.realityGap01*.9+(Math.abs(o.capability01-o.continuity01))*.1);}
  this.state.capability01=clamp(this.state.capability01*.93+rawProgress*.07);
  this.state.complexity01=clamp(this.state.complexity01*.95+o.complexity01*.05);
  this.state.complexityAdjustedProgress01=clamp(this.state.complexityAdjustedProgress01*.92+adjusted*.08);
  this.state.progressTrend01=clamp(this.state.progressTrend01*.9+(adjusted-this.state.complexityAdjustedProgress01)*.1+.5*.1);
  this.state.recentProgress=[...this.state.recentProgress,adjusted].slice(-32);
  return this.snapshot();
 }
 shouldPromote(requiredEvidence:number=.65):boolean{return this.state.evidenceQuality01>=requiredEvidence && this.state.complexityAdjustedProgress01>.55 && this.state.realityGap01<.55;}
}
