/** B288 compatibility owner: canonical social-brain state is B288SocialPredictiveSelfOtherBrain. Keep this module until retirement criteria in reports/B288_SOCIAL_DUPLICATE_CONSOLIDATION_MAP_RU.md are satisfied. */
export interface RelationshipSelfModel{person:string;role:string;trust:number;guardedness:number;warmth:number;predictability:number;sharedProjects:string[];openCommitments:string[];updatedAt:number;}
export interface RelationshipSelfState{models:RelationshipSelfModel[];version:number;}
export const defaultRelationshipSelf=():RelationshipSelfState=>({models:[],version:1});
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const fin=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:typeof v==='string'&&v.trim().length?Number(v):NaN;return Number.isFinite(n)?n:(Number.isFinite(f)?f:0);};
const strArr=(v:unknown,cap:number):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string').map(x=>x.slice(0,160)).slice(-cap):[];
const sanitizeModel=(v:unknown):RelationshipSelfModel|null=>{
  if(!v||typeof v!=='object')return null;
  const r=v as Record<string,unknown>;
  if(typeof r.person!=='string'||!r.person)return null;
  return {person:r.person.slice(0,120),role:typeof r.role==='string'?r.role.slice(0,80):'known-contact',trust:clamp(fin(r.trust,.5)),guardedness:clamp(fin(r.guardedness,.35)),warmth:clamp(fin(r.warmth,.5)),predictability:clamp(fin(r.predictability,.5)),sharedProjects:strArr(r.sharedProjects,32),openCommitments:strArr(r.openCommitments,32),updatedAt:Math.max(0,fin(r.updatedAt,0))};
};
export class RelationshipSelf{private state=defaultRelationshipSelf();restore(s:RelationshipSelfState|undefined){const src:Record<string,unknown>=(s&&typeof s==='object')?s as unknown as Record<string,unknown>:{};let models:RelationshipSelfModel[]=[];try{const raw=src.models;if(Array.isArray(raw))models=raw.map(sanitizeModel).filter((x):x is RelationshipSelfModel=>x!==null).slice(0,64);}catch{models=[];}this.state={models,version:1};}observe(person:string,success:number,socialSignal:number){let m=this.state.models.find(x=>x.person===person);if(!m){m={person,role:'known-contact',trust:.5,guardedness:.35,warmth:.5,predictability:.5,sharedProjects:[],openCommitments:[],updatedAt:Date.now()};
this.state.models.unshift(m);}m.trust=clamp(m.trust*.9+success*.1);m.predictability=clamp(m.predictability*.92+(1-Math.abs(socialSignal-.5)*2)*.08);m.warmth=clamp(m.warmth*.94+success*.06);m.guardedness=clamp(1-m.trust*.7);m.updatedAt=Date.now();return structuredClone(m);}snapshot(){return structuredClone(this.state);}}
