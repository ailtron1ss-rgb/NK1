/** B288 compatibility owner: canonical social-brain state is B288SocialPredictiveSelfOtherBrain. Keep this module until retirement criteria in reports/B288_SOCIAL_DUPLICATE_CONSOLIDATION_MAP_RU.md are satisfied. */
import type { RelationshipSelfState } from './RelationshipSelf.ts';
import type { SocialPrediction } from '../cognition/SocialWorldModel.ts';
export interface LongTermSocialMindState{relationships:RelationshipSelfState; predictions:SocialPrediction[]; sharedProjects:Record<string,string[]>; openCommitments:Record<string,string[]>; version:number;}
export const defaultLongTermSocialMind=():LongTermSocialMindState=>({relationships:{models:[],version:1},predictions:[],sharedProjects:{},openCommitments:{},version:1});
export class LongTermSocialMind{
 private state=defaultLongTermSocialMind();
 restore(s:LongTermSocialMindState|undefined){this.state={...defaultLongTermSocialMind(),...(s??{}),relationships:s?.relationships??{models:[],version:1},predictions:Array.isArray(s?.predictions)?s!.predictions.slice(0,128):[],sharedProjects:{...(s?.sharedProjects??{})},openCommitments:{...(s?.openCommitments??{})}};}
 observe(person:string,prediction:SocialPrediction){this.state.predictions=[prediction,...this.state.predictions.filter(x=>!(x.agent===prediction.agent && x.updatedAt===prediction.updatedAt))].slice(0,128);this.state.sharedProjects[person]=Array.from(new Set(this.state.sharedProjects[person]??[])).slice(-32);this.state.openCommitments[person]=Array.from(new Set(this.state.openCommitments[person]??[])).slice(-32);}
 snapshot(){return structuredClone(this.state);}
}
