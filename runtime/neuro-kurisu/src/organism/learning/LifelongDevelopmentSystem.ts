import type { OrganismGoal, OrganismDecisionTrace } from '../core/types.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const SLEEP_PHASES:readonly SleepPhase[]=['awake','light','deep','waking'];
const SKILL_STATUSES:readonly LearnedSkill['status'][]=['candidate','habit','disabled'];
const strArr=(v:unknown,cap:number):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string').map(x=>x.slice(0,240)).slice(0,cap):[];
const sanitizeSkill=(v:unknown):LearnedSkill|null=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;return {id:r.id.slice(0,120),action:typeof r.action==='string'?r.action.slice(0,80):'',context:typeof r.context==='string'?r.context.slice(0,80):'',uses:cnt(r.uses,0),successes:cnt(r.successes,0),failures:cnt(r.failures,0),successRate:clamp(finN(r.successRate,.5)),confidence:clamp(finN(r.confidence,.2)),cost01:clamp(finN(r.cost01,0)),status:SKILL_STATUSES.includes(r.status as LearnedSkill['status'])?r.status as LearnedSkill['status']:'candidate',lastUsedAt:Math.max(0,finN(r.lastUsedAt,0)),failureModes:strArr(r.failureModes,8),promotedAt:r.promotedAt==null?null:Math.max(0,finN(r.promotedAt,0)),demotedAt:r.demotedAt==null?null:Math.max(0,finN(r.demotedAt,0))};};
const sanitizeDream=(v:unknown):DreamTrace|null=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;return {id:r.id.slice(0,120),seedIds:strArr(r.seedIds,16),question:typeof r.question==='string'?r.question.slice(0,500):'',insight:typeof r.insight==='string'?r.insight.slice(0,500):'',confidence:clamp(finN(r.confidence,0)),kind:r.kind==='deep'?'deep':'micro',createdAt:Math.max(0,finN(r.createdAt,0))};};
const sanitizeSession=(v:unknown):SleepSessionRecord|null=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>;return {startedAt:Math.max(0,finN(r.startedAt,0)),endedAt:r.endedAt==null?null:Math.max(0,finN(r.endedAt,0)),phase:SLEEP_PHASES.includes(r.phase as SleepPhase)?r.phase as SleepPhase:'awake',reason:typeof r.reason==='string'?r.reason.slice(0,240):'',replayed:cnt(r.replayed,0),dreams:cnt(r.dreams,0),skillsPromoted:cnt(r.skillsPromoted,0),memoriesDormant:cnt(r.memoriesDormant,0)};};
const sanitizeList=<T>(v:unknown,fn:(x:unknown)=>T|null,cap:number):T[]=>{if(!Array.isArray(v))return [];const out:T[]=[];for(const x of v){try{const s=fn(x);if(s!==null)out.push(s);}catch{}}return out.slice(-cap);};

export type SleepPhase='awake'|'light'|'deep'|'waking';
export interface LearnedSkill {
  id:string; action:string; context:string; uses:number; successes:number; failures:number;
  successRate:number; confidence:number; cost01:number; status:'candidate'|'habit'|'disabled';
  lastUsedAt:number; failureModes:string[]; promotedAt:number|null; demotedAt:number|null;
}
export interface DreamTrace { id:string; seedIds:string[]; question:string; insight:string; confidence:number; kind:'micro'|'deep'; createdAt:number; }
export interface SleepSessionRecord { startedAt:number; endedAt:number|null; phase:SleepPhase; reason:string; replayed:number; dreams:number; skillsPromoted:number; memoriesDormant:number; }
export interface LifelongDevelopmentState {
  version:1; phase:SleepPhase; cycleCount:number; totalSleepMs:number; replayCycles:number;
  reconsolidations:number; dormantMemories:number; reactivatedMemories:number; dreamCount:number;
  microDreamCount:number; deepDreamCount:number; skillPromotions:number; skillDemotions:number;
  projectResumptions:number; learningBudgetSpent:number; learningBudgetLimit:number;
  skills:LearnedSkill[]; dreams:DreamTrace[]; sessions:SleepSessionRecord[];
  lastSleepAt:number; lastWakeAt:number; lastConsolidationAt:number; lastMaintenanceAt:number;
  lastInsight:string; lastInsightConfidence:number;
}

export const defaultLifelongDevelopment=():LifelongDevelopmentState=>({
  version:1, phase:'awake', cycleCount:0, totalSleepMs:0, replayCycles:0, reconsolidations:0,
  dormantMemories:0, reactivatedMemories:0, dreamCount:0, microDreamCount:0, deepDreamCount:0,
  skillPromotions:0, skillDemotions:0, projectResumptions:0, learningBudgetSpent:0, learningBudgetLimit:0.8,
  skills:[], dreams:[], sessions:[], lastSleepAt:0,lastWakeAt:0,lastConsolidationAt:0,lastMaintenanceAt:0,lastInsight:'',lastInsightConfidence:0,
});

export class LifelongDevelopmentSystem {
  private state=defaultLifelongDevelopment();
  restore(value:LifelongDevelopmentState|undefined){ const d=defaultLifelongDevelopment(); const src:Record<string,unknown>=(value&&typeof value==='object')?value as unknown as Record<string,unknown>:{}; const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}}; const phase=read('phase'); this.state={version:1,phase:SLEEP_PHASES.includes(phase as SleepPhase)?phase as SleepPhase:d.phase,cycleCount:cnt(read('cycleCount'),d.cycleCount),totalSleepMs:Math.max(0,finN(read('totalSleepMs'),d.totalSleepMs)),replayCycles:cnt(read('replayCycles'),d.replayCycles),reconsolidations:cnt(read('reconsolidations'),d.reconsolidations),dormantMemories:cnt(read('dormantMemories'),d.dormantMemories),reactivatedMemories:cnt(read('reactivatedMemories'),d.reactivatedMemories),dreamCount:cnt(read('dreamCount'),d.dreamCount),microDreamCount:cnt(read('microDreamCount'),d.microDreamCount),deepDreamCount:cnt(read('deepDreamCount'),d.deepDreamCount),skillPromotions:cnt(read('skillPromotions'),d.skillPromotions),skillDemotions:cnt(read('skillDemotions'),d.skillDemotions),projectResumptions:cnt(read('projectResumptions'),d.projectResumptions),learningBudgetSpent:clamp(finN(read('learningBudgetSpent'),d.learningBudgetSpent)),learningBudgetLimit:clamp(finN(read('learningBudgetLimit'),d.learningBudgetLimit)),skills:sanitizeList(read('skills'),sanitizeSkill,256),dreams:sanitizeList(read('dreams'),sanitizeDream,128),sessions:sanitizeList(read('sessions'),sanitizeSession,64),lastSleepAt:Math.max(0,finN(read('lastSleepAt'),d.lastSleepAt)),lastWakeAt:Math.max(0,finN(read('lastWakeAt'),d.lastWakeAt)),lastConsolidationAt:Math.max(0,finN(read('lastConsolidationAt'),d.lastConsolidationAt)),lastMaintenanceAt:Math.max(0,finN(read('lastMaintenanceAt'),d.lastMaintenanceAt)),lastInsight:typeof read('lastInsight')==='string'?(read('lastInsight') as string).slice(0,500):d.lastInsight,lastInsightConfidence:clamp(finN(read('lastInsightConfidence'),d.lastInsightConfidence))}; }
  snapshot(){return structuredClone(this.state);}
  observeDecision(trace:OrganismDecisionTrace, budget01:number){
    this.state.cycleCount++;
    const selected=trace.selected; if(!selected) return;
    const id=`${selected.action}|${trace.stateBefore.lastAction==='none'?'general':'active'}`;
    let skill=this.state.skills.find(s=>s.id===id);
    if(!skill){ skill={id,action:selected.action,context:'active',uses:0,successes:0,failures:0,successRate:.5,confidence:.2,cost01:clamp(selected.predictedCost),status:'candidate',lastUsedAt:0,failureModes:[],promotedAt:null,demotedAt:null}; this.state.skills=[skill,...this.state.skills].slice(0,256); }
    skill.uses++; skill.lastUsedAt=Date.now(); skill.cost01=clamp(skill.cost01*.88+selected.predictedCost*.12); this.state.learningBudgetSpent=clamp(this.state.learningBudgetSpent+selected.predictedCost*0.002);
    if(budget01<0.25){ skill.confidence=clamp(skill.confidence*.98); }
  }
  observeOutcome(action:string,success:number,context='active',cost01=.2,failureMode?:string){
    const skill=this.state.skills.find(s=>s.action===action&&s.context===context); if(!skill) return;
    const s=clamp(success); if(s>=.65) skill.successes++; else if(s<=.3){skill.failures++; if(failureMode) skill.failureModes=[failureMode,...skill.failureModes.filter(x=>x!==failureMode)].slice(0,8);}
    skill.successRate=clamp(skill.successes/Math.max(1,skill.successes+skill.failures));
    skill.confidence=clamp(skill.confidence*.82+Math.min(1,skill.uses/10)*.18);
    skill.cost01=clamp(skill.cost01*.88+clamp(cost01)*.12);
    if(skill.status==='candidate'&&skill.uses>=4&&skill.successRate>=.72){skill.status='habit';skill.promotedAt=Date.now();this.state.skillPromotions++;}
    if(skill.status==='habit'&&skill.uses>=6&&skill.successRate<.45){skill.status='candidate';skill.demotedAt=Date.now();this.state.skillDemotions++;}
  }
  enterSleep(reason='scheduled',phase:SleepPhase='light'){
    if(this.state.phase!=='awake') return;
    this.state.phase=phase; this.state.lastSleepAt=Date.now();
    this.state.sessions.unshift({startedAt:this.state.lastSleepAt,endedAt:null,phase,reason,replayed:0,dreams:0,skillsPromoted:0,memoriesDormant:0});
    this.state.sessions=this.state.sessions.slice(0,64);
  }
  wake(reason='manual'){
    if(this.state.phase==='awake') return;
    const at=Date.now(), s=this.state.sessions[0];
    if(s){s.endedAt=at; this.state.totalSleepMs+=Math.max(0,at-s.startedAt);}
    this.state.lastWakeAt=at; this.state.phase='awake';
  }
  replay(traces:OrganismDecisionTrace[], budget01=.7){
    const usable=traces.filter(t=>t.selected).slice(0,24); this.state.replayCycles+=usable.length;
    const s=this.state.sessions[0]; if(s) s.replayed+=usable.length;
    const patterns=new Map<string,number>(); for(const t of usable){const a=t.selected!.action;patterns.set(a,(patterns.get(a)||0)+1);}
    const top=[...patterns.entries()].sort((a,b)=>b[1]-a[1])[0];
    if(top){this.state.lastInsight=`replay-pattern:${top[0]}:${top[1]}`;this.state.lastInsightConfidence=clamp(.35+top[1]/Math.max(4,usable.length)*.5);}
    this.state.learningBudgetSpent=clamp(this.state.learningBudgetSpent+usable.length*.001*(1-budget01));
  }
  dream(question:string, kind:'micro'|'deep', seedIds:string[], budget01=.7){
    const now=Date.now(); const confidence=clamp(.38+budget01*.28+seedIds.length*.03);
    const variants=kind==='micro' ? ['test-a-small-change','revisit-likely-cause','search-for-counterexample'] : ['recombine-old-episode','simulate-alternative-path','compare-failure-modes'];
    const variant=variants[Math.floor(Math.random()*variants.length)];
    const insight=kind==='micro' ? `micro-simulation:${question.slice(0,100)}:${variant}` : `deep-simulation:${question.slice(0,100)}:${variant}`;
    const d:DreamTrace={id:`dream-${now}-${Math.random().toString(16).slice(2)}`,seedIds:seedIds.slice(0,8),question:question.slice(0,180),insight,confidence,kind,createdAt:now};
    this.state.dreams=[d,...this.state.dreams].slice(0,128); this.state.dreamCount++; if(kind==='micro') this.state.microDreamCount++; else this.state.deepDreamCount++;
    const s=this.state.sessions[0]; if(s) s.dreams++;
    this.state.lastInsight=insight;this.state.lastInsightConfidence=confidence;
  }
  markMemoryMaintenance(dormant:number,reactivated:number,reconsolidations:number){
    this.state.dormantMemories+=Math.max(0,dormant);this.state.reactivatedMemories+=Math.max(0,reactivated);this.state.reconsolidations+=Math.max(0,reconsolidations);this.state.lastMaintenanceAt=Date.now();
    const s=this.state.sessions[0];if(s)s.memoriesDormant+=Math.max(0,dormant);
  }
  resumeProjects(goals:OrganismGoal[]):number{
    const resumable=goals.filter(g=>(g.status==='active'||g.status==='paused')&&(g.progress<1)).sort((a,b)=>(b.importance+b.urgency)-(a.importance+a.urgency));
    const selected=resumable.slice(0,3);
    for(const goal of selected){ if(goal.status==='paused') goal.status='active'; goal.updatedAt=Date.now(); }
    const n=selected.length; if(n){ this.state.projectResumptions+=n; }
    return n;
  }
  maintenance(budget01=.8){
    if(this.state.phase==='waking') this.state.phase='awake';
    if(budget01<.3) this.state.learningBudgetLimit=.55; else if(budget01>.7) this.state.learningBudgetLimit=.85;
    this.state.learningBudgetSpent=clamp(this.state.learningBudgetSpent*.92); this.state.lastConsolidationAt=Date.now();
    this.state.skills=this.state.skills.slice(0,256); this.state.dreams=this.state.dreams.slice(0,128);
  }
}
