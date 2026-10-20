/** BIG PASS 230 — open-ended skill gap discovery, practice and evaluation. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface SkillTrack{id:string;domain:string;target01:number;mastery01:number;practice:number;status:'queued'|'active'|'mastered'|'deferred';createdAt:number;updatedAt:number;}
export interface SkillState{version:1;cycles:number;created:number;practiced:number;mastered:number;evaluated:number;meanMastery01:number;active:string|null;tracks:SkillTrack[];}
export const defaultOpenEndedSkill=():SkillState=>({version:1,cycles:0,created:0,practiced:0,mastered:0,evaluated:0,meanMastery01:.31,active:null,tracks:[]});
export class OpenEndedSkillAcquisitionController{
 private state=defaultOpenEndedSkill();
 restore(raw?:Partial<SkillState>|null){const d=defaultOpenEndedSkill(),r=raw??{};this.state={...d,...r,tracks:Array.isArray(r.tracks)?structuredClone(r.tracks).slice(0,32):[],version:1};}
 snapshot(){return structuredClone(this.state);}
 cycle(input:{at:number;domain:string;gap01:number;learningPressure01:number;resource01:number;novelty01:number;identity01:number;availableSkillNames?:string[]}):{action:'create'|'practice'|'defer'|'master';track:SkillTrack|null;mastery01:number}{
  this.state.cycles++;
  const active=this.state.tracks.find(t=>t.status==='active') ?? null;
  if(active){if(active.practice>=8){active.status='deferred';active.updatedAt=input.at;this.state.active=null;return{action:'defer',track:structuredClone(active),mastery01:active.mastery01};}active.practice++;active.updatedAt=input.at;this.state.practiced++;this.state.active=active.id;return{action:'practice',track:structuredClone(active),mastery01:active.mastery01};}
  const eligible=input.gap01>.3&&input.learningPressure01>.24&&input.resource01>.3&&input.identity01>.45;
  if(!eligible){return{action:'defer',track:null,mastery01:this.state.meanMastery01};}
  const candidates=[...new Set((input.availableSkillNames??[]).map(x=>String(x).trim()).filter(Boolean))];const requested=String(input.domain??'').trim().toLocaleLowerCase();const requestedCandidate=candidates.find(x=>x.toLocaleLowerCase()===requested);const previousDomain=this.state.tracks[0]?.domain;const previousCandidateIndex=candidates.findIndex(x=>x.toLocaleLowerCase()===String(previousDomain??'').toLocaleLowerCase());const repeatedDeferredRequest=Boolean(requestedCandidate&&candidates.length>1&&this.state.tracks[0]?.status==='deferred'&&requestedCandidate.toLocaleLowerCase()===String(previousDomain??'').toLocaleLowerCase());const rotatedCandidate=repeatedDeferredRequest?candidates[(previousCandidateIndex+1)%candidates.length]:null;const domain=requestedCandidate&&!repeatedDeferredRequest?requestedCandidate:rotatedCandidate??(candidates.length?candidates[this.state.created%candidates.length]:`${input.domain}-adaptive-skill`);
  const track:SkillTrack={id:`skill:${this.state.cycles}:${domain}`,domain,target01:clamp(.62+input.gap01*.25),mastery01:.08,practice:0,status:'active',createdAt:input.at,updatedAt:input.at};
  this.state.tracks=[track,...this.state.tracks].slice(0,32);this.state.created++;this.state.active=track.id;
  return{action:'create',track:structuredClone(track),mastery01:track.mastery01};
 }
 evaluate(trackId:string,outcome01:number,at:number,evidence:{verified:boolean;independent:boolean}){const t=this.state.tracks.find(x=>x.id===trackId);if(!t||t.status!=='active'||!evidence?.verified||!evidence?.independent)return null;this.state.evaluated++;const q=clamp(outcome01);t.mastery01=clamp(t.mastery01*.75+q*.25);t.updatedAt=at;this.state.meanMastery01=clamp(this.state.meanMastery01*.9+t.mastery01*.1);if(t.mastery01>=t.target01){t.status='mastered';this.state.mastered++;this.state.active=null;}return structuredClone(t);}
 summary(){return{cycles:this.state.cycles,created:this.state.created,practiced:this.state.practiced,mastered:this.state.mastered,evaluated:this.state.evaluated,meanMastery01:this.state.meanMastery01,active:this.state.active,tracks:this.state.tracks.map(t=>({id:t.id,domain:t.domain,mastery01:t.mastery01,status:t.status}))};}
}
