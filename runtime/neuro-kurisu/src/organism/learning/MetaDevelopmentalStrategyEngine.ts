import type { ActionKind, OrganismGoal, OrganismState } from '../core/types.ts';
import type { DevelopmentalSynthesisState } from './DevelopmentalSynthesisEngine.ts';
import type { DevelopmentalExecutiveState } from './DevelopmentalExecutiveEngine.ts';
import type { SelfDevelopmentState } from './P36AutonomousSelfDevelopment.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const hash=(s:string)=>{let h=2166136261>>>0;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h.toString(16)};
const words=(s:string)=>new Set((String(s).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[]));
const overlap=(a:Set<string>,b:Set<string>)=>{let c=0;for(const x of a)if(b.has(x))c++;return c/Math.max(1,Math.min(a.size,b.size));};

export interface MetaStrategy {
  id:string;
  abstraction:string;
  components:string[];
  goalFamilies:string[];
  triggerWords:string[];
  preferredActions:ActionKind[];
  occurrences:number;
  successes:number;
  verified:number;
  contexts:number;
  contextKeys:string[];
  holdoutTrials:number;
  holdoutSuccesses:number;
  retention01:number;
  transfer01:number;
  confidence01:number;
  utility01:number;
  status:'candidate'|'promoted'|'blocked';
  failureStreak:number;
  applications:number;
  lastOutcome01:number;
  createdAt:number;
  lastAt:number;
}

export interface LearningAgendaItem {
  goalId:string;
  score01:number;
  expectedLearning01:number;
  transferPotential01:number;
  novelty01:number;
  uncertainty01:number;
  identityFit01:number;
  resourceFit01:number;
  reason:string;
}

export interface MetaDevelopmentalState {
  version:1;
  cycles:number;
  strategies:MetaStrategy[];
  agenda:LearningAgendaItem[];
  focusGoalId:string|null;
  focusAction:ActionKind|null;
  focusReason:string;
  applications:number;
  promotions:number;
  blocks:number;
  rollbackSignals:number;
  metaLearning01:number;
  strategyTransfer01:number;
  learningAllocation01:number;
  abstraction01:number;
  lastAt:number;
}

export const defaultMetaDevelopmental=():MetaDevelopmentalState=>({
  version:1,cycles:0,strategies:[],agenda:[],focusGoalId:null,focusAction:null,focusReason:'idle',applications:0,
  promotions:0,blocks:0,rollbackSignals:0,metaLearning01:.18,strategyTransfer01:.15,learningAllocation01:.25,abstraction01:0,lastAt:0,
});

export class MetaDevelopmentalStrategyEngine {
  private state=defaultMetaDevelopmental();

  restore(raw?:Partial<MetaDevelopmentalState>|null){
    const d=defaultMetaDevelopmental(),r=raw??{};
    this.state={...d,...r,version:1,
      strategies:Array.isArray(r.strategies)?r.strategies.slice(-96).map((s:any)=>({...s,
        components:Array.isArray(s.components)?s.components.slice(0,6):[],goalFamilies:Array.isArray(s.goalFamilies)?s.goalFamilies.slice(0,8):[],
        triggerWords:Array.isArray(s.triggerWords)?s.triggerWords.slice(0,32):[],preferredActions:Array.isArray(s.preferredActions)?s.preferredActions.filter((a:any)=>ACTIONS.includes(a)).slice(0,4):[],
        contextKeys:Array.isArray(s.contextKeys)?Array.from(new Set(s.contextKeys.map((x:any)=>String(x).slice(0,180)))).slice(0,24):[],
        status:['candidate','promoted','blocked'].includes(s.status)?s.status:'candidate'
      })):[],
      agenda:Array.isArray(r.agenda)?r.agenda.slice(0,12):[]
    };
  }
  snapshot(){return structuredClone(this.state);}

  beginCycle(){
    this.state.cycles++;
    this.state.lastAt=Date.now();
    this.state.strategyTransfer01=clamp(this.state.strategyTransfer01*.992+this.meanStrategyTransfer()*.008);
  }

  private meanStrategyTransfer(){
    const live=this.state.strategies.filter(s=>s.status!=='blocked');
    return live.length?live.reduce((a,s)=>a+s.transfer01,0)/live.length:0;
  }

  private family(goal:OrganismGoal){return `${goal.source}:${(goal.title.split(/\s+/).slice(0,3).join('-')||'goal').toLowerCase().slice(0,48)}`;}

  private actionFor(strategy:MetaStrategy|null):ActionKind|null{return strategy?.preferredActions[0]??null;}

  compileAgenda(input:{goals:OrganismGoal[];state:OrganismState;synthesis:DevelopmentalSynthesisState;executive:DevelopmentalExecutiveState;p36:SelfDevelopmentState;identity01:number;goalPressure01:number;portfolioAllocation01?:number;portfolioCompetition01?:number;portfolioFocusDomain?:string}){
    const active=input.goals.filter(g=>g.status==='active').slice(0,12);
    const activeExec=new Map(input.executive.projects.filter(p=>p.status==='active').map(p=>[p.goalId,p] as const));
    const promoted=input.synthesis.macros.filter(m=>m.status==='promoted').slice(0,32);
    const agenda:LearningAgendaItem[]=active.map(goal=>{
      const proj=activeExec.get(goal.id);
      const titleWords=words(`${goal.title} ${goal.reason}`);
      let bestSim=0; let bestTransfer=0; let bestStrategy:MetaStrategy|null=null;
      for(const s of this.state.strategies.filter(x=>x.status==='promoted').slice(0,32)){
        const sim=overlap(titleWords,new Set(s.triggerWords));
        const fam=s.goalFamilies.includes(this.family(goal))?.9:0;
        const fit=Math.max(sim,fam);
        if(fit>bestSim){bestSim=fit;bestTransfer=s.transfer01;bestStrategy=s;}
      }
      if(!bestStrategy){
        for(const m of promoted){
          const sim=overlap(titleWords,new Set(m.sequence));
          if(sim>bestSim){bestSim=sim;bestTransfer=m.transfer01;}
        }
      }
      const uncertainty=clamp(input.state.needs.uncertainty+input.state.predictionError*.35);
      const novelty=clamp(input.state.needs.novelty);
      const expectedLearning=clamp(uncertainty*.30+novelty*.18+(1-goal.confidence)*.18+(1-goal.progress)*.16+bestTransfer*.18);
      const identityFit=clamp(input.identity01*.55+goal.confidence*.2+(goal.source==='intrinsic'||goal.source==='learned'?.25:.08));
      const resourceFit=clamp(input.state.needs.energy*.55+(1-input.state.needs.cognitiveLoad)*.35+input.state.attentionBudget*.10);
      const developmentalFit=proj?clamp(proj.autonomyFit01*.35+proj.revisionPressure01*.12+(1-proj.progress01)*.28+proj.expectedGain01*.25):.35;
      const score=clamp(goal.importance*.22+goal.urgency*.14+expectedLearning*.24+bestTransfer*.12+identityFit*.08+resourceFit*.07+developmentalFit*.13+input.goalPressure01*.06);
      const reason=bestStrategy?`meta-transfer:${bestStrategy.id}`:expectedLearning>.62?'information-gap':'goal-priority';
      return {goalId:goal.id,score01:score,expectedLearning01:expectedLearning,transferPotential01:bestTransfer,novelty01:novelty,uncertainty01:uncertainty,identityFit01:identityFit,resourceFit01:resourceFit,reason};
    }).sort((a,b)=>b.score01-a.score01).slice(0,12);
    this.state.agenda=agenda;
    const top=agenda[0]??null;
    this.state.focusGoalId=top?.goalId??null;
    const topStrategy=top?this.bestStrategyForGoal(active.find(g=>g.id===top.goalId)):null;
    this.state.focusAction=this.actionFor(topStrategy) ?? (top&&top.expectedLearning01>.62?'verify':top&&top.novelty01>.58?'explore':'reflect');
    this.state.focusReason=top?.reason??'no-active-goal';
    this.state.learningAllocation01=clamp(this.state.learningAllocation01*.94+(top?.expectedLearning01??0)*.06);
    this.state.lastAt=Date.now();
    return structuredClone(this.state.agenda);
  }

  private bestStrategyForGoal(goal:OrganismGoal|undefined){
    if(!goal)return null;
    const tw=words(`${goal.title} ${goal.reason}`),fam=this.family(goal);
    let best:MetaStrategy|null=null,score=0;
    for(const s of this.state.strategies.filter(x=>x.status!=='blocked')){
      const sim=Math.max(overlap(tw,new Set(s.triggerWords)),s.goalFamilies.includes(fam)?.9:0);
      const q=sim*.45+s.transfer01*.22+s.retention01*.13+s.confidence01*.12+s.utility01*.08;
      if(q>score){score=q;best=s;}
    }
    return best;
  }

  actionBias(action:ActionKind,goalId:string|null):number{
    if(!goalId||goalId!==this.state.focusGoalId||!this.state.focusAction||this.state.focusAction!==action)return 0;
    const top=this.state.agenda[0];
    return Math.min(.055,Math.max(0,(top?.score01??.5)-.48)*.10 + this.state.strategyTransfer01*.008);
  }

  observeOutcome(input:{goal:OrganismGoal|null;action:ActionKind;outcome01:number;verified:boolean;contextKey:string;strategyId?:string|null;delayed?:boolean;transfer?:boolean;at?:number}){
    if(!input.goal)return {promoted:[],blocked:[]};
    const goal=input.goal,ctx=String(input.contextKey).slice(0,180),now=input.at??Date.now();
    const existing=this.state.strategies.find(s=>s.id===input.strategyId) ?? this.bestStrategyForGoal(goal);
    if(!existing && input.verified && input.action!=='wait' && input.action!=='defer'){
      const id=`meta:${hash(`${this.family(goal)}|${input.action}`)}`;
      const s:MetaStrategy={id,abstraction:`learn:${this.family(goal)}`,components:[],goalFamilies:[this.family(goal)],triggerWords:Array.from(words(`${goal.title} ${goal.reason}`)).slice(0,12),preferredActions:[input.action],occurrences:0,successes:0,verified:0,contexts:0,contextKeys:[],holdoutTrials:0,holdoutSuccesses:0,retention01:.5,transfer01:0,confidence01:.3,utility01:.4,status:'candidate',failureStreak:0,applications:0,lastOutcome01:.5,createdAt:now,lastAt:now};
      this.state.strategies.unshift(s);this.state.strategies=this.state.strategies.slice(0,96);
    }
    const strat=this.state.strategies.find(s=>s.id===input.strategyId) ?? this.bestStrategyForGoal(goal);
    if(!strat)return {promoted:[],blocked:[]};
    strat.occurrences++; if(input.outcome01>=.62)strat.successes++; if(input.verified)strat.verified++; strat.applications++;
    if(!strat.preferredActions.includes(input.action)&&strat.preferredActions.length<4)strat.preferredActions.push(input.action);
    const newCtx=!strat.contextKeys.includes(ctx); if(newCtx){strat.contextKeys=[ctx,...strat.contextKeys].slice(0,24);strat.contexts=strat.contextKeys.length;}
    if(input.transfer&&input.outcome01>=.62)strat.transfer01=clamp(strat.transfer01*.86+.9*.14);
    else if(input.transfer)strat.transfer01=clamp(strat.transfer01*.9+.2*.1);
    if(input.delayed)strat.retention01=clamp(strat.retention01*.9+(input.outcome01>=.62?1:0)*.1);
    else strat.retention01=clamp(strat.retention01*.97+(.5+.5*input.outcome01)*.03);
    if(input.verified)strat.holdoutTrials++; if(input.verified&&input.outcome01>=.62)strat.holdoutSuccesses++;
    strat.utility01=clamp(strat.utility01*.88+input.outcome01*.12);
    strat.confidence01=clamp(strat.confidence01*.9+(input.verified?.85:.35)*.05+strat.transfer01*.05+strat.retention01*.04);
    strat.lastOutcome01=input.outcome01;strat.lastAt=now;
    if(input.outcome01<.4)strat.failureStreak++;else strat.failureStreak=0;
    const rate=strat.successes/Math.max(1,strat.occurrences);
    const ready=strat.occurrences>=5&&strat.contexts>=3&&strat.verified>=3&&rate>=.7&&strat.transfer01>=.5&&strat.retention01>=.58&&strat.confidence01>=.52;
    const promoted:string[]=[],blocked:string[]=[];
    if(strat.status==='candidate'&&ready){strat.status='promoted';this.state.promotions++;promoted.push(strat.id);}
    else if(strat.status==='promoted'&&strat.failureStreak>=3){strat.status='blocked';this.state.blocks++;this.state.rollbackSignals++;blocked.push(strat.id);}
    this.state.metaLearning01=clamp(this.state.metaLearning01*.96+(ready?.9:.35)*.04);
    this.state.abstraction01=clamp(this.state.abstraction01*.97+(this.state.strategies.filter(s=>s.status==='promoted').length/8)*.03);
    this.state.strategyTransfer01=clamp(this.state.strategyTransfer01*.95+strat.transfer01*.05);
    return {promoted,blocked};
  }

  synthesize(input:{goals:OrganismGoal[];synthesis:DevelopmentalSynthesisState;executive:DevelopmentalExecutiveState;at:number}){
    const promotedProjects=input.executive.projects.filter(p=>p.status==='completed'&&p.progress01>=.9).slice(0,16);
    const promotedMacros=input.synthesis.macros.filter(m=>m.status==='promoted').slice(0,32);
    let created=0;
    const sequenceFor=(project:any):ActionKind[]=>project.steps?.filter((s:any)=>s.status==='completed'&&ACTIONS.includes(s.action)).map((s:any)=>s.action).slice(0,6)??(ACTIONS.includes(project.lastAction)?[project.lastAction]:[]);
    const overlapSeq=(a:ActionKind[],b:ActionKind[])=>{for(let k=Math.min(a.length,b.length,3);k>=1;k--){let ok=true;for(let i=0;i<k;i++)if(a[a.length-k+i]!==b[i])ok=false;if(ok)return k;}return 0;};
    for(const a of promotedProjects){
      for(const b of promotedProjects){
        if(a.goalId===b.goalId)continue;
        const ga=input.goals.find(g=>g.id===a.goalId),gb=input.goals.find(g=>g.id===b.goalId);if(!ga||!gb)continue;
        const aa=sequenceFor(a),bb=sequenceFor(b);const k=overlapSeq(aa,bb);const actions=k?[...aa,...bb.slice(k)]:Array.from(new Set([...aa,...bb]));
        if(actions.length<2||actions.length>6)continue;
        const familyA=this.family(ga),familyB=this.family(gb); const id=`meta:compound:${hash(familyA+'|'+familyB+'|'+actions.join('>'))}`;
        if(this.state.strategies.some(s=>s.id===id))continue;
        this.state.strategies.unshift({id,abstraction:'cross-goal-compound',components:[a.id,b.id],goalFamilies:[familyA,familyB],triggerWords:Array.from(new Set([...words(ga.title+' '+ga.reason),...words(gb.title+' '+gb.reason)])).slice(0,20),preferredActions:Array.from(new Set(actions)).slice(0,4),occurrences:0,successes:0,verified:0,contexts:0,contextKeys:[],holdoutTrials:0,holdoutSuccesses:0,retention01:clamp((a.retention01+b.retention01)/2),transfer01:clamp((a.transfer01+b.transfer01)/2),confidence01:clamp((a.confidence01+b.confidence01)/2),utility01:clamp((a.confidence01+b.confidence01)/2),status:'candidate',failureStreak:0,applications:0,lastOutcome01:.5,createdAt:input.at,lastAt:input.at});
        created++; if(this.state.strategies.length>=96)break;
      }
      if(this.state.strategies.length>=96)break;
    }
    if(promotedMacros.length){
      for(let i=0;i<promotedMacros.length&&i<12;i++)for(let j=i+1;j<promotedMacros.length&&j<12;j++){
        const a=promotedMacros[i],b=promotedMacros[j]; const k=overlapSeq(a.sequence,b.sequence); if(!k)continue;
        const actions=[...a.sequence,...b.sequence.slice(k)]; if(actions.length<3||actions.length>6)continue;
        const id=`meta:macro:${hash(a.id+'|'+b.id+'|'+actions.join('>'))}`;
        if(this.state.strategies.some(s=>s.id===id))continue;
        this.state.strategies.unshift({id,abstraction:'cross-macro-abstraction',components:[a.id,b.id],goalFamilies:[],triggerWords:[],preferredActions:Array.from(new Set(actions)).slice(0,4),occurrences:0,successes:0,verified:0,contexts:0,contextKeys:[],holdoutTrials:0,holdoutSuccesses:0,retention01:clamp((a.retention01+b.retention01)/2),transfer01:clamp((a.transfer01+b.transfer01)/2),confidence01:clamp((a.confidence01+b.confidence01)/2),utility01:.5,status:'candidate',failureStreak:0,applications:0,lastOutcome01:.5,createdAt:input.at,lastAt:input.at});
        created++; if(this.state.strategies.length>=96)break;
      }
    }
    if(promotedMacros.length&&created===0)this.state.abstraction01=clamp(this.state.abstraction01+.004);
    else this.state.abstraction01=clamp(this.state.abstraction01*.97+Math.min(1,created/4)*.03);
    return {created,strategies:this.state.strategies.length};
  }

  diagnostics(){
    const promoted=this.state.strategies.filter(s=>s.status==='promoted').length;
    return {...this.snapshot(),promoted};
  }
}

export const defaultMetaDevelopmentalStrategyEngine=()=>new MetaDevelopmentalStrategyEngine();
