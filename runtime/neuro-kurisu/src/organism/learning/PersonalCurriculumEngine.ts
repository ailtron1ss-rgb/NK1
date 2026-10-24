import type { OrganismGoal } from '../core/types.ts';
import { snapshotPlainData } from './LearningTrustBoundary.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clean=(x:unknown,n=140)=>String(x??'').trim().replace(/\s+/g,' ').slice(0,n);
const hash=(s:string)=>{let h=2166136261>>>0;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return (h>>>0).toString(16).padStart(8,'0');};
const isRecord=(value:unknown):value is Record<string,unknown>=>{
  if(value===null||typeof value!=='object'||Array.isArray(value))return false;
  try{const prototype=Object.getPrototypeOf(value);return prototype===Object.prototype||prototype===null;}catch{return false;}
};
const isCounter=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const isUnit=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
const isTime=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const isCleanText=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value&&clean(value,max)===value&&
  !Array.from(value).some(character=>{const code=character.charCodeAt(0);return code<=0x1f||code===0x7f||(code>=0x80&&code<=0x9f);});

const THREAD_KEYS=new Set([
  'id','family','title','source','occurrences','verified','successes','failures','contexts','contextKeys',
  'socialRelevance01','identityRelevance01','causalStrength01','unresolved01','retention01','transfer01',
  'learningNeed01','confidence01','priority01','status','lastOutcome01','lastAt',
]);

function parseCurriculumThread(value:unknown):CurriculumThread|null{
  try{
    if(!isRecord(value)||Object.keys(value).some(key=>!THREAD_KEYS.has(key)))return null;
    const x=value;
    if(!isCleanText(x.family,180)||!isCleanText(x.title,140)||x.id!==`curr:${hash(x.family)}`||
       !['autobiographical','social','goal','mixed'].includes(String(x.source))||
       !['emerging','active','satisfied','suppressed'].includes(String(x.status))||
       !isCounter(x.occurrences)||!isCounter(x.verified)||x.verified>x.occurrences||
       !isCounter(x.successes)||!isCounter(x.failures)||x.successes+x.failures>x.occurrences||
       !isCounter(x.contexts)||!Array.isArray(x.contextKeys)||Object.getPrototypeOf(x.contextKeys)!==Array.prototype||
       x.contextKeys.length>24||x.contexts!==x.contextKeys.length||
       new Set(x.contextKeys).size!==x.contextKeys.length||
       x.contextKeys.some((v)=>!isCleanText(v,180))||
       !isUnit(x.socialRelevance01)||!isUnit(x.identityRelevance01)||!isUnit(x.causalStrength01)||
       !isUnit(x.unresolved01)||!isUnit(x.retention01)||!isUnit(x.transfer01)||!isUnit(x.learningNeed01)||
       !isUnit(x.confidence01)||!isUnit(x.priority01)||!isUnit(x.lastOutcome01)||!isTime(x.lastAt))return null;
    return {
      id:x.id as string,family:x.family,title:x.title,source:x.source as CurriculumThread['source'],
      occurrences:x.occurrences,verified:x.verified,successes:x.successes,failures:x.failures,
      contexts:x.contexts,contextKeys:[...x.contextKeys] as string[],
      socialRelevance01:x.socialRelevance01,identityRelevance01:x.identityRelevance01,
      causalStrength01:x.causalStrength01,unresolved01:x.unresolved01,retention01:x.retention01,
      transfer01:x.transfer01,learningNeed01:x.learningNeed01,confidence01:x.confidence01,
      priority01:x.priority01,status:x.status as CurriculumThread['status'],
      lastOutcome01:x.lastOutcome01,lastAt:x.lastAt,
    };
  }catch{return null;}
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

  private reconcileThreadCounts():void {
    this.state.completedThreads=this.state.threads.filter(thread=>thread.status==='satisfied').length;
    this.state.suppressedThreads=this.state.threads.filter(thread=>thread.status==='suppressed').length;
  }
  restore(raw?:Partial<PersonalCurriculumState>|null){
    const d=defaultPersonalCurriculum();
    if(raw===undefined||raw===null){this.state=d;return;}
    let detached:unknown;
    try{
      detached=snapshotPlainData<unknown>(raw,{maxDepth:8,maxNodes:8192,maxStringUnits:1024*1024});
    }catch{this.state=d;return;}
    if(!isRecord(detached)||(detached.version!==undefined&&detached.version!==1)){this.state=d;return;}
    const r=detached;
    const rawThreads=Array.isArray(r.threads)?r.threads.slice(-64):[];
    const byId=new Map<string,CurriculumThread>(),invalidIds=new Set<string>(),conflictedIds=new Set<string>();
    for(const rawThread of rawThreads){
      const rawId=isRecord(rawThread)&&typeof rawThread.id==='string'?rawThread.id:null;
      const parsed=parseCurriculumThread(rawThread);
      if(!parsed){
        if(rawId)invalidIds.add(rawId);
        continue;
      }
      if(invalidIds.has(parsed.id)||conflictedIds.has(parsed.id)){byId.delete(parsed.id);conflictedIds.add(parsed.id);continue;}
      const previous=byId.get(parsed.id);
      if(!previous){byId.set(parsed.id,parsed);continue;}
      if(JSON.stringify(previous)!==JSON.stringify(parsed)){
        byId.delete(parsed.id);conflictedIds.add(parsed.id);
      }
    }
    for(const id of invalidIds)byId.delete(id);
    for(const id of conflictedIds)byId.delete(id);
    const threads=[...byId.values()].slice(-64);
    const threadIds=new Set(threads.map(thread=>thread.id));
    const rawFocusThread=typeof r.focusThreadId==='string'&&isCleanText(r.focusThreadId,160)&&threadIds.has(r.focusThreadId)?r.focusThreadId:null;
    const rawFocusGoal=typeof r.focusGoalId==='string'&&isCleanText(r.focusGoalId,180)?r.focusGoalId:null;
    this.state={
      version:1,
      cycles:isCounter(r.cycles)?r.cycles:d.cycles,
      threads,
      focusThreadId:rawFocusThread,
      focusGoalId:rawFocusGoal,
      curriculumPressure01:isUnit(r.curriculumPressure01)?r.curriculumPressure01:d.curriculumPressure01,
      socialLearning01:isUnit(r.socialLearning01)?r.socialLearning01:d.socialLearning01,
      autobiographicalLearning01:isUnit(r.autobiographicalLearning01)?r.autobiographicalLearning01:d.autobiographicalLearning01,
      identityLearning01:isUnit(r.identityLearning01)?r.identityLearning01:d.identityLearning01,
      transferReadiness01:isUnit(r.transferReadiness01)?r.transferReadiness01:d.transferReadiness01,
      completedThreads:threads.filter(thread=>thread.status==='satisfied').length,
      suppressedThreads:threads.filter(thread=>thread.status==='suppressed').length,
      lastAt:isTime(r.lastAt)?r.lastAt:d.lastAt,
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
    if(!input.goal)return null;
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
    if(thread.occurrences>=6&&thread.contexts>=3&&thread.verified>=3&&rate>=.72&&thread.lastOutcome01>=.62&&thread.retention01>=.62&&thread.transfer01>=.42&&thread.unresolved01<.32){ thread.status='satisfied'; }
    else if(thread.status!=='suppressed')thread.status=thread.priority01>.42?'active':'emerging';
    this.state.curriculumPressure01=clamp(this.state.curriculumPressure01*.94+thread.learningNeed01*.06);
    this.state.socialLearning01=clamp(this.state.socialLearning01*.95+thread.socialRelevance01*.05);
    this.state.autobiographicalLearning01=clamp(this.state.autobiographicalLearning01*.95+thread.unresolved01*.05);
    this.state.identityLearning01=clamp(this.state.identityLearning01*.95+thread.identityRelevance01*.05);
    this.state.transferReadiness01=clamp(this.state.transferReadiness01*.95+thread.transfer01*.05);
    this.state.lastAt=at;
    this.reconcileThreadCounts();
    return structuredClone(thread);
  }

  observeDevelopmentalContext(input:{action:string;source:'autobiographical'|'social'|'mixed';contextKey:string;pressure01:number;identity01:number;social01:number;causal01:number;evidence01:number;unresolved01:number;at?:number;label?:string}):CurriculumThread|null{
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
