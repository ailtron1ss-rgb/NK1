/** B288 compatibility owner: canonical social-brain state is B288SocialPredictiveSelfOtherBrain. Keep this module until retirement criteria in reports/B288_SOCIAL_DUPLICATE_CONSOLIDATION_MAP_RU.md are satisfied. */
export interface RelationshipSelfModel{person:string;role:string;trust:number;guardedness:number;warmth:number;predictability:number;sharedProjects:string[];openCommitments:string[];updatedAt:number;}
export interface RelationshipSelfState{models:RelationshipSelfModel[];version:number;}
export const defaultRelationshipSelf=():RelationshipSelfState=>({models:[],version:1});
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export class RelationshipSelf{private state=defaultRelationshipSelf();restore(s:RelationshipSelfState|undefined){this.state={...defaultRelationshipSelf(),...(s??{}),models:Array.isArray(s?.models)?s!.models.slice(0,64):[]};
}observe(person:string,success:number,socialSignal:number){let m=this.state.models.find(x=>x.person===person);if(!m){m={person,role:'known-contact',trust:.5,guardedness:.35,warmth:.5,predictability:.5,sharedProjects:[],openCommitments:[],updatedAt:Date.now()};
this.state.models.unshift(m);}m.trust=clamp(m.trust*.9+success*.1);m.predictability=clamp(m.predictability*.92+(1-Math.abs(socialSignal-.5)*2)*.08);m.warmth=clamp(m.warmth*.94+success*.06);m.guardedness=clamp(1-m.trust*.7);m.updatedAt=Date.now();return structuredClone(m);}snapshot(){return structuredClone(this.state);}}
