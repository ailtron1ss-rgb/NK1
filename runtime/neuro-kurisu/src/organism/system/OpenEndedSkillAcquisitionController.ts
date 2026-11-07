/** BIG PASS 230 — open-ended skill gap discovery, practice and evaluation. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface SkillTrack{id:string;domain:string;target01:number;mastery01:number;practice:number;status:'queued'|'active'|'mastered'|'deferred';createdAt:number;updatedAt:number;}
export interface SkillState{version:1;cycles:number;created:number;practiced:number;mastered:number;evaluated:number;meanMastery01:number;active:string|null;tracks:SkillTrack[];}
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
const strOrNull=(v:unknown,n=160):string|null=>typeof v==='string'&&v?v.slice(0,n):null;
const STATUSES:Array<SkillTrack['status']>=['queued','active','mastered','deferred'];
const sanTrack=(x:unknown):SkillTrack|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {id:str(r.id,'skill:0'),domain:str(r.domain,'unknown'),target01:clamp(finN(r.target01,.62)),mastery01:clamp(finN(r.mastery01,0)),practice:cnt(r.practice,0),status:STATUSES.includes(r.status as SkillTrack['status'])?r.status as SkillTrack['status']:'queued',createdAt:finN(r.createdAt,0),updatedAt:finN(r.updatedAt,0)};};
export const defaultOpenEndedSkill=():SkillState=>({version:1,cycles:0,created:0,practiced:0,mastered:0,evaluated:0,meanMastery01:.31,active:null,tracks:[]});
export class OpenEndedSkillAcquisitionController{
 private state=defaultOpenEndedSkill();
 restore(raw?:Partial<SkillState>|null){const d=defaultOpenEndedSkill();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const tRaw=read('tracks');
this.state={version:1,cycles:cnt(read('cycles'),d.cycles),created:cnt(read('created'),d.created),practiced:cnt(read('practiced'),d.practiced),mastered:cnt(read('mastered'),d.mastered),evaluated:cnt(read('evaluated'),d.evaluated),meanMastery01:clamp(finN(read('meanMastery01'),d.meanMastery01)),active:strOrNull(read('active')),tracks:Array.isArray(tRaw)?(tRaw as unknown[]).slice(0,32).map(sanTrack).filter((x):x is SkillTrack=>x!==null):[]};
}
 snapshot(){return structuredClone(this.state);}
 cycle(input:{at:number;domain:string;gap01:number;learningPressure01:number;resource01:number;novelty01:number;identity01:number;availableSkillNames?:string[]}):{action:'create'|'practice'|'defer'|'master';track:SkillTrack|null;mastery01:number}{
  this.state.cycles++;
  const active=this.state.tracks.find(t=>t.status==='active') ?? null;
  if(active){const gain=clamp(.04+input.learningPressure01*.06+input.resource01*.04);active.mastery01=clamp(active.mastery01+gain);active.practice++;active.updatedAt=input.at;this.state.practiced++;this.state.active=active.id;if(active.mastery01>=active.target01){active.status='mastered';this.state.mastered++;this.state.active=null;this.state.meanMastery01=clamp(this.state.meanMastery01*.9+active.mastery01*.1);return{action:'master',track:structuredClone(active),mastery01:active.mastery01};}this.state.meanMastery01=clamp(this.state.meanMastery01*.93+active.mastery01*.07);return{action:'practice',track:structuredClone(active),mastery01:active.mastery01};}
  const eligible=input.gap01>.3&&input.learningPressure01>.24&&input.resource01>.3&&input.identity01>.45;
  if(!eligible){return{action:'defer',track:null,mastery01:this.state.meanMastery01};}
  const domain=input.availableSkillNames?.find(Boolean) ?? `${input.domain}-adaptive-skill`;
  const track:SkillTrack={id:`skill:${this.state.cycles}:${domain}`,domain,target01:clamp(.62+input.gap01*.25),mastery01:.08,practice:0,status:'active',createdAt:input.at,updatedAt:input.at};
  this.state.tracks=[track,...this.state.tracks].slice(0,32);this.state.created++;this.state.active=track.id;
  return{action:'create',track:structuredClone(track),mastery01:track.mastery01};
 }
 evaluate(trackId:string,outcome01:number,at:number){const t=this.state.tracks.find(x=>x.id===trackId);if(!t)return null;this.state.evaluated++;const q=clamp(outcome01);t.mastery01=clamp(t.mastery01*.75+q*.25);t.updatedAt=at;if(t.mastery01>=t.target01){if(t.status!=='mastered')this.state.mastered++;t.status='mastered';this.state.active=null;}return structuredClone(t);}
 summary(){return{cycles:this.state.cycles,created:this.state.created,practiced:this.state.practiced,mastered:this.state.mastered,evaluated:this.state.evaluated,meanMastery01:this.state.meanMastery01,active:this.state.active,tracks:this.state.tracks.map(t=>({id:t.id,domain:t.domain,mastery01:t.mastery01,status:t.status}))};}
}
