/** B288 compatibility owner: canonical social-brain state is B288SocialPredictiveSelfOtherBrain. Keep this module until retirement criteria in reports/B288_SOCIAL_DUPLICATE_CONSOLIDATION_MAP_RU.md are satisfied. */
/** BIG PASS 227 — self-directed social/relationship continuity. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface RelationshipState{
  version:1; cycles:number; initiatives:number; followUps:number; resolved:number;
  meanSocialNeed01:number; meanReciprocity01:number; meanContinuity01:number;
  contacts:Record<string,{trust01:number;familiarity01:number;lastAt:number;pendingFollowUp:boolean;interactions:number}>;
}
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
const sanContact=(x:unknown):RelationshipState['contacts'][string]|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {trust01:clamp(finN(r.trust01,.5)),familiarity01:clamp(finN(r.familiarity01,0)),lastAt:finN(r.lastAt,0),pendingFollowUp:r.pendingFollowUp===true,interactions:cnt(r.interactions,0)};};
const sanContacts=(v:unknown):RelationshipState['contacts']=>{const r=(v&&typeof v==='object')?v as Record<string,unknown>:{};const out:RelationshipState['contacts']={};for(const k of Object.keys(r)){const c=sanContact(r[k]);if(c)out[k]=c;}return out;};
export const defaultAutonomousRelationship=():RelationshipState=>({
  version:1,cycles:0,initiatives:0,followUps:0,resolved:0,meanSocialNeed01:.25,
  meanReciprocity01:.5,meanContinuity01:.55,contacts:{}
});
export class AutonomousRelationshipManager {
  private state=defaultAutonomousRelationship();
  restore(raw?:Partial<RelationshipState>|null){
    const d=defaultAutonomousRelationship();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    this.state={version:1,cycles:cnt(read('cycles'),d.cycles),initiatives:cnt(read('initiatives'),d.initiatives),followUps:cnt(read('followUps'),d.followUps),resolved:cnt(read('resolved'),d.resolved),meanSocialNeed01:clamp(finN(read('meanSocialNeed01'),d.meanSocialNeed01)),meanReciprocity01:clamp(finN(read('meanReciprocity01'),d.meanReciprocity01)),meanContinuity01:clamp(finN(read('meanContinuity01'),d.meanContinuity01)),contacts:sanContacts(read('contacts'))};
  }
  snapshot(){return structuredClone(this.state);}
  cycle(input:{
    at:number;externalInput:boolean;socialNeed01:number;identity01:number;energy01:number;
    activeGoalCount:number;knownContactId?:string|null;outcome01:number;
  }) {
    const social=clamp(input.socialNeed01);
    const autonomous=!input.externalInput&&social>.42&&input.identity01>.5&&input.energy01>.18;
    this.state.cycles++;
    this.state.meanSocialNeed01=clamp(this.state.meanSocialNeed01*.94+social*.06);
    const id=input.knownContactId??'local-social-context';
    const c=this.state.contacts[id]??{trust01:.48,familiarity01:.18,lastAt:input.at,pendingFollowUp:false,interactions:0};
    c.lastAt=input.at;c.interactions++;
    c.trust01=clamp(c.trust01*.9+clamp(input.outcome01)*.1);c.familiarity01=clamp(c.familiarity01*.96+.04);
    if(autonomous){this.state.initiatives++;c.pendingFollowUp=true;this.state.followUps++;}
    else if(input.externalInput&&c.pendingFollowUp){c.pendingFollowUp=false;this.state.resolved++;}
    this.state.contacts[id]=c;
    this.state.meanReciprocity01=clamp(this.state.meanReciprocity01*.95+c.trust01*.05);
    this.state.meanContinuity01=clamp(this.state.meanContinuity01*.95+(c.familiarity01*.6+c.trust01*.4)*.05);
    return{autonomous,domain:'relationship' as const,socialNeed01:social,trust01:c.trust01,pendingFollowUp:c.pendingFollowUp};
  }
  summary(){return{
    cycles:this.state.cycles,initiatives:this.state.initiatives,followUps:this.state.followUps,resolved:this.state.resolved,
    meanSocialNeed01:this.state.meanSocialNeed01,meanReciprocity01:this.state.meanReciprocity01,
    meanContinuity01:this.state.meanContinuity01,contacts:Object.keys(this.state.contacts).length
  };}
}
