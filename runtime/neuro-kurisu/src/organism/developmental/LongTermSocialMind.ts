/** B288 compatibility owner: canonical social-brain state is B288SocialPredictiveSelfOtherBrain. Keep this module until retirement criteria in reports/B288_SOCIAL_DUPLICATE_CONSOLIDATION_MAP_RU.md are satisfied. */
import type { RelationshipSelfState } from './RelationshipSelf.ts';
import { RelationshipSelf } from './RelationshipSelf.ts';
import type { SocialPrediction } from '../cognition/SocialWorldModel.ts';
export interface LongTermSocialMindState{relationships:RelationshipSelfState; predictions:SocialPrediction[]; sharedProjects:Record<string,string[]>; openCommitments:Record<string,string[]>; version:number;}
export const defaultLongTermSocialMind=():LongTermSocialMindState=>({relationships:{models:[],version:1},predictions:[],sharedProjects:{},openCommitments:{},version:1});
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const clampSigned=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const strMap=(v:unknown):Record<string,string[]>=>{const out:Record<string,string[]>={};if(v&&typeof v==='object')for(const [k,val] of Object.entries(v as Record<string,unknown>)){if(!Array.isArray(val))continue;out[k.slice(0,120)]=Array.from(new Set(val.filter((x):x is string=>typeof x==='string').map(x=>x.slice(0,160)))).slice(-32);}return out;};
const sanitizePrediction=(v:unknown):SocialPrediction|null=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>;if(typeof r.agent!=='string'||!r.agent)return null;return {agent:r.agent.slice(0,120),predictedNeed:typeof r.predictedNeed==='string'?r.predictedNeed.slice(0,120):'dialogue',predictedValence:clampSigned(finN(r.predictedValence,0)),confidence:Math.max(0,Math.min(1,finN(r.confidence,.5))),evidence:Array.isArray(r.evidence)?r.evidence.filter((x):x is string=>typeof x==='string').map(x=>x.slice(0,180)).slice(-16):[],updatedAt:Math.max(0,finN(r.updatedAt,0))};};
export class LongTermSocialMind{
 private state=defaultLongTermSocialMind();
 restore(s:LongTermSocialMindState|undefined){
  const src:Record<string,unknown>=(s&&typeof s==='object')?s as unknown as Record<string,unknown>:{};
  let relationships:RelationshipSelfState={models:[],version:1};
  try{const rs=new RelationshipSelf();rs.restore(src.relationships as RelationshipSelfState|undefined);relationships=rs.snapshot();}catch{relationships={models:[],version:1};}
  let predictions:SocialPrediction[]=[];
  try{const raw=src.predictions;if(Array.isArray(raw))predictions=raw.map(sanitizePrediction).filter((x):x is SocialPrediction=>x!==null).slice(0,128);}catch{predictions=[];}
  this.state={relationships,predictions,sharedProjects:strMap(src.sharedProjects),openCommitments:strMap(src.openCommitments),version:1};
 }
 observe(person:string,prediction:SocialPrediction){this.state.predictions=[prediction,...this.state.predictions.filter(x=>!(x.agent===prediction.agent && x.updatedAt===prediction.updatedAt))].slice(0,128);this.state.sharedProjects[person]=Array.from(new Set(this.state.sharedProjects[person]??[])).slice(-32);this.state.openCommitments[person]=Array.from(new Set(this.state.openCommitments[person]??[])).slice(-32);}
 snapshot(){return structuredClone(this.state);}
}
