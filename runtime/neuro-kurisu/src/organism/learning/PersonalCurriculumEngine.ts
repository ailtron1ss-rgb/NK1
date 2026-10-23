import type { OrganismGoal } from '../core/types.ts';
import { snapshotPlainData } from './LearningTrustBoundary.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clean=(x:unknown,n=140)=>String(x??'').trim().replace(/\s+/g,' ').slice(0,n);
const hash=(s:string)=>{let h=2166136261>>>0;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return (h>>>0).toString(16).padStart(8,'0');};
const isCurriculumUnit=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
const isCurriculumTimestamp=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const isCurriculumCounter=(value:unknown):value is number=>isCurriculumTimestamp(value)&&value<=1_000_000_000;
function snapshotCurriculumInput(value:unknown,label:string):Record<string,unknown>{
  let detached:unknown;
  try{detached=snapshotPlainData(value);}
  catch{throw new Error(`personal-curriculum-${label}-data-boundary-rejected`);}
  if(detached===null||typeof detached!=='object'||Array.isArray(detached))throw new Error(`personal-curriculum-${label}-shape-invalid`);
  return detached as Record<string,unknown>;
}
function assertCurriculumUnits(value:Record<string,unknown>,keys:readonly string[],label:string):void{
  if(!keys.every(key=>isCurriculumUnit(value[key])))throw new Error(`personal-curriculum-${label}-score-invalid`);
}

export interface CurriculumThread {
  id:string;
  family:string;
  title:string;
  source:'autobiographical'|'social'|'goal'|'mixed';
  occurrences:number;
  verified:number;
  successes:number;
  failures:number;
  contexts:number;
  contextKeys:string[];
  socialRelevance01:number;
  identityRelevance01:number;
  causalStrength01:number;
  unresolved01:number;
  retention01:number;
  transfer01:number;
  learningNeed01:number;
  confidence01:number;
  priority01:number;
  status:'emerging'|'active'|'satisfied'|'suppressed';
  lastOutcome01:number;
  lastAt:number;
}

export interface PersonalCurriculumState {
  version:1;
  cycles:number;
  threads:CurriculumThread[];
  focusThreadId:string|null;
  focusGoalId:string|null;
  curriculumPressure01:number;
  socialLearning01:number;
  autobiographicalLearning01:number;
  identityLearning01:number;
  transferReadiness01:number;
  completedThreads:number;
  suppressedThreads:number;
  lastAt:number;
}

export const defaultPersonalCurriculum=():PersonalCurriculumState=>({
  version:1,cycles:0,threads:[],focusThreadId:null,focusGoalId:null,curriculumPressure01:.28,
  socialLearning01:.2,autobiographicalLearning01:.25,identityLearning01:.24,transferReadiness01:.15,
  completedThreads:0,suppressedThreads:0,lastAt:0
});

export class PersonalCurriculumEngine {
  private state=defaultPersonalCurriculum();
  restore(raw?:Partial<PersonalCurriculumState>|null){
    const defaults=defaultPersonalCurriculum();
    let detached:unknown;
    try{detached=snapshotPlainData(raw??{});}catch{this.state=defaults;return;}
    if(detached===null||typeof detached!=='object'||Array.isArray(detached)){this.state=defaults;return;}
    const r=detached as Record<string,unknown>;
    const safeCount=(v:unknown,fallback:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=1_000_000_000?v:fallback;
    const safeUnit=(v:unknown,fallback:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1?v:fallback;
    const safeTimestamp=(v:unknown,fallback:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:fallback;
    const threads:CurriculumThread[]=[];
    const ids=new Set<string>(),families=new Set<string>();
    const rows=Array.isArray(r.threads)?r.threads.slice(-64):[];
    // If a persisted identity collides, quarantine every row with that ID/family.
    // Do not let serialization order decide which conflicting memory survives.
    const idCounts=new Map<string,number>(),familyCounts=new Map<string,number>();
    for(const value of rows){
      if(!value||typeof value!=='object'||Array.isArray(value))continue;
      const row=value as Record<string,unknown>;
      if(typeof row.id==='string')idCounts.set(row.id,(idCounts.get(row.id)??0)+1);
      if(typeof row.family==='string')familyCounts.set(row.family,(familyCounts.get(row.family)??0)+1);
    }
    for(const value of rows){
      if(!value||typeof value!=='object'||Array.isArray(value))continue;
      const x=value as Record<string,unknown>;
      const source=['autobiographical','social','goal','mixed'].includes(String(x.source))?x.source as CurriculumThread['source']:null;
      const status=['emerging','active','satisfied','suppressed'].includes(String(x.status))?x.status as CurriculumThread['status']:null;
      const metrics=['socialRelevance01','identityRelevance01','causalStrength01','unresolved01','retention01','transfer01','learningNeed01','confidence01','priority01','lastOutcome01'];
      if(typeof x.id!=='string'||!x.id.trim()||x.id.length>128||typeof x.family!=='string'||!x.family.trim()||x.family.length>180||
         idCounts.get(x.id)!==1||familyCounts.get(x.family)!==1||
         typeof x.title!=='string'||!x.title.trim()||x.title.length>140||!source||!status||
         !Array.isArray(x.contextKeys)||x.contextKeys.length>24||
         x.contextKeys.some(k=>typeof k!=='string'||!k.trim()||k.length>180)||
         !metrics.every(k=>typeof x[k]==='number'&&Number.isFinite(x[k])&&x[k]>=0&&x[k]<=1)||
         !['occurrences','verified','successes','failures','contexts'].every(k=>typeof x[k]==='number'&&Number.isSafeInteger(x[k])&&x[k]>=0&&x[k]<=1_000_000_000)||typeof x.lastAt!=='number'||!Number.isSafeInteger(x.lastAt)||x.lastAt<0)continue;
      const contextKeys=Array.from(new Set(x.contextKeys as string[]));
      if(contextKeys.length!==(x.contextKeys as string[]).length||x.contexts!==contextKeys.length||
         Number(x.verified)>Number(x.occurrences)||Number(x.successes)>Number(x.occurrences)||Number(x.failures)>Number(x.occurrences))continue;
      const thread={...x,source,status,contextKeys} as unknown as CurriculumThread;
      if(ids.has(thread.id)||families.has(thread.family))continue;
      ids.add(thread.id);families.add(thread.family);threads.push(thread);
    }
    const focus=typeof r.focusThreadId==='string'&&ids.has(r.focusThreadId)?r.focusThreadId:null;
    this.state={
      version:1,cycles:safeCount(r.cycles,defaults.cycles),threads,
      focusThreadId:focus,
      focusGoalId:typeof r.focusGoalId==='string'&&r.focusGoalId.trim()&&r.focusGoalId.length<=256?r.focusGoalId:null,
      curriculumPressure01:safeUnit(r.curriculumPressure01,defaults.curriculumPressure01),
      socialLearning01:safeUnit(r.socialLearning01,defaults.socialLearning01),
      autobiographicalLearning01:safeUnit(r.autobiographicalLearning01,defaults.autobiographicalLearning01),
      identityLearning01:safeUnit(r.identityLearning01,defaults.identityLearning01),
      transferReadiness01:safeUnit(r.transferReadiness01,defaults.transferReadiness01),
      completedThreads:safeCount(r.completedThreads,defaults.completedThreads),
      suppressedThreads:safeCount(r.suppressedThreads,defaults.suppressedThreads),
      lastAt:safeTimestamp(r.lastAt,defaults.lastAt)
    };
  }
  snapshot(){return structuredClone(this.state);}

  beginCycle(){
    this.state.cycles++;
    this.state.threads=this.state.threads.map(t=>({...t,unresolved01:clamp(t.unresolved01*.998),priority01:clamp(t.priority01*.997)}));
    this.state.lastAt=Date.now();
  }

  private family(goal:OrganismGoal){return `${goal.source}:${(goal.title||'goal').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,72)}`;}
  private findOrCreate(family:string,title:string,source:CurriculumThread['source'],at:number){
    let thread=this.state.threads.find(t=>t.family===family);
    if(!thread){
      thread={id:`curr:${hash(family)}`,family,title:clean(title,140)||family,source,occurrences:0,verified:0,successes:0,failures:0,contexts:0,contextKeys:[],socialRelevance01:0.1,identityRelevance01:0.1,causalStrength01:0.2,unresolved01:0.45,retention01:0.5,transfer01:0.1,learningNeed01:0.45,confidence01:0.25,priority01:0.3,status:'emerging',lastOutcome01:.5,lastAt:at};
      this.state.threads.unshift(thread); this.state.threads=this.state.threads.slice(0,64);
    }
    return thread;
  }

  observeOutcome(input:{goal:OrganismGoal|null;outcome01:number;verified:boolean;contextKey:string;causal01:number;social01:number;identity01:number;retention01:number;transfer01:number;at?:number;sourceMomentCount?:number}):CurriculumThread|null{
    input=snapshotCurriculumInput(input,'outcome') as unknown as typeof input;
    if(input.goal===null)return null;
    const goal=input.goal as unknown as Record<string,unknown>;
    if(!goal||typeof goal!=='object'||Array.isArray(goal)||
       typeof goal.id!=='string'||!goal.id.trim()||goal.id.length>256||
       typeof goal.title!=='string'||!goal.title.trim()||goal.title.length>512||
       typeof goal.reason!=='string'||goal.reason.length>4096||
       typeof goal.source!=='string'||goal.source.length>120||
       typeof goal.status!=='string'||goal.status.length>120||
       !isCurriculumUnit(goal.importance)||!isCurriculumUnit(goal.urgency)||
       !isCurriculumUnit(goal.confidence)||!isCurriculumUnit(goal.progress)||
       !isCurriculumTimestamp(goal.createdAt)||!isCurriculumTimestamp(goal.updatedAt)){
      throw new Error('personal-curriculum-goal-invalid');
    }
    assertCurriculumUnits(input as unknown as Record<string,unknown>,
      ['outcome01','causal01','social01','identity01','retention01','transfer01'],'outcome');
    if(typeof input.verified!=='boolean'||typeof input.contextKey!=='string'||input.contextKey.length>512||
       (input.at!==undefined&&!isCurriculumTimestamp(input.at))||
       (input.sourceMomentCount!==undefined&&!isCurriculumCounter(input.sourceMomentCount))){
      throw new Error('personal-curriculum-outcome-invalid');
    }
    const at=input.at??Date.now();
    const family=this.family(input.goal);
    const source:CurriculumThread['source']=input.social01>.52&&input.identity01>.48?'mixed':input.social01>.52?'social':input.identity01>.52?'autobiographical':'goal';
    const thread=this.findOrCreate(family,input.goal.title,source,at);
    const ctx=clean(input.contextKey,180);
    const newContext=Boolean(ctx)&&!thread.contextKeys.includes(ctx);
    thread.occurrences++;
    if(input.verified)thread.verified++;
    if(input.outcome01>=.62)thread.successes++; else if(input.outcome01<.4)thread.failures++;
    if(newContext){thread.contextKeys=[ctx,...thread.contextKeys].slice(0,24);thread.contexts=thread.contextKeys.length;}
    thread.socialRelevance01=clamp(thread.socialRelevance01*.88+input.social01*.12);
    thread.identityRelevance01=clamp(thread.identityRelevance01*.88+input.identity01*.12);
    thread.causalStrength01=clamp(thread.causalStrength01*.86+input.causal01*.14);
    thread.retention01=clamp(thread.retention01*.9+clamp(input.retention01)*.1);
    thread.transfer01=clamp(thread.transfer01*.88+clamp(input.transfer01)*.12);
    thread.lastOutcome01=clamp(input.outcome01);thread.lastAt=at;
    const rate=thread.successes/Math.max(1,thread.occurrences);
    const evidence=clamp(thread.verified/Math.max(2,thread.occurrences)*.55+thread.contexts/6*.2+thread.causalStrength01*.25);
    thread.unresolved01=clamp(.56-rate*.34+(1-evidence)*.24+Math.abs(thread.lastOutcome01-.62)*.12+thread.failures/Math.max(3,thread.occurrences)*.20);
    thread.learningNeed01=clamp(thread.unresolved01*.34+(1-thread.retention01)*.18+(1-thread.transfer01)*.16+(1-thread.confidence01)*.14+thread.socialRelevance01*.08+thread.identityRelevance01*.10);
    thread.confidence01=clamp(thread.confidence01*.9+evidence*.07+thread.retention01*.03);
    thread.priority01=clamp(thread.learningNeed01*.42+thread.identityRelevance01*.18+thread.socialRelevance01*.13+thread.causalStrength01*.12+thread.transfer01*.08+(input.goal.importance*.04)+(input.goal.urgency*.03));
    if(thread.occurrences>=6&&thread.contexts>=3&&thread.verified>=3&&rate>=.72&&thread.retention01>=.62&&thread.transfer01>=.42&&thread.unresolved01<.32){ if(thread.status!=='satisfied')this.state.completedThreads++; thread.status='satisfied'; }
    else if(thread.status!=='suppressed')thread.status=thread.priority01>.42?'active':'emerging';
    if(thread.status==='suppressed')this.state.suppressedThreads++;
    this.state.curriculumPressure01=clamp(this.state.curriculumPressure01*.94+thread.learningNeed01*.06);
    this.state.socialLearning01=clamp(this.state.socialLearning01*.95+thread.socialRelevance01*.05);
    this.state.autobiographicalLearning01=clamp(this.state.autobiographicalLearning01*.95+thread.unresolved01*.05);
    this.state.identityLearning01=clamp(this.state.identityLearning01*.95+thread.identityRelevance01*.05);
    this.state.transferReadiness01=clamp(this.state.transferReadiness01*.95+thread.transfer01*.05);
    this.state.lastAt=at;
    return structuredClone(thread);
  }

  observeDevelopmentalContext(input:{action:string;source:'autobiographical'|'social'|'mixed';contextKey:string;pressure01:number;identity01:number;social01:number;causal01:number;evidence01:number;unresolved01:number;at?:number;label?:string}):CurriculumThread|null{
    input=snapshotCurriculumInput(input,'developmental-context') as unknown as typeof input;
    if(typeof input.action!=='string'||!input.action.trim()||input.action.length>256||
       !['autobiographical','social','mixed'].includes(input.source)||
       typeof input.contextKey!=='string'||input.contextKey.length>512||
       (input.label!==undefined&&(typeof input.label!=='string'||input.label.length>512))||
       (input.at!==undefined&&!isCurriculumTimestamp(input.at))){
      throw new Error('personal-curriculum-developmental-context-invalid');
    }
    assertCurriculumUnits(input as unknown as Record<string,unknown>,
      ['pressure01','identity01','social01','causal01','evidence01','unresolved01'],'developmental-context');
    const at=input.at??Date.now();
    const family=`context:${input.source}:${clean(input.action,48).toLowerCase()}`;
    const thread=this.findOrCreate(family,input.label||`${input.source} learning: ${input.action}`,input.source,at);
    const ctx=clean(input.contextKey,180);
    const newContext=Boolean(ctx)&&!thread.contextKeys.includes(ctx);
    thread.occurrences++;
    if(newContext){thread.contextKeys=[ctx,...thread.contextKeys].slice(0,24);thread.contexts=thread.contextKeys.length;}
    thread.socialRelevance01=clamp(thread.socialRelevance01*.82+input.social01*.18);
    thread.identityRelevance01=clamp(thread.identityRelevance01*.82+input.identity01*.18);
    thread.causalStrength01=clamp(thread.causalStrength01*.82+input.causal01*.18);
    thread.retention01=clamp(thread.retention01*.92+(1-input.unresolved01)*.08);
    thread.transfer01=clamp(thread.transfer01*.94+Math.min(1,thread.contexts/5)*.06);
    thread.learningNeed01=clamp(input.pressure01*.36+input.unresolved01*.28+(1-thread.retention01)*.14+(1-thread.transfer01)*.12+(1-input.evidence01)*.10);
    thread.confidence01=clamp(thread.confidence01*.9+input.evidence01*.07+thread.causalStrength01*.03);
    thread.priority01=clamp(thread.learningNeed01*.42+thread.identityRelevance01*.22+thread.socialRelevance01*.15+thread.causalStrength01*.12+thread.transfer01*.05+input.pressure01*.04);
    thread.unresolved01=clamp(thread.unresolved01*.86+input.unresolved01*.14);
    thread.lastOutcome01=clamp(1-input.unresolved01); thread.lastAt=at;
    this.state.curriculumPressure01=clamp(this.state.curriculumPressure01*.9+thread.learningNeed01*.1);
    this.state.socialLearning01=clamp(this.state.socialLearning01*.94+thread.socialRelevance01*.06);
    this.state.autobiographicalLearning01=clamp(this.state.autobiographicalLearning01*.94+thread.unresolved01*.06);
    this.state.identityLearning01=clamp(this.state.identityLearning01*.94+thread.identityRelevance01*.06);
    this.state.transferReadiness01=clamp(this.state.transferReadiness01*.94+thread.transfer01*.06);
    this.state.lastAt=at;
    return structuredClone(thread);
  }

  rankGoals(input:{goals:OrganismGoal[];identity01:number;social01:number;novelty01:number;uncertainty01:number}):Array<{goalId:string;score01:number;threadId:string|null;learningNeed01:number;historyFit01:number;socialFit01:number;identityFit01:number;reason:string}>{
    input=snapshotCurriculumInput(input,'goal-ranking') as unknown as typeof input;
    assertCurriculumUnits(input as unknown as Record<string,unknown>,['identity01','social01','novelty01','uncertainty01'],'goal-ranking');
    if(!Array.isArray(input.goals)||input.goals.length>256)throw new Error('personal-curriculum-goal-ranking-goals-invalid');
    const goalIds=new Set<string>();
    for(const rawGoal of input.goals){
      if(rawGoal===null||typeof rawGoal!=='object'||Array.isArray(rawGoal))throw new Error('personal-curriculum-goal-ranking-goal-invalid');
      const goal=rawGoal as unknown as Record<string,unknown>;
      if(typeof goal.id!=='string'||!goal.id.trim()||goal.id.length>256||
         typeof goal.title!=='string'||!goal.title.trim()||goal.title.length>512||
         typeof goal.reason!=='string'||goal.reason.length>4096||
         typeof goal.source!=='string'||goal.source.length>120||
         typeof goal.status!=='string'||goal.status.length>120||
         !['active','paused','completed','abandoned','blocked'].includes(goal.status)||
         !isCurriculumUnit(goal.importance)||!isCurriculumUnit(goal.urgency)||
         !isCurriculumUnit(goal.confidence)||!isCurriculumUnit(goal.progress)||
         !isCurriculumTimestamp(goal.createdAt)||!isCurriculumTimestamp(goal.updatedAt)||
         (goal.parentId!==undefined&&(typeof goal.parentId!=='string'||goal.parentId.length>256))||
         goalIds.has(goal.id)){
        throw new Error('personal-curriculum-goal-ranking-goal-invalid');
      }
      goalIds.add(goal.id);
    }
    const ranked=input.goals.filter(g=>g.status==='active').map(goal=>{
      const family=this.family(goal); const thread=this.state.threads.find(t=>t.family===family);
      const historyFit=thread?clamp(thread.causalStrength01*.35+thread.retention01*.2+thread.transfer01*.2+(1-thread.unresolved01)*.25):0;
      const learningNeed=thread?.learningNeed01??clamp((1-goal.progress)*.4+(1-goal.confidence)*.3+input.uncertainty01*.2+input.novelty01*.1);
      const socialFit=thread?thread.socialRelevance01:input.social01*.42;
      const identityFit=thread?thread.identityRelevance01:input.identity01*.35;
      const score=clamp(goal.importance*.18+goal.urgency*.12+learningNeed*.28+historyFit*.16+socialFit*.08+identityFit*.12+this.state.curriculumPressure01*.06);
      return {goalId:goal.id,score01:score,threadId:thread?.id??null,learningNeed01:learningNeed,historyFit01:historyFit,socialFit01:socialFit,identityFit01:identityFit,reason:thread?`history-thread:${thread.id}`:learningNeed>.6?'new-learning-gap':'goal-priority'};
    }).sort((a,b)=>b.score01-a.score01);
    const top=ranked[0];
    this.state.focusGoalId=top?.goalId??null;
    this.state.focusThreadId=top?.threadId??null;
    return ranked;
  }

  suggestedAction(goalId:string|null):'respond'|'explore'|'verify'|'reflect'|'wait'|null{
    const goal=goalId&&goalId===this.state.focusGoalId?this.state.threads.find(t=>t.id===this.state.focusThreadId):null;
    const top=goal??this.state.threads.filter(t=>t.status!=='suppressed').sort((a,b)=>b.priority01-a.priority01)[0]??null;
    if(!top)return null;
    if(top.socialRelevance01>.62)return 'respond';
    if(top.causalStrength01<.45||top.unresolved01>.62)return 'verify';
    if(top.transfer01<.4)return 'explore';
    if(top.retention01<.55)return 'reflect';
    return 'wait';
  }

  diagnostics(){
    const active=this.state.threads.filter(t=>t.status==='active').sort((a,b)=>b.priority01-a.priority01);
    return {version:1,cycles:this.state.cycles,threads:this.state.threads.length,activeThreads:active.length,focusThreadId:this.state.focusThreadId,focusGoalId:this.state.focusGoalId,curriculumPressure01:this.state.curriculumPressure01,socialLearning01:this.state.socialLearning01,autobiographicalLearning01:this.state.autobiographicalLearning01,identityLearning01:this.state.identityLearning01,transferReadiness01:this.state.transferReadiness01,completedThreads:this.state.completedThreads,suppressedThreads:this.state.suppressedThreads,topThread:active[0]?{id:active[0].id,title:active[0].title,priority01:active[0].priority01,learningNeed01:active[0].learningNeed01,contexts:active[0].contexts}:null};
  }
}
