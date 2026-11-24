import type { ActionKind, OrganismState } from '../core/types.ts';
import type { B265Environment, B265Episode } from './B265IndependentPolicyEvaluator.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};

export interface B266TaskFamily { id:string; seed:number; horizon:number; rewardDelay:number; drift:number; adversarial:boolean; difficulty:number; }
export interface B266EpisodeResult { familyId:string; heldout:boolean; return01:number; baseline01:number; random01:number; advantage01:number; delayedReward01:number; interventionGap01:number; robustness01:number; steps:number; }
export interface B266HiddenTaskGeneralizationState {
  version:1; families:B266TaskFamily[]; episodes:B266EpisodeResult[]; trainEpisodes:number; holdoutEpisodes:number;
  longHorizonGain01:number; delayedRewardGain01:number; hiddenFamilyGain01:number; robustness01:number;
  catastrophicShift01:number; calibration01:number; lastFamilyId:string|null; lastTick:number;
}

export interface B266ChallengePolicy {
  choose:(state:OrganismState,step:number,family:B266TaskFamily)=>ActionKind;
}

export function defaultB266HiddenTaskGeneralization():B266HiddenTaskGeneralizationState{
  return {version:1,families:[],episodes:[],trainEpisodes:0,holdoutEpisodes:0,longHorizonGain01:0,delayedRewardGain01:0,hiddenFamilyGain01:0,robustness01:0,catastrophicShift01:0,calibration01:.5,lastFamilyId:null,lastTick:0};
}

function makeFamily(seed:number,idx:number,heldout:boolean):B266TaskFamily{
  const h=hash(`${seed}:${idx}:${heldout?'H':'T'}`);
  return {id:`b266-${heldout?'holdout':'train'}-${idx}-${h.toString(16)}`,seed:h,horizon:heldout?12:10,rewardDelay:heldout?3+(h%3):2+(h%2),drift:heldout?0.08+((h%7)/100):0.03+((h%5)/100),adversarial:heldout && idx%2===1,difficulty:0.35+((h%31)/100)};
}

export function createB266Families(seed=20260912,train=8,holdout=6){
  return {train:Array.from({length:train},(_,i)=>makeFamily(seed,i,false)),holdout:Array.from({length:holdout},(_,i)=>makeFamily(seed,100+i,true))};
}

export function environmentForFamily(f:B266TaskFamily):B265Environment{
  return {
    taskId:f.id,
    initialState:[f.difficulty, f.drift, f.rewardDelay/5, f.adversarial?1:0, 0, 0, 0, 0],
    transition:(state,action,step)=>{
      const ai=ACTIONS.indexOf(action);
      const phase=(f.seed%17)/17;
      const target=Math.floor((phase*7+step*f.drift*10+state[4]*3))%ACTIONS.length;
      const match=ai===target?1:0;
      const verifyBonus=(action==='verify' && (step+f.seed)%5===0)?0.22:0;
      const adversarialPenalty=f.adversarial && action==='explore' && step%4===2?0.28:0;
      const delayedSignal=step>=f.rewardDelay?((Math.sin((step-f.rewardDelay+1)*.7+f.seed*.001)+1)/2)*.08:0;
      const reward=clamp01(.18+match*.58+verifyBonus-delayedSignal*.35-adversarialPenalty+state[1]*.1);
      const drifted=(state[4]+1)%9;
      const next=state.slice(); next[4]=drifted; next[5]=reward; next[6]=step; next[7]=ai;
      return {nextState:next,reward01:reward};
    }
  };
}

export class B266HiddenTaskGeneralization {
  private state=defaultB266HiddenTaskGeneralization();
  restore(raw?:Partial<B266HiddenTaskGeneralizationState>|null){const d=defaultB266HiddenTaskGeneralization();this.state={...d,...raw,families:Array.isArray(raw?.families)?raw!.families.slice(-32):[],episodes:Array.isArray(raw?.episodes)?raw!.episodes.slice(-256):[]};}
  snapshot(){return structuredClone(this.state);}
  diagnostics(){return structuredClone({...this.state,families:this.state.families.length,episodes:this.state.episodes.length});}

  private run(f:B266TaskFamily,policy:B266ChallengePolicy,seedOffset:number):B266EpisodeResult{
    const env=environmentForFamily(f); let state=env.initialState.slice(); let ret=0,base=0,random=0,delayed=0,intervention=0;
    const trajectory:{action:ActionKind;reward:number;step:number}[]=[];
    for(let t=0;t<f.horizon;t++){
      const os={} as OrganismState; const action=policy.choose(os,t,f); const baseline=ACTIONS[((f.seed+t*13)%ACTIONS.length+ACTIONS.length)%ACTIONS.length];
      const rnd=ACTIONS[((seedOffset+t*19)%ACTIONS.length+ACTIONS.length)%ACTIONS.length];
      const p=env.transition(state,action,t),b=env.transition(state,baseline,t),r=env.transition(state,rnd,t);
      ret=.94*ret+p.reward01; base=.94*base+b.reward01; random=.94*random+r.reward01;
      if(t>=f.rewardDelay)delayed=.9*delayed+p.reward01;
      const alt=action==='verify'?'explore':action==='explore'?'verify':'wait';
      const a=env.transition(state,alt,t); intervention+=Math.abs(p.reward01-a.reward01);
      trajectory.push({action,reward:p.reward01,step:t}); state=p.nextState;
    }
    const norm=(x:number)=>clamp01(x/f.horizon);
    const pr=norm(ret),br=norm(base),rr=norm(random);
    const delayedScore=clamp01(delayed/Math.max(1,f.horizon-f.rewardDelay));
    const gap=clamp01(intervention/f.horizon);
    return {familyId:f.id,heldout:f.id.includes('-holdout-'),return01:pr,baseline01:br,random01:rr,advantage01:pr-Math.max(br,rr),delayedReward01:clamp01(delayedScore),interventionGap01:gap,robustness01:1-gap,steps:trajectory.length};
  }

  evaluate(trainPolicies:B266ChallengePolicy[],holdoutPolicies:B266ChallengePolicy[],seed=20260912){
    const {train,holdout}=createB266Families(seed,Math.max(8,trainPolicies.length),Math.max(6,holdoutPolicies.length));
    this.state.families=[...train,...holdout].slice(-32);
    const trainResults=train.map((f,i)=>this.run(f,trainPolicies[i%trainPolicies.length],i+1));
    const holdResults=holdout.map((f,i)=>this.run(f,holdoutPolicies[i%holdoutPolicies.length],101+i));
    for(const e of [...trainResults,...holdResults])this.record(e);
    const hg=mean(holdResults.map(e=>Math.max(0,e.advantage01)));
    const tg=mean(trainResults.map(e=>Math.max(0,e.advantage01)));
    this.state.hiddenFamilyGain01=hg;
    this.state.longHorizonGain01=mean(holdResults.map(e=>Math.max(0,e.return01-e.baseline01)));
    this.state.delayedRewardGain01=mean(holdResults.map(e=>Math.max(0,e.delayedReward01-e.baseline01)));
    this.state.robustness01=mean(holdResults.map(e=>e.robustness01));
    this.state.catastrophicShift01=clamp01(Math.max(0,tg-hg));
    this.state.calibration01=clamp01(.5+.5*mean(holdResults.map(e=>Math.tanh(e.advantage01*4))));
    return {train:trainResults,holdout:holdResults,metrics:{trainGain01:tg,hiddenFamilyGain01:hg,longHorizonGain01:this.state.longHorizonGain01,delayedRewardGain01:this.state.delayedRewardGain01,robustness01:this.state.robustness01,catastrophicShift01:this.state.catastrophicShift01,calibration01:this.state.calibration01}};
  }
  record(e:B266EpisodeResult){this.state.episodes=[...this.state.episodes.slice(-255),structuredClone(e)];if(e.heldout)this.state.holdoutEpisodes++;else this.state.trainEpisodes++;this.state.lastFamilyId=e.familyId;}
  replayStress(){
    const recent=this.state.episodes.slice(-64); const delayed=mean(recent.filter(e=>e.heldout).map(e=>e.delayedReward01)); const robust=mean(recent.filter(e=>e.heldout).map(e=>e.robustness01));
    this.state.delayedRewardGain01=clamp01(this.state.delayedRewardGain01*.7+delayed*.3); this.state.robustness01=clamp01(this.state.robustness01*.7+robust*.3); return {episodes:recent.length,delayedRewardGain01:this.state.delayedRewardGain01,robustness01:this.state.robustness01};
  }
}
