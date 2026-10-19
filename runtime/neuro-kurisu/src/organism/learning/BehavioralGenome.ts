import type { ActionKind } from '../core/types.ts';
export type BehavioralMode='explorer'|'guardian'|'analyst'|'social'|'recoverer';
export interface BehavioralGenomeState{version:1;active:BehavioralMode;selectionCounts:Record<BehavioralMode,number>;successByMode:Record<BehavioralMode,number>;lineage:string[];switches:number;lastReason:string;}
const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const modes:BehavioralMode[]=['explorer','guardian','analyst','social','recoverer'];
export const defaultBehavioralGenome=():BehavioralGenomeState=>({version:1,active:'analyst',selectionCounts:{explorer:0,guardian:0,analyst:0,social:0,recoverer:0},successByMode:{explorer:.5,guardian:.5,analyst:.5,social:.5,recoverer:.5},lineage:['analyst'],switches:0,lastReason:'initial'});
function modeActionBias(mode:BehavioralMode,action:ActionKind){return ({explorer:{explore:.10,verify:.03,rest:-.03},guardian:{verify:.11,wait:.04,explore:-.05},analyst:{reflect:.08,verify:.06},social:{respond:.11,reflect:.02},recoverer:{rest:.15,defer:.06,explore:-.09}} as any)[mode]?.[action]??0;}
export class BehavioralGenome{
 private state=defaultBehavioralGenome();
 restore(s:BehavioralGenomeState|undefined){this.state={...defaultBehavioralGenome(),...(s??{})};}
 snapshot(){return structuredClone(this.state);}
 select(input:{novelty01:number;uncertainty01:number;socialNeed01:number;energy01:number;thermal01:number;predictionError01:number;informationDeficit01:number}):BehavioralMode{
  const scores:Record<BehavioralMode,number>={explorer:input.novelty01*.46+input.informationDeficit01*.35+input.uncertainty01*.12,guardian:input.uncertainty01*.46+input.predictionError01*.32+input.thermal01*.15,social:input.socialNeed01*.76,analyst:input.uncertainty01*.32+input.predictionError01*.34+input.informationDeficit01*.24,recoverer:(1-input.energy01)*.65+input.thermal01*.35};
  for(const mode of modes)scores[mode]+=this.state.successByMode[mode]*.08;
  const next=modes.sort((a,b)=>scores[b]-scores[a])[0];
  if(next!==this.state.active){this.state.switches++;this.state.lineage=[next,...this.state.lineage].slice(0,32);}
  this.state.active=next;this.state.selectionCounts[next]++;this.state.lastReason=`energy=${input.energy01.toFixed(2)} uncertainty=${input.uncertainty01.toFixed(2)} novelty=${input.novelty01.toFixed(2)}`; return next;
 }
 bias(action:ActionKind){return modeActionBias(this.state.active,action);}
 observeOutcome(success01:number){const mode=this.state.active;const old=this.state.successByMode[mode]??.5;this.state.successByMode[mode]=c(old*.9+c(success01)*.1);}
}
