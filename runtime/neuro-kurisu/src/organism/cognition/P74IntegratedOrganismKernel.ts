export type P74Mode = 'observe'|'engage'|'protect'|'consolidate'|'explore'|'reflect'|'rest';
export interface P74Candidate { action:string; score:number; confidence01:number; reversible:boolean; userRequested?:boolean; }
export interface P74Input {
  tick:number; at:number;
  identity01:number; identityDrift01:number;
  grounding01:number; causal01:number; predictionAccuracy01:number;
  uncertainty01:number; novelty01:number; socialNeed01:number; goalPressure01:number;
  energy01:number; thermal01:number; cognitiveCapacity01:number;
  memoryHealth01:number; memoryPressure01:number; homeostaticPressure01:number;
  workspace01:number; metacognitive01:number; realityGap01:number;
  developmentalReadiness01:number; lastMode:P74Mode|null;
  candidates:P74Candidate[];
}
export interface P74State {
  version:1; ticks:number; mode:P74Mode; modeStreak:number; lastMode:P74Mode|null;
  integration01:number; attentionBudget01:number; selfWorld01:number; epistemic01:number; developmental01:number;
  modeCounts:Record<P74Mode,number>; recentModes:P74Mode[]; recentActions:string[];
  lastReasons:string[]; lastAt:number;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export const defaultP74=():P74State=>({version:1,ticks:0,mode:'observe',modeStreak:0,lastMode:null,integration01:0,selfWorld01:.7,epistemic01:.5,developmental01:.3,attentionBudget01:.8,modeCounts:{observe:0,engage:0,protect:0,consolidate:0,explore:0,reflect:0,rest:0},recentModes:[],recentActions:[],lastReasons:[],lastAt:0});

export class P74IntegratedOrganismKernel {
  private state=P74StateClone(defaultP74());
  restore(raw:Partial<P74State>|undefined){ if(!raw) return; const d=defaultP74(); this.state={...d,...raw,modeCounts:{...d.modeCounts,...(raw.modeCounts??{})},recentModes:Array.isArray(raw.recentModes)?raw.recentModes.slice(-32):[],recentActions:Array.isArray(raw.recentActions)?raw.recentActions.slice(-32):[],lastReasons:Array.isArray(raw.lastReasons)?raw.lastReasons.slice(-8):[]}; }
  snapshot(){ return P74StateClone(this.state); }
  evaluate(i:P74Input){
    const selfWorld=clamp((i.identity01*.24+i.grounding01*.18+i.causal01*.22+i.predictionAccuracy01*.16+(1-i.realityGap01)*.20));
    const epistemic=clamp((i.metacognitive01*.3+i.predictionAccuracy01*.25+(1-i.uncertainty01)*.2+(1-i.realityGap01)*.25));
    const integration=clamp(i.workspace01*.2+selfWorld*.2+epistemic*.15+i.memoryHealth01*.15+i.cognitiveCapacity01*.1+i.energy01*.1+(1-i.thermal01)*.05+(1-i.memoryPressure01)*.05);
    let mode:P74Mode='observe'; const reasons:string[]=[];
    if(i.energy01<.15 || i.thermal01>.86 || i.cognitiveCapacity01<.18){mode='rest';reasons.push('body_budget');}
    else if(i.identityDrift01>.42 || i.realityGap01>.65){mode='protect';reasons.push('identity_or_reality_gap');}
    else if(i.memoryPressure01>.72 || i.homeostaticPressure01>.72){mode='consolidate';reasons.push('consolidation_pressure');}
    else if(i.uncertainty01>.72 || i.predictionAccuracy01<.42){mode='reflect';reasons.push('epistemic_uncertainty');}
    else if(i.socialNeed01>.72 && i.goalPressure01>.32){mode='engage';reasons.push('social_goal_alignment');}
    else if(i.novelty01>.7 && i.developmentalReadiness01>.55 && i.realityGap01<.45){mode='explore';reasons.push('safe_novelty');}
    else if(i.goalPressure01>.48){mode='engage';reasons.push('goal_pressure');}
    else reasons.push('stable_observation');
    const recentSame=this.state.recentModes.slice(-4).filter(m=>m===mode).length;
    if(recentSame>=4 && mode!=='rest' && i.goalPressure01<.7){
      const alternatives:(P74Mode[]) = i.energy01>.4?['observe','reflect','consolidate']:['rest','consolidate'];
      mode=alternatives.find(m=>m!==mode)??mode; reasons.push('anti_monoculture');
    }
    const attention=clamp(.35+i.cognitiveCapacity01*.25+i.goalPressure01*.15+i.workspace01*.15+(1-i.uncertainty01)*.1-i.memoryPressure01*.08);
    this.state.ticks+=1; this.state.lastMode=this.state.mode; this.state.mode=mode; this.state.modeStreak=this.state.lastMode===mode?this.state.modeStreak+1:1;
    this.state.integration01=integration; this.state.selfWorld01=selfWorld; this.state.epistemic01=epistemic; this.state.attentionBudget01=attention; this.state.developmental01=clamp(i.developmentalReadiness01*(1-i.realityGap01*.35));
    this.state.modeCounts[mode]+=1; this.state.recentModes=[...this.state.recentModes,mode].slice(-32); this.state.recentActions=[...this.state.recentActions,...i.candidates.slice(0,1).map(c=>c.action)].slice(-32); this.state.lastReasons=reasons; this.state.lastAt=i.at;
    return {mode, integration01:integration, attentionBudget01:attention, selfWorld01:selfWorld, epistemic01:epistemic, developmental01:this.state.developmental01,reasons};
  }
  biasCandidates(candidates:P74Candidate[], frame:ReturnType<P74IntegratedOrganismKernel['evaluate']>){
    const modeBonus:Record<P74Mode,Partial<Record<string,number>>>= {
      rest:{rest:.08,wait:.04}, protect:{verify:.06,reflect:.05,rest:.04}, consolidate:{reflect:.06,verify:.04,remember:.03}, reflect:{reflect:.08,verify:.06,observe:.02}, engage:{talk:.07,respond:.05,act:.03}, explore:{explore:.08,experiment:.06,observe:.02}, observe:{observe:.05,wait:.03}
    };
    const bonuses=modeBonus[frame.mode]??{};
    return candidates.map(c=>({...c,score:clamp(c.score+(bonuses[c.action]??0)+(c.reversible?0.01:0)),confidence01:clamp(c.confidence01*.88+frame.epistemic01*.12)}));
  }
}
function P74StateClone(s:P74State):P74State{return JSON.parse(JSON.stringify(s));}
