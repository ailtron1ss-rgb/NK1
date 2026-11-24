import { cosineSimilarity } from '../core/NumericPrimitives.ts';
import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const GOAL_SOURCES=['intrinsic','self-generated','revised','homeostatic','learned'] as const;
type GoalSource=typeof GOAL_SOURCES[number];

export type B273GoalStatus =
  | 'candidate' | 'active' | 'paused' | 'deferred' | 'blocked'
  | 'cancelled' | 'completed' | 'expired' | 'superseded' | 'abandoned';

export interface B273GoalTransitionOptions { tick:number; cooldownTicks?:number; reason?:string; }

const GOAL_STATUSES:B273GoalStatus[]=[
  'candidate','active','paused','deferred','blocked','cancelled','completed','expired','superseded','abandoned',
];
const TERMINAL_GOAL_STATUSES:B273GoalStatus[]=['cancelled','completed','expired','superseded','abandoned'];
const GOAL_TRANSITIONS:Record<B273GoalStatus,B273GoalStatus[]>={
  candidate:['active','deferred','blocked','cancelled','expired','superseded'],
  active:['paused','deferred','blocked','cancelled','completed','expired','superseded','abandoned'],
  paused:['active','deferred','blocked','cancelled','expired','superseded'],
  deferred:['active','blocked','cancelled','expired','superseded'],
  blocked:['active','deferred','cancelled','expired','superseded'],
  cancelled:[],completed:[],expired:[],superseded:[],abandoned:[],
};
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const dot=(a:number[],b:number[])=>{let s=0;const n=Math.min(a.length,b.length);for(let i=0;i<n;i++)s+=a[i]*b[i];return s;};
const norm=(v:number[])=>Math.sqrt(Math.max(1e-9,dot(v,v)));
const cosine=(a:number[],b:number[])=>cosineSimilarity(a,b,1e-9);
const hashVector=(v:number[])=>{let h=2166136261;for(const x of v){h^=Math.round((x+1)*10000);h=Math.imul(h,16777619);}return `g273-${(h>>>0).toString(16)}`;};

export interface B273GoalNode {
  id:string;
  parentId:string|null;
  source:GoalSource;
  status:B273GoalStatus;
  fingerprint:string;
  terminalAtTick:number|null;
  terminalReason:string|null;
  vector:number[];
  importance01:number;
  urgency01:number;
  confidence01:number;
  progress01:number;
  conflict01:number;
  age:number;
  attempts:number;
  successes:number;
  createdTick:number;
  updatedTick:number;
  lastReward01:number;
  subgoalCount:number;
}
export interface B273SkillPrototype {
  id:string;
  actions:ActionKind[];
  support01:number;
  success01:number;
  expectedGain01:number;
  uses:number;
  createdTick:number;
  lastUsedTick:number;
  goalFingerprint:string;
}
export interface B273State {
  version:1;
  tick:number;
  cycles:number;
  learningUpdates:number;
  goalCreations:number;
  goalRevisions:number;
  goalCompletions:number;
  goalAbandonments:number;
  subgoalCreations:number;
  skillCreations:number;
  skillUses:number;
  activeGoalId:string|null;
  rootGoalId:string|null;
  goals:B273GoalNode[];
  /** Cooldown is keyed by goal fingerprint and survives restart/pruning. */
  goalCooldowns:Record<string,number>;
  skills:B273SkillPrototype[];
  goalTransitionWeights:number[][];
  goalUtilityWeights:number[];
  lastGoalVector:number[];
  lastActionPlan:ActionKind[];
  lastAction:ActionKind;
  lastDecisionConfidence01:number;
  autonomy01:number;
  goalConflict01:number;
  goalStability01:number;
  selfAlignment01:number;
  longHorizonValue01:number;
  intrinsicDrive01:number;
  lifecycleMode:'incubating'|'pursuing'|'revising'|'completing'|'recovering'|'cooldown';
  outcomeHistory:Array<{tick:number;goalId:string|null;action:ActionKind;reward01:number;predictionError01:number;independentGain01:number}>;
}
export interface B273StepInput {
  tick:number;
  endogenousGoalVector:number[];
  selfLatent:number[];
  worldLatent:number[];
  neuralAssembly:number[];
  needs:{energy01:number;uncertainty01:number;novelty01:number;goalPressure01:number;socialNeed01:number;autonomy01:number;coherence01:number};
  traits:Record<string,number>;
  predictionError01:number;
  identityContinuity01:number;
  autobiographicalContinuity01:number;
  independentEvaluatorGain01?:number;
  availableActions?:ActionKind[];
}
export interface B273StepResult {
  goalId:string|null;
  goalVector:number[];
  action:ActionKind;
  plan:ActionKind[];
  mode:B273State['lifecycleMode'];
  autonomy01:number;
  confidence01:number;
  selfAlignment01:number;
  longHorizonValue01:number;
  conflict01:number;
  created:boolean;
  revised:boolean;
  skillId:string|null;
}

export function defaultB273State():B273State{
  const goalTransitionWeights=Array.from({length:8},(_,i)=>Array.from({length:8},(_,j)=>i===j?.18:(i+j+3)%5===0?.035:-.012));
  return {version:1,tick:0,cycles:0,learningUpdates:0,goalCreations:0,goalRevisions:0,goalCompletions:0,goalAbandonments:0,subgoalCreations:0,skillCreations:0,skillUses:0,activeGoalId:null,rootGoalId:null,goals:[],skills:[],goalTransitionWeights,goalUtilityWeights:[.25,.18,.18,.14,.10,.08,.07],lastGoalVector:new Array(8).fill(0),lastActionPlan:['reflect'],lastAction:'reflect',lastDecisionConfidence01:.35,autonomy01:.4,goalConflict01:.3,goalStability01:.4,selfAlignment01:.5,longHorizonValue01:.5,intrinsicDrive01:.4,lifecycleMode:'incubating',goalCooldowns:{},outcomeHistory:[]};
}

export class B273AutonomousGoalLifecycle{
  private state=defaultB273State();
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<B273State>|null){
    const d=defaultB273State(); const r:any=raw??{};
    const vec=(x:any,n:number)=>Array.from({length:n},(_,i)=>clamp11(Number(x?.[i]??0)));
    const matrix=(x:any,f:number[][])=>Array.from({length:8},(_,i)=>Array.from({length:8},(_,j)=>Number.isFinite(Number(x?.[i]?.[j]))?clamp11(Number(x[i][j])):f[i][j]));
    const restoredGoals:B273GoalNode[]=Array.isArray(r.goals)?r.goals.slice(-64).map((g:any)=>{
      const vector=vec(g?.vector,8);
      return {...g,vector,fingerprint:typeof g?.fingerprint==='string'?g.fingerprint:hashVector(vector),
        status:(GOAL_STATUSES.includes(g?.status)?g.status:'candidate') as B273GoalStatus,
        parentId:g?.parentId??null,
        terminalAtTick:Number.isSafeInteger(g?.terminalAtTick)&&g.terminalAtTick>=0?g.terminalAtTick:null,
        terminalReason:typeof g?.terminalReason==='string'?g.terminalReason.slice(0,240):null};
    }):[];
    const rawCooldowns=r.goalCooldowns&&typeof r.goalCooldowns==='object'&&!Array.isArray(r.goalCooldowns)?r.goalCooldowns:{};
    const goalCooldowns:Record<string,number>=Object.fromEntries(Object.entries(rawCooldowns)
      .filter(([key,value])=>/^g273-[0-9a-f]+$/u.test(key)&&Number.isSafeInteger(value)&&Number(value)>=0)
      .slice(-64).map(([key,value])=>[key,Number(value)]));
    this.state={...d,...r,version:1,
      goals:restoredGoals,goalCooldowns,
      skills:Array.isArray(r.skills)?r.skills.slice(-48).map((s:any)=>({...s,actions:Array.isArray(s?.actions)?s.actions.slice(0,6).filter((a:any)=>ACTIONS.includes(a)):['reflect']})):[],
      goalTransitionWeights:matrix(r.goalTransitionWeights,d.goalTransitionWeights),
      goalUtilityWeights:Array.isArray(r.goalUtilityWeights)?r.goalUtilityWeights.slice(0,8).map((x:any,i:number)=>clamp11(Number(x??d.goalUtilityWeights[i]??0))):d.goalUtilityWeights,
      lastGoalVector:vec(r.lastGoalVector,8),lastActionPlan:Array.isArray(r.lastActionPlan)?r.lastActionPlan.slice(0,6).filter((a:any)=>ACTIONS.includes(a)):d.lastActionPlan,
      lastAction:ACTIONS.includes(r.lastAction)?r.lastAction:'reflect',outcomeHistory:Array.isArray(r.outcomeHistory)?r.outcomeHistory.slice(-128):[]
    };
    const active=this.state.goals.find(g=>g.id===this.state.activeGoalId&&g.status==='active');
    if(!active)this.state.activeGoalId=null;
    const root=this.state.goals.find(g=>g.id===this.state.rootGoalId&&(g.status==='active'||g.status==='candidate'));
    if(!root)this.state.rootGoalId=null;
  }
  transitionGoal(
    goalId:string,
    nextStatus:B273GoalStatus,
    options:B273GoalTransitionOptions,
  ):{transitioned:boolean;goal:B273GoalNode|null;reason?:string}{
    const goal=this.state.goals.find(row=>row.id===goalId);
    if(!goal)return {transitioned:false,goal:null,reason:'goal-not-found'};
    if(goal.status===nextStatus)return {transitioned:true,goal:structuredClone(goal)};
    if(TERMINAL_GOAL_STATUSES.includes(goal.status))
      return {transitioned:false,goal:structuredClone(goal),reason:'terminal-goal'};
    if(!GOAL_TRANSITIONS[goal.status].includes(nextStatus))
      return {transitioned:false,goal:structuredClone(goal),reason:'transition-not-allowed'};
    const tick=Number.isSafeInteger(options?.tick)&&options.tick>=0?options.tick:this.state.tick;
    const cooldownTicks=Math.max(0,Math.min(10000,Math.floor(Number(options?.cooldownTicks ??
      (nextStatus==='blocked'?4:nextStatus==='deferred'?2:TERMINAL_GOAL_STATUSES.includes(nextStatus)?3:1))||0)));
    const cooldownUntil=this.state.goalCooldowns[goal.fingerprint]??0;
    if(nextStatus==='active'){
      if(tick<cooldownUntil)return {transitioned:false,goal:structuredClone(goal),reason:'cooldown-active'};
      const owner=this.state.goals.find(row=>row.id===this.state.activeGoalId&&row.status==='active'&&row.id!==goal.id);
      if(owner)return {transitioned:false,goal:structuredClone(goal),reason:'another-goal-is-active'};
    }
    goal.status=nextStatus;
    goal.updatedTick=tick;
    this.state.tick=Math.max(this.state.tick,tick);
    if(TERMINAL_GOAL_STATUSES.includes(nextStatus)){
      goal.terminalAtTick=tick;
      goal.terminalReason=String(options?.reason??nextStatus).slice(0,240);
    }
    if(nextStatus==='deferred'||nextStatus==='blocked'||nextStatus==='paused'||TERMINAL_GOAL_STATUSES.includes(nextStatus)){
      this.state.goalCooldowns[goal.fingerprint]=Math.max(cooldownUntil,tick+cooldownTicks);
      const entries=Object.entries(this.state.goalCooldowns).filter(([,until])=>until>tick).slice(-64);
      this.state.goalCooldowns=Object.fromEntries(entries);
      if(this.state.activeGoalId===goal.id)this.state.activeGoalId=null;
      if(this.state.rootGoalId===goal.id)this.state.rootGoalId=null;
      if(!this.state.activeGoalId)this.state.lifecycleMode='cooldown';
    }else if(nextStatus==='active'){
      this.state.activeGoalId=goal.id;
      if(!goal.parentId)this.state.rootGoalId=goal.id;
      this.state.lifecycleMode='pursuing';
    }
    if(nextStatus==='completed')this.state.goalCompletions++;
    if(nextStatus==='abandoned')this.state.goalAbandonments++;
    return {transitioned:true,goal:structuredClone(goal)};
  }

  private cooldownResult(vector:number[],conflict01:number):B273StepResult{
    this.state.activeGoalId=null;
    this.state.lastActionPlan=['defer'];
    this.state.lastAction='defer';
    this.state.lifecycleMode='cooldown';
    return {
      goalId:null,goalVector:vector.slice(),action:'defer',plan:['defer'],mode:'cooldown',
      autonomy01:this.state.autonomy01,confidence01:clamp01(this.state.lastDecisionConfidence01*.9),
      selfAlignment01:this.state.selfAlignment01,longHorizonValue01:this.state.longHorizonValue01,
      conflict01,created:false,revised:false,skillId:null,
    };
  }

  private available(input:B273StepInput){return (input.availableActions??ACTIONS).filter((a):a is ActionKind=>ACTIONS.includes(a));}
  private traitMean(traits:Record<string,number>,keys:string[]){if(!keys.length)return .5;return clamp01(keys.reduce((s,k)=>s+Number(traits[k]??.5),0)/keys.length);}
  private internalDrive(input:B273StepInput){
    const n=input.needs;
    const curiosity=this.traitMean(input.traits,['curiosity']);
    const caution=this.traitMean(input.traits,['caution','truth-seeking']);
    const persistence=this.traitMean(input.traits,['persistence','self-reflection']);
    return clamp01(.19*n.novelty01+.16*n.uncertainty01+.15*n.goalPressure01+.14*n.autonomy01+.12*(1-n.coherence01)+.10*n.socialNeed01+.08*(1-n.energy01)+.06*curiosity+.05*persistence+.05*caution);
  }
  private synthesizeGoalVector(input:B273StepInput){
    const e=input.endogenousGoalVector.slice(0,8).map(clamp11);
    const self=input.selfLatent.slice(0,16); const world=input.worldLatent.slice(0,16); const asm=input.neuralAssembly.slice(0,16);
    return Array.from({length:8},(_,i)=>{
      const s=self[i]??0; const w=world[(i*2)%Math.max(1,world.length)]??0; const a=asm[(i*2+1)%Math.max(1,asm.length)]??0;
      const recurrent=dot(this.state.goalTransitionWeights[i]!,this.state.lastGoalVector)*.22;
      return clamp11((e[i]??0)*.58+s*.08+w*.08+a*.06+recurrent+.12*clamp11(input.needs.goalPressure01-.5)+.08*clamp11(input.predictionError01-.2));
    });
  }
  private conflict(input:B273StepInput,v:number[]){
    const selfFit=clamp01(.5+.5*cosine(v,input.selfLatent));
    const worldFit=clamp01(.5+.5*cosine(v,input.worldLatent));
    const energy=input.needs.energy01;
    return clamp01(.36*input.predictionError01+.24*input.needs.uncertainty01+.16*(1-input.identityContinuity01)+.10*(1-input.autobiographicalContinuity01)+.08*(1-selfFit)+.06*(1-worldFit)+.08*(1-energy));
  }
  private goalUtility(input:B273StepInput,v:number[],conflict:number){
    const n=input.needs; const drive=this.internalDrive(input); const selfFit=clamp01(.5+.5*cosine(v,input.selfLatent)); const worldFit=clamp01(.5+.5*cosine(v,input.worldLatent));
    const base=.28*drive+.22*selfFit+.18*worldFit+.12*n.autonomy01+.10*n.goalPressure01+.06*(1-conflict)+.04*(1-input.predictionError01);
    return clamp01(base);
  }
  private choosePlan(input:B273StepInput,goal:B273GoalNode){
    const actions=this.available(input); const trait=input.traits;
    const weights:Record<ActionKind,number>={respond:.0,explore:0,verify:0,rest:0,reflect:0,wait:0,defer:0};
    for(const a of actions){
      let s=.4;
      if(a==='explore') s+=.18*(input.needs.novelty01+.25*Number(trait.curiosity??.5));
      if(a==='verify') s+=.18*(input.needs.uncertainty01+.22*Number(trait['truth-seeking']??.5));
      if(a==='reflect') s+=.16*((1-input.needs.coherence01)+.22*Number(trait['self-reflection']??.5));
      if(a==='respond') s+=.14*(input.needs.socialNeed01+.28*Number(trait.care??.5));
      if(a==='rest') s+=.18*(1-input.needs.energy01+.22*Number(trait['self-preservation']??.5));
      if(a==='wait') s+=.08*input.needs.uncertainty01;
      if(a==='defer') s+=.07*input.predictionError01;
      s+=.05*goal.importance01+.04*goal.urgency01-.07*goal.conflict01;
      weights[a]=s;
    }
    const ordered=actions.slice().sort((a,b)=>weights[b]-weights[a]);
    const first=ordered[0]??'reflect'; const second=ordered[1]??'reflect';
    const third=goal.conflict01>.62?(actions.includes('verify')?'verify':'reflect'):(actions.includes('respond')?'respond':second);
    return [first,second,third].filter((a,i,arr)=>arr.indexOf(a)===i).slice(0,4);
  }
  private makeGoal(input:B273StepInput,v:number[],utility:number,parentId:string|null,source:GoalSource):B273GoalNode{
    const conflict=this.conflict(input,v); const fingerprint=hashVector(v);
    const existing=this.state.goals.find(g=>g.fingerprint===fingerprint&&(g.status==='candidate'||g.status==='active'));
    if(existing)return existing;
    const id=fingerprint+':'+input.tick+':'+(this.state.goalCreations+1);
    const g:B273GoalNode={id,fingerprint,parentId,source,status:'candidate',terminalAtTick:null,terminalReason:null,
      vector:v.slice(),importance01:clamp01(.55+.25*utility+.20*input.needs.autonomy01),
      urgency01:clamp01(.25+input.needs.goalPressure01*.45+conflict*.30),
      confidence01:clamp01(.42+utility*.34+(1-conflict)*.24),progress01:0,conflict01:conflict,
      age:0,attempts:0,successes:0,createdTick:input.tick,updatedTick:input.tick,lastReward01:.5,subgoalCount:0};
    this.state.goals=[...this.state.goals.slice(-63),g];this.state.goalCreations++;
    if(!this.state.rootGoalId)this.state.rootGoalId=id;
    return g;
  }
  private ensureHierarchy(input:B273StepInput,v:number[],utility:number){
    let root=this.state.rootGoalId?this.state.goals.find(g=>g.id===this.state.rootGoalId&&(g.status==='active'||g.status==='candidate')):null;
    if(!root){
      root=this.makeGoal(input,v,utility,null,'self-generated');
      root.status='active';
      this.state.rootGoalId=root.id;
    }
    const need=Math.max(...v.map(x=>Math.abs(x)));
    if(need>.42 && root.subgoalCount<3 && this.state.goals.filter(g=>g.parentId===root!.id&&(g.status==='candidate'||g.status==='active')).length<3){
      const dims=v.map((x,i)=>({i,a:Math.abs(x)})).sort((a,b)=>b.a-a.a).slice(0,2);
      for(const d of dims){
        const sv = new Array(8).fill(0);
        sv[d.i] = clamp11(v[d.i] * 0.85);
        const sg = this.makeGoal(input, sv, utility * 0.88, root.id, 'intrinsic');
        sg.status = 'candidate';
        root.subgoalCount++;
        this.state.subgoalCreations++;
      }
    }
    let active=this.state.activeGoalId?this.state.goals.find(g=>g.id===this.state.activeGoalId&&g.status==='active'):null;
    if(!active){
      active=root.status==='active'?root:this.makeGoal(input,v,utility,null,'self-generated');
      active.status='active';
      this.state.activeGoalId=active.id;
      if(!this.state.rootGoalId) this.state.rootGoalId=active.id;
    }
    return active;
  }
  step(input:B273StepInput):B273StepResult{
    this.state.tick=input.tick;this.state.cycles++;
    const v=this.synthesizeGoalVector(input); const conflict=this.conflict(input,v); const utility=this.goalUtility(input,v,conflict); const drive=this.internalDrive(input);
    const fingerprint=hashVector(v);
    const current=this.state.activeGoalId?this.state.goals.find(g=>g.id===this.state.activeGoalId&&g.status==='active'):null;
    const pending=this.state.goals.find(g=>g.fingerprint===fingerprint&&g.status==='candidate');
    if(!current&&!pending&&(this.state.goalCooldowns[fingerprint]??0)>input.tick)
      return this.cooldownResult(v,conflict);
    let goal=this.ensureHierarchy(input,v,utility);
    const similarity=cosine(goal.vector,v);
    let revised=false,created=false;
    const persistentConflict=conflict>.76 && goal.conflict01>.58 && goal.attempts>=2;
    const staleGoal=goal.age>10 && goal.progress01<.20 && input.independentEvaluatorGain01!=null && input.independentEvaluatorGain01<-.04;
    if(goal.status==='completed' || goal.status==='abandoned' || persistentConflict || staleGoal){
      const source:GoalSource=persistentConflict?'revised':'self-generated';
      const next=this.makeGoal(input,v,utility,goal.parentId,source);
      if(next.id!==goal.id){
        this.transitionGoal(goal.id,persistentConflict?'superseded':'expired',{tick:input.tick,cooldownTicks:2,reason:persistentConflict?'persistent-goal-conflict':'goal-expired-after-low-progress'});
        goal=next;goal.status='active';this.state.activeGoalId=goal.id;
        if(!goal.parentId)this.state.rootGoalId=goal.id;
        this.state.goalRevisions++;revised=true;created=true;
      }
    } else {
      const blended=goal.vector.map((x,i)=>clamp11(x*.78+(v[i]??0)*.22));
      goal.vector=blended;goal.fingerprint=hashVector(blended);
      goal.conflict01=clamp01(goal.conflict01*.82+conflict*.18);
      goal.importance01=clamp01(goal.importance01*.9+.1*(.55+utility*.25+input.needs.autonomy01*.2));
      goal.urgency01=clamp01(goal.urgency01*.86+.14*(.25+input.needs.goalPressure01*.45+conflict*.30));
      goal.confidence01=clamp01(goal.confidence01*.88+.12*(.42+utility*.34+(1-conflict)*.24));
      goal.age++; goal.updatedTick=input.tick; goal.status='active';
    }
    const plan=this.choosePlan(input,goal); const action=plan[0]??'reflect';
    const selfAlignment=clamp01(.5+.5*cosine(goal.vector,input.selfLatent)); const longHorizon=clamp01(.34*utility+.24*(1-conflict)+.20*selfAlignment+.12*input.autobiographicalContinuity01+.10*input.identityContinuity01);
    const autonomy=clamp01(.25*drive+.25*selfAlignment+.20*input.needs.autonomy01+.16*longHorizon+.14*(1-input.needs.goalPressure01*.2));
    const confidence=clamp01(.28+utility*.30+selfAlignment*.18+(1-conflict)*.16+autonomy*.08);
    const mode:B273State['lifecycleMode']=conflict>.66?'revising':longHorizon>.64?'pursuing':input.needs.energy01<.28?'recovering':'incubating';
    this.state.activeGoalId=goal.id;this.state.lastGoalVector=goal.vector.slice();this.state.lastActionPlan=plan;this.state.lastAction=action;this.state.lastDecisionConfidence01=confidence;this.state.autonomy01=clamp01(this.state.autonomy01*.88+autonomy*.12);this.state.goalConflict01=clamp01(this.state.goalConflict01*.84+conflict*.16);this.state.goalStability01=clamp01(this.state.goalStability01*.9+(1-Math.abs(goal.progress01-.5))*.1);this.state.selfAlignment01=clamp01(this.state.selfAlignment01*.9+selfAlignment*.1);this.state.longHorizonValue01=clamp01(this.state.longHorizonValue01*.9+longHorizon*.1);this.state.intrinsicDrive01=clamp01(this.state.intrinsicDrive01*.88+drive*.12);this.state.lifecycleMode=mode;
    const skill=this.state.skills.filter(s=>s.actions[0]===action&&s.success01>=.58).sort((a,b)=>(b.success01+b.support01)-(a.success01+a.support01))[0];if(skill){skill.uses++;skill.lastUsedTick=input.tick;this.state.skillUses++;}
    return {goalId:goal.id,goalVector:goal.vector.slice(),action,plan,mode,autonomy01:this.state.autonomy01,confidence01:confidence,selfAlignment01:selfAlignment,longHorizonValue01:longHorizon,conflict01:conflict,created,revised,skillId:skill?.id??null};
  }
  learnFromOutcome(input:{tick:number;action:ActionKind;plan:ActionKind[];reward01:number;predictionError01:number;independentGain01:number;personalityAlignment01:number;externalEvidence01:number}):{accepted:boolean;revised:boolean;completed:boolean;abandoned:boolean;skillCreated:boolean;goalId:string|null;gain01:number}{
    const goal=this.state.activeGoalId?this.state.goals.find(g=>g.id===this.state.activeGoalId&&g.status==='active'):null;
    if(!goal){return {accepted:false,revised:false,completed:false,abandoned:false,skillCreated:false,goalId:null,gain01:0};}
    const gain=clamp11((input.reward01-.5)*.72+(input.independentGain01)*.62+(1-input.predictionError01)*.18+(input.personalityAlignment01-.5)*.14);
    const accepted=gain>.02 || input.externalEvidence01>.7;
    const progressDelta=clamp01(.02+.06*Math.max(0,gain)+.03*input.externalEvidence01);
    goal.progress01=clamp01(goal.progress01+(accepted?progressDelta:-progressDelta*.55));goal.attempts++;goal.successes+=accepted?1:0;goal.lastReward01=input.reward01;goal.updatedTick=input.tick;goal.age=0;
    let completed=false,abandoned=false,revised=false;
    if(goal.progress01>=.92 && accepted){
      this.transitionGoal(goal.id,'completed',{tick:input.tick,cooldownTicks:3,reason:'verified-goal-progress-threshold'});
      completed=true;
    }else if(gain<-.18 && input.predictionError01>.62){
      this.transitionGoal(goal.id,'paused',{tick:input.tick,cooldownTicks:2,reason:'negative-independent-outcome'});
      this.state.goalRevisions++;revised=true;
    }else if(goal.attempts>=8 && goal.progress01<.18 && input.independentGain01<-.05){
      this.transitionGoal(goal.id,'abandoned',{tick:input.tick,cooldownTicks:4,reason:'repeated-negative-outcomes'});
      abandoned=true;
    }else goal.status='active';
    if (revised) {
      const next = goal.vector.map((x, i) =>
        clamp11(x * (0.72 - (i % 3) * 0.03) +
          (i === 0 ? input.predictionError01 - 0.5 : 0) * 0.18)
      );
      const nextFingerprint=hashVector(next);
      const replacement = this.state.goals.find(
        g => g.fingerprint === nextFingerprint && (g.status==='candidate'||g.status==='active')
      );
      if (replacement) {
        replacement.status = 'active';
        this.state.activeGoalId = replacement.id;
      } else {
        const newGoal: B273GoalNode = {
          id: nextFingerprint+':'+input.tick+':'+(this.state.goalCreations+1),
          fingerprint: nextFingerprint,
          parentId: goal.parentId,
          source: 'revised',
          status: 'active',
          terminalAtTick: null,
          terminalReason: null,
          vector: next,
          importance01: goal.importance01,
          urgency01: clamp01(goal.urgency01 + 0.08),
          confidence01: clamp01(goal.confidence01 * 0.82 + 0.12),
          progress01: 0,
          conflict01: clamp01(goal.conflict01 * 0.82 + input.predictionError01 * 0.12),
          age: 0,
          attempts: 0,
          successes: 0,
          createdTick: input.tick,
          updatedTick: input.tick,
          lastReward01: 0.5,
          subgoalCount: 0
        };
        this.state.goals = [...this.state.goals.slice(-63), newGoal];
        this.state.activeGoalId = newGoal.id;
        if(!newGoal.parentId)this.state.rootGoalId=newGoal.id;
        this.state.goalCreations++;
      }
    }
    const goodSkill=accepted && input.plan.length>=2 && input.plan.length<=5 && input.predictionError01<.72;
    let skillCreated=false;
    if(goodSkill){
      const sid=`skill273-${hashVector(goal.vector)}-${input.plan.join('-')}`;let skill=this.state.skills.find(s=>s.id===sid);
      if(!skill){skill={id:sid,actions:input.plan.slice(),support01:.18,success01:input.reward01,expectedGain01:clamp01(.5+gain*.4),uses:1,createdTick:input.tick,lastUsedTick:input.tick,goalFingerprint:hashVector(goal.vector)};this.state.skills=[...this.state.skills.slice(-47),skill];this.state.skillCreations++;skillCreated=true;}
      else{skill.support01=clamp01(skill.support01*.82+.18);skill.success01=clamp01(skill.success01*.88+input.reward01*.12);skill.expectedGain01=clamp01(skill.expectedGain01*.86+(.5+gain*.4)*.14);skill.uses++;skill.lastUsedTick=input.tick;}
    }
    this.state.outcomeHistory=[...this.state.outcomeHistory,{tick:input.tick,goalId:goal.id,action:input.action,reward01:input.reward01,predictionError01:input.predictionError01,independentGain01:input.independentGain01}].slice(-128);
    this.state.learningUpdates++;
    return {accepted,revised,completed,abandoned,skillCreated,goalId:goal.id,gain01:gain};
  }
  actionBias(action:ActionKind){
    const active=this.state.activeGoalId?this.state.goals.find(g=>g.id===this.state.activeGoalId&&g.status==='active'):null; if(!active)return 0;
    const planIdx=this.state.lastActionPlan.indexOf(action); const planBias=planIdx>=0?(.034/(planIdx+1)):0;
    const skill=this.state.skills.filter(s=>s.actions[0]===action&&s.success01>=.58).sort((a,b)=>(b.success01+b.support01)-(a.success01+a.support01))[0]; const skillBias=skill?clamp11((skill.success01-.5)*.04):0;
    return clamp11(planBias+skillBias+.02*(this.state.autonomy01-.5));
  }
  current(){const g=this.state.activeGoalId?this.state.goals.find(g=>g.id===this.state.activeGoalId):null;return {goal:g?structuredClone(g):null,plan:this.state.lastActionPlan.slice(),action:this.state.lastAction,mode:this.state.lifecycleMode,autonomy01:this.state.autonomy01,confidence01:this.state.lastDecisionConfidence01,longHorizonValue01:this.state.longHorizonValue01};}
  diagnostics(){
    const active = this.state.goals.filter(g => g.status === 'active').length;
    const completed = this.state.goals.filter(g => g.status === 'completed').length;
    const abandoned = this.state.goals.filter(g => g.status === 'abandoned').length;
    const deferred = this.state.goals.filter(g => g.status === 'deferred').length;
    const blocked = this.state.goals.filter(g => g.status === 'blocked').length;
    const cancelled = this.state.goals.filter(g => g.status === 'cancelled').length;
    const expired = this.state.goals.filter(g => g.status === 'expired').length;
    const superseded = this.state.goals.filter(g => g.status === 'superseded').length;
    const hierarchical = this.state.goals.filter(g => g.parentId).length;
    return {
      version: 1,
      cycles: this.state.cycles,
      learningUpdates: this.state.learningUpdates,
      goalCreations: this.state.goalCreations,
      goalRevisions: this.state.goalRevisions,
      goalCompletions: this.state.goalCompletions,
      goalAbandonments: this.state.goalAbandonments,
      subgoalCreations: this.state.subgoalCreations,
      skillCreations: this.state.skillCreations,
      skillUses: this.state.skillUses,
      activeGoals: active,
      completedGoals: completed,
      abandonedGoals: abandoned,
      deferredGoals: deferred,
      blockedGoals: blocked,
      cancelledGoals: cancelled,
      expiredGoals: expired,
      supersededGoals: superseded,
      cooldownFingerprints: Object.keys(this.state.goalCooldowns).length,
      hierarchicalGoalRate01: clamp01(
        hierarchical / Math.max(1, this.state.goals.length)
      ),
      autonomy01: this.state.autonomy01,
      goalConflict01: this.state.goalConflict01,
      goalStability01: this.state.goalStability01,
      selfAlignment01: this.state.selfAlignment01,
      longHorizonValue01: this.state.longHorizonValue01,
      intrinsicDrive01: this.state.intrinsicDrive01,
      lifecycleMode: this.state.lifecycleMode,
      activeGoalId: this.state.activeGoalId,
      skillDiversity01: clamp01(
        new Set(this.state.skills.map(s => s.actions.join('>'))).size /
          Math.max(1, ACTIONS.length)
      ),
      goalDiversity01: clamp01(
        new Set(
          this.state.goals
            .filter(g => g.status !== 'abandoned')
            .map(g => g.id)
        ).size / Math.max(1, this.state.goals.length)
      )
    };
  }
}
