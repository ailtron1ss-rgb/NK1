import type { ActionKind, OrganismGoal, OrganismState } from '../core/types.ts';
import type { DevelopmentalSynthesisState } from './DevelopmentalSynthesisEngine.ts';
import type { SelfDevelopmentState } from './P36AutonomousSelfDevelopment.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const hash=(s:string)=>{let h=2166136261>>>0;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h.toString(16)};

export type DevelopmentExecutivePhase='orient'|'investigate'|'practice'|'integrate'|'transfer'|'consolidate'|'repair'|'complete';
export type DevelopmentExecutiveStatus='active'|'completed'|'paused'|'failed';

export interface DevelopmentPlanStep {
  id:string;
  action:ActionKind;
  purpose:'reduce-uncertainty'|'test-model'|'practice'|'integrate'|'transfer'|'retain'|'repair';
  requiredEvidence01:number;
  expectedGain01:number;
  completedTrials:number;
  successfulTrials:number;
  verifiedTrials:number;
  contexts:number;
  lastOutcome01:number;
  status:'pending'|'active'|'completed'|'blocked';
}

export interface DevelopmentExecutiveProject {
  id:string;
  goalId:string;
  objective:string;
  origin:string;
  phase:DevelopmentExecutivePhase;
  status:DevelopmentExecutiveStatus;
  priority01:number;
  confidence01:number;
  expectedGain01:number;
  progress01:number;
  retention01:number;
  transfer01:number;
  evidence01:number;
  revisionPressure01:number;
  autonomyFit01:number;
  steps:DevelopmentPlanStep[];
  selectedStepId:string|null;
  contexts:string[];
  successfulContexts:number;
  failedTrials:number;
  totalTrials:number;
  lastAction:ActionKind|'none';
  lastOutcome01:number;
  createdAt:number;
  lastAt:number;
}

export interface DevelopmentExecutiveDecision {
  tick:number;
  goalId:string|null;
  projectId:string|null;
  stepId:string|null;
  chosenAction:ActionKind;
  phase:DevelopmentExecutivePhase;
  score01:number;
  confidence01:number;
  reasons:string[];
  at:number;
}

export interface DevelopmentalExecutiveState {
  version:1;
  cycles:number;
  projects:DevelopmentExecutiveProject[];
  decisions:DevelopmentExecutiveDecision[];
  activeProjectId:string|null;
  completedProjects:number;
  failedProjects:number;
  pausedProjects:number;
  successfulExecutions:number;
  verifiedExecutions:number;
  transferWins:number;
  retentionWins:number;
  regressions:number;
  revisionPressure01:number;
  strategicCoherence01:number;
  autonomousPlanning01:number;
  longHorizonProgress01:number;
  lastDecision:string;
  lastAt:number;
}

export const defaultDevelopmentalExecutive=():DevelopmentalExecutiveState=>({
  version:1,cycles:0,projects:[],decisions:[],activeProjectId:null,completedProjects:0,failedProjects:0,pausedProjects:0,
  successfulExecutions:0,verifiedExecutions:0,transferWins:0,retentionWins:0,regressions:0,revisionPressure01:.18,
  strategicCoherence01:.3,autonomousPlanning01:.22,longHorizonProgress01:.18,lastDecision:'idle',lastAt:0,
});

export class DevelopmentalExecutiveEngine {
  private state=defaultDevelopmentalExecutive();

  restore(raw?:Partial<DevelopmentalExecutiveState>|null){
    const d=defaultDevelopmentalExecutive(),r=raw??{};
    this.state={...d,...r,version:1,
      projects:Array.isArray(r.projects)?r.projects.slice(-32).map((p:any)=>({...p,
        status:['active','completed','paused','failed'].includes(p.status)?p.status:'active',
        phase:['orient','investigate','practice','integrate','transfer','consolidate','repair','complete'].includes(p.phase)?p.phase:'orient',
        steps:Array.isArray(p.steps)?p.steps.slice(0,12).map((s:any)=>({...s,status:['pending','active','completed','blocked'].includes(s.status)?s.status:'pending'})):[],
        contexts:Array.isArray(p.contexts)?Array.from(new Set(p.contexts.map((x:any)=>String(x).slice(0,180)))).slice(0,24):[],
      })):[],
      decisions:Array.isArray(r.decisions)?r.decisions.slice(-256):[],
    };
  }
  snapshot(){return structuredClone(this.state);}

  beginCycle(){
    this.state.cycles++;
    this.state.revisionPressure01=clamp(this.state.revisionPressure01*.995+.005*this.projectFailurePressure());
  }

  private projectFailurePressure(){
    const active:DevelopmentExecutiveProject[]=this.state.projects.filter((p:DevelopmentExecutiveProject)=>p.status==='active');
    return clamp(active.length?active.reduce((s,p)=>s+Math.min(1,p.failedTrials/4)*.6+p.revisionPressure01*.4,0)/active.length:0);
  }

  syncGoals(goals:OrganismGoal[],at:number,synthesis:DevelopmentalSynthesisState,p36:SelfDevelopmentState){
    const active=goals.filter(g=>g.status==='active').slice(0,8);
    const byGoal=new Map<string,DevelopmentExecutiveProject>(this.state.projects.map((p:DevelopmentExecutiveProject)=>[p.goalId,p] as const));
    for(const goal of active){
      let project=byGoal.get(goal.id);
      const matching = synthesis.macros.find(m=>m.status==='promoted' && m.sequence.length>=3 && (m.transfer01>=.5 || m.retention01>=.58));
      const p36Area=p36.currentHypothesisId? p36.hypotheses.find(h=>h.id===p36.currentHypothesisId)?.area:null;
      if(!project){
        const phase:DevelopmentExecutivePhase=(goal.source==='learned'||p36Area)?'investigate':(goal.importance>.72?'practice':'orient');
        const objective=`${goal.title}${p36Area?` [development-area:${p36Area}]`:''}`.slice(0,240);
        const steps=this.compilePlan(goal,phase,matching?.sequence??null);
        project={
          id:`devx:${hash(`${goal.id}|${objective}`)}`,goalId:goal.id,objective,origin:goal.source,phase,status:'active',priority01:clamp(goal.importance*.45+goal.urgency*.35+goal.confidence*.2),
          confidence01:clamp(goal.confidence*.7+.2),expectedGain01:clamp(.35+goal.importance*.25+goal.urgency*.2),progress01:clamp(goal.progress),retention01:.5,transfer01:0,evidence01:0,revisionPressure01:.18,autonomyFit01:goal.source==='intrinsic'||goal.source==='learned'?.82:.52,
          steps,selectedStepId:null,contexts:[],successfulContexts:0,failedTrials:0,totalTrials:0,lastAction:'none',lastOutcome01:.5,createdAt:at,lastAt:at,
        };
        this.state.projects.unshift(project); this.state.projects=this.state.projects.slice(0,32);
      } else {
        project.priority01=clamp(project.priority01*.94+(goal.importance*.45+goal.urgency*.35+goal.confidence*.2)*.06);
        project.progress01=clamp(project.progress01*.92+goal.progress*.08);
        project.autonomyFit01=clamp(project.autonomyFit01*.96+(goal.source==='intrinsic'||goal.source==='learned'?.82:.52)*.04);
        project.lastAt=Math.max(project.lastAt,at);
        if(project.status==='paused'&&goal.status==='active'&&project.confidence01>.42)project.status='active';
      }
    }
    const candidate=this.state.projects.filter((p:DevelopmentExecutiveProject)=>p.status==='active').sort((a:DevelopmentExecutiveProject,b:DevelopmentExecutiveProject)=>this.projectScore(b,synthesis,p36)-this.projectScore(a,synthesis,p36))[0]??null;
    this.state.activeProjectId=candidate?.id??null;
    this.state.autonomousPlanning01=clamp(this.state.autonomousPlanning01*.95+(candidate?candidate.autonomyFit01*.7+candidate.confidence01*.3:0)*.05);
    return candidate?structuredClone(candidate):null;
  }

  private projectScore(project:DevelopmentExecutiveProject,synthesis:DevelopmentalSynthesisState,p36:SelfDevelopmentState){
    const activeHypothesis=p36.currentHypothesisId?1:0;
    const strategySupport=synthesis.macros.some(m=>m.status==='promoted'&&m.transfer01>=.5&&m.retention01>=.58)?1:0;
    const phaseWeight:Record<DevelopmentExecutivePhase,number>={orient:.42,investigate:.58,practice:.68,integrate:.72,transfer:.84,consolidate:.78,repair:.9,complete:.05};
    return clamp(project.priority01*.34+project.confidence01*.18+project.expectedGain01*.14+(1-project.progress01)*.10+project.autonomyFit01*.08+phaseWeight[project.phase]*.10+strategySupport*.04+activeHypothesis*.02);
  }

  private compilePlan(goal:OrganismGoal,phase:DevelopmentExecutivePhase,macro:ActionKind[]|null):DevelopmentPlanStep[]{
    const base:ActionKind[]=macro&&macro.length>=3?macro.slice(-6):goal.source==='homeostatic'?['verify','reflect','rest']:goal.source==='external'?['respond','verify','reflect']:['explore','verify','reflect','respond'];

    const out:DevelopmentPlanStep[]=[];
    for(let i=0;i<Math.min(7,base.length);i++){
      const action=ACTIONS.includes(base[i])?base[i]:'reflect';
      const purpose=phase==='repair'?'repair':purposeFor(i,base.length);
      out.push({id:`step:${i}:${action}:${hash(`${goal.id}|${i}|${action}`)}`,action,purpose,requiredEvidence01:clamp(.48+i*.07),expectedGain01:clamp(.18+.10*(i<3?1:.7)),completedTrials:0,successfulTrials:0,verifiedTrials:0,contexts:0,lastOutcome01:.5,status:i===0?'active':'pending'});
    }
    return out;
  }

  decide(input:{tick:number;at:number;state:OrganismState;goal:OrganismGoal|null;synthesis:DevelopmentalSynthesisState;p36:SelfDevelopmentState;recentActions:ActionKind[];contextKey:string;availableActions?:ActionKind[]}):DevelopmentExecutiveDecision{
    const project=input.goal?this.state.projects.find(p=>p.goalId===input.goal!.id&&p.status==='active')??null:null;
    const available=new Set(input.availableActions??ACTIONS);
    let step=project?this.selectStep(project,input.contextKey,input.synthesis,input.p36):null;
    if(project&&step)project.selectedStepId=step.id;
    const action=step?.action&&available.has(step.action)?step.action:(available.has('verify')&&input.state.predictionError>.48?'verify':available.has('reflect')&&input.synthesis.revisionPressure01>.42?'reflect':available.has('explore')&&input.state.needs.novelty>.55?'explore':'respond');
    const fit=step?clamp(.42+step.expectedGain01*.28+step.completedTrials*.02+step.contexts*.025):.3;
    const resourceFit=clamp(input.state.needs.energy*.42+(1-input.state.needs.cognitiveLoad)*.28+input.state.attentionBudget*.30);
    const phase=project?.phase??'orient';
    const confidence=clamp((project?.confidence01??.32)*.45+(step?.requiredEvidence01?1-step.requiredEvidence01:.45)*.15+resourceFit*.2+(1-input.state.predictionError)*.2);
    const score=clamp(fit*.48+resourceFit*.17+confidence*.2+(project?.autonomyFit01??.25)*.15);
    const reasons=[`phase=${phase}`,step?`step=${step.purpose}`:'fallback-plan',`resource=${resourceFit.toFixed(2)}`];
    this.state.decisions=[{tick:input.tick,goalId:input.goal?.id??null,projectId:project?.id??null,stepId:step?.id??null,chosenAction:action,phase,score01:score,confidence01:confidence,reasons,at:input.at},...this.state.decisions].slice(0,256);
    this.state.lastDecision=`plan:${action}:${phase}`;this.state.lastAt=input.at;
    return {tick:input.tick,goalId:input.goal?.id??null,projectId:project?.id??null,stepId:step?.id??null,chosenAction:action,phase,score01:score,confidence01:confidence,reasons,at:input.at};
  }

  private selectStep(project:DevelopmentExecutiveProject,contextKey:string,synthesis:DevelopmentalSynthesisState,p36:SelfDevelopmentState){
    const contexts=project.contexts;
    const novel=!contexts.includes(contextKey);
    const pending:DevelopmentPlanStep[]=project.steps.filter((s:DevelopmentPlanStep)=>s.status==='pending'||s.status==='active');
    if(!pending.length)return null;
    const repair=pending.find((s:DevelopmentPlanStep)=>s.purpose==='repair'&&project.failedTrials>=2);
    if(repair)return repair;
    if(project.phase==='transfer'){
      const transfer=pending.find((s:DevelopmentPlanStep)=>s.purpose==='transfer');if(transfer)return transfer;
    }
    if(project.phase==='consolidate'){
      const retain=pending.find((s:DevelopmentPlanStep)=>s.purpose==='retain');if(retain)return retain;
    }
    const current=pending[0];
    if(novel && current.purpose==='practice' && synthesis.macros.some(m=>m.status==='promoted'&&m.transfer01>.58)){
      const transfer=pending.find((s:DevelopmentPlanStep)=>s.purpose==='transfer');if(transfer)return transfer;
    }
    if(p36.currentHypothesisId&&current.purpose==='test-model')return current;
    return current;
  }

  bias(action:ActionKind,decision:DevelopmentExecutiveDecision|null):number{
    if(!decision||decision.chosenAction!==action)return 0;
    return Math.min(.08,Math.max(0,decision.score01-.48)*.12);
  }

  observeOutcome(input:{tick:number;at:number;goalId:string|null;action:ActionKind;outcome01:number;verified:boolean;contextKey:string;delayed:boolean;transfer:boolean;revisionPressure01?:number}){
    if(!input.goalId)return {project:null,completed:false,failed:false};
    const project=this.state.projects.find(p=>p.goalId===input.goalId&&p.status==='active');
    if(!project)return {project:null,completed:false,failed:false};
    const outcome=clamp(input.outcome01);project.totalTrials++;project.lastAction=input.action;project.lastOutcome01=outcome;project.lastAt=input.at;
    if(outcome>=.62){project.failedTrials=0;this.state.successfulExecutions++;}
    else {project.failedTrials++;if(project.failedTrials>=2)this.state.regressions++;}
    if(input.verified){this.state.verifiedExecutions++;project.evidence01=clamp(project.evidence01*.9+.1);}
    if(!project.contexts.includes(input.contextKey)){project.contexts=[input.contextKey,...project.contexts].slice(0,24);project.successfulContexts++;}
    const step=project.steps.find((s:DevelopmentPlanStep)=>s.id===project.selectedStepId)||project.steps.find((s:DevelopmentPlanStep)=>s.action===input.action&&s.status!=='blocked');
    if(step){step.completedTrials++;if(outcome>=.62)step.successfulTrials++;if(input.verified)step.verifiedTrials++;step.contexts=Math.max(step.contexts,project.contexts.length);step.lastOutcome01=outcome;step.status=step.completedTrials>=3&&step.successfulTrials/step.completedTrials>=.67?'completed':step.status==='blocked'?'blocked':'active';}
    project.retention01=clamp(project.retention01*.92+(input.delayed&&outcome>=.62?1:0)*.08);
    project.transfer01=clamp(project.transfer01*.9+(input.transfer&&outcome>=.62?.9:input.transfer?.2:0)*.1);
    project.revisionPressure01=clamp(project.revisionPressure01*.84+(input.revisionPressure01??0)*.16+(outcome<.4?.12:0));
    project.progress01=clamp(project.progress01*.9+(project.steps.filter((s:DevelopmentPlanStep)=>s.status==='completed').length/Math.max(1,project.steps.length))*.1);
    project.confidence01=clamp(project.confidence01*.9+(.45*project.evidence01+.3*project.retention01+.25*project.transfer01)*.1);
    const allDone=project.steps.every(s=>s.status==='completed');
    const good=project.totalTrials>=5&&project.successfulContexts>=3&&project.evidence01>=.45&&project.retention01>=.5;
    if(allDone&&good){project.phase='complete';project.status='completed';project.progress01=1;this.state.completedProjects++;this.state.retentionWins+=project.retention01>=.62?1:0;this.state.transferWins+=project.transfer01>=.55?1:0;}
    else if(project.failedTrials>=3&&project.revisionPressure01>.45){project.phase='repair';project.steps.forEach(s=>{if(s.status==='pending')s.status='blocked';});this.state.lastDecision='plan-repair';}
    else if(project.totalTrials>=3&&project.transfer01>.5)project.phase='transfer';
    else if(project.totalTrials>=2&&project.retention01>.54)project.phase='consolidate';
    else if(project.totalTrials>=2)project.phase='practice';
    this.state.strategicCoherence01=clamp(this.state.strategicCoherence01*.96+(project.phase==='complete'?1:project.phase==='repair'?.35:.6)*.04);
    this.state.longHorizonProgress01=clamp(this.state.longHorizonProgress01*.94+(project.retention01*.45+project.transfer01*.3+project.progress01*.25)*.06);
    if(input.revisionPressure01!=null)this.state.revisionPressure01=clamp(this.state.revisionPressure01*.9+input.revisionPressure01*.1);
    this.state.activeProjectId=this.state.projects.find((p:DevelopmentExecutiveProject)=>p.status==='active')?.id??null;
    return {project:structuredClone(project),completed:project.status==='completed',failed:project.status==='failed'};
  }

  actionBiases(decision:DevelopmentExecutiveDecision|null){
    return {chosen:decision?this.bias(decision.chosenAction,decision):0,phase:decision?.phase??'orient',projectId:decision?.projectId??null};
  }
  diagnostics(){
    const active:DevelopmentExecutiveProject[]=this.state.projects.filter((p:DevelopmentExecutiveProject)=>p.status==='active');
    return {
      cycles:this.state.cycles,
      projects:this.state.projects.length,
      activeProjects:active.length,
      completedProjects:this.state.completedProjects,
      failedProjects:this.state.failedProjects,
      pausedProjects:this.state.pausedProjects,
      successfulExecutions:this.state.successfulExecutions,
      verifiedExecutions:this.state.verifiedExecutions,
      transferWins:this.state.transferWins,
      retentionWins:this.state.retentionWins,
      regressions:this.state.regressions,
      revisionPressure01:this.state.revisionPressure01,
      strategicCoherence01:this.state.strategicCoherence01,
      autonomousPlanning01:this.state.autonomousPlanning01,
      longHorizonProgress01:this.state.longHorizonProgress01,
      activeProject:active[0]?{
        id:active[0].id,goalId:active[0].goalId,phase:active[0].phase,
        progress01:active[0].progress01,retention01:active[0].retention01,transfer01:active[0].transfer01,
      }:null,
      lastDecision:this.state.lastDecision,
    };
  }
}

function purposeFor(i:number,total:number):DevelopmentPlanStep['purpose']{
  if(i===0)return 'reduce-uncertainty';
  if(i===1)return 'test-model';
  if(i===total-2&&total>=4)return 'transfer';
  if(i===total-1&&total>=4)return 'retain';
  return 'practice';
}

export const defaultDevelopmentalExecutiveEngine=()=>new DevelopmentalExecutiveEngine();
