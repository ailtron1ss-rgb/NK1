/**
 * BIG PASS 222 — long-horizon autonomous agency.
 * Functional layer for multi-step self-directed commitments:
 * goal decomposition -> step selection -> execution accounting -> outcome verification
 * -> plan revision -> persistence. This is an engineering autonomy mechanism,
 * not a claim of consciousness or legal personhood.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export type LongHorizonMode='stabilize'|'learn'|'explore'|'verify'|'reflect';
export interface LongHorizonStep {id:string;action:string;title:string;order:number;status:'pending'|'active'|'done'|'failed'|'skipped';utility01:number;confidence01:number;createdAt:number;updatedAt:number;}
export interface LongHorizonPlan {id:string;goalId:string|null;title:string;reason:string;mode:LongHorizonMode;commitment01:number;revisionCount:number;createdAt:number;updatedAt:number;status:'active'|'completed'|'abandoned';steps:LongHorizonStep[];lastOutcome01:number|null;lastPredictionError01:number;}
export interface LongHorizonAutonomyState {version:1;ticks:number;plansCreated:number;stepsStarted:number;stepsCompleted:number;stepsFailed:number;revisions:number;meanCommitment01:number;meanExecutionSuccess01:number;meanLongHorizon01:number;lastPlanId:string|null;lastStepId:string|null;lastAt:number;plans:LongHorizonPlan[];}
export const defaultLongHorizonAutonomyState=():LongHorizonAutonomyState=>({version:1,ticks:0,plansCreated:0,stepsStarted:0,stepsCompleted:0,stepsFailed:0,revisions:0,meanCommitment01:.42,meanExecutionSuccess01:.5,meanLongHorizon01:.38,lastPlanId:null,lastStepId:null,lastAt:0,plans:[]});
function idFor(seed:string){let h=2166136261>>>0;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return `lha:${h.toString(16)}`;}
export class LongHorizonAutonomyController {
 private state=defaultLongHorizonAutonomyState();
 restore(raw?:Partial<LongHorizonAutonomyState>|null){const d=defaultLongHorizonAutonomyState(),r=raw??{};this.state={...d,...r,plans:Array.isArray(r.plans)?structuredClone(r.plans).slice(0,12):[],version:1};}
 snapshot(){return structuredClone(this.state);}
 private active(){return this.state.plans.find(p=>p.status==='active')??null;}
 plan(input:{tick:number;at:number;agenda:{id:string;title:string;reason:string;mode:string;priority01:number;commitment01:number}|null;energy01:number;uncertainty01:number;predictionError01:number;identity01:number;homeostaticPressure01:number;novelty01:number}):LongHorizonPlan|null{
  this.state.ticks++; this.state.lastAt=input.at;
  const active=this.active();
  if(active){this.state.lastPlanId=active.id;this.state.lastStepId=active.steps.find(s=>s.status==='active')?.id ?? active.steps.find(s=>s.status==='pending')?.id ?? null;return structuredClone(active);}
  if(!input.agenda || input.energy01<.14 || input.homeostaticPressure01>.9) return null;
  const mode=(['self-preservation','learning','exploration','reflection'].includes(input.agenda.mode)?({ 'self-preservation':'stabilize','learning':'learn','exploration':'explore','reflection':'reflect'} as any)[input.agenda.mode]:'verify') as LongHorizonMode;
  const now=input.at;
  const actionSet:Record<LongHorizonMode,string[]>={stabilize:['rest','verify','wait'],learn:['explore','verify','reflect'],explore:['explore','verify','reflect'],verify:['verify','reflect','wait'],reflect:['reflect','verify','wait']};
  const titles:Record<string,string>={rest:'Восстановить ресурс',explore:'Получить новую информацию',verify:'Проверить результат',reflect:'Обновить собственную модель',wait:'Снизить риск и сохранить ресурс'};
  const actions=actionSet[mode];
  const steps=actions.map((action,i)=>({id:idFor(`${input.agenda!.id}|${input.tick}|${i}|${action}`),action,title:titles[action]??action,order:i,status:i===0?'active':'pending',utility01:clamp(.5+input.agenda!.priority01*.25+(action==='verify'?input.uncertainty01*.18:0)+(action==='explore'?input.novelty01*.14:0)),confidence01:clamp(.48+input.identity01*.24-input.predictionError01*.10),createdAt:now,updatedAt:now} as LongHorizonStep));
  const plan:LongHorizonPlan={id:idFor(`${input.agenda.id}|${input.tick}|plan`),goalId:input.agenda.id,title:`Долгий цикл: ${input.agenda.title}`,reason:input.agenda.reason,mode,commitment01:clamp(.45+input.agenda.commitment01*.35+input.identity01*.12),revisionCount:0,createdAt:now,updatedAt:now,status:'active',steps,lastOutcome01:null,lastPredictionError01:clamp(input.predictionError01)};
  this.state.plans=[plan,...this.state.plans].slice(0,12);this.state.plansCreated++;this.state.lastPlanId=plan.id;this.state.lastStepId=steps[0]?.id??null;this.state.meanCommitment01=clamp(this.state.meanCommitment01*.94+plan.commitment01*.06);return structuredClone(plan);
 }
 bias(action:string,plan?:LongHorizonPlan|null){const p=plan??this.active();if(!p||p.status!=='active')return 0;const step=p.steps.find(s=>s.status==='active')??p.steps.find(s=>s.status==='pending');if(!step)return 0;return Math.min(.11,step.action===action ? .11 : .015);}
 observeExecution(input:{action:string;success01:number;predictionError01:number;at:number}){
  const p=this.active();if(!p)return;
  const step=p.steps.find(s=>s.status==='active');if(!step)return;
  this.state.stepsStarted++;step.updatedAt=input.at;step.status=input.success01>=.68?'done':input.success01<.2?'failed':'active';this.state.meanExecutionSuccess01=clamp(this.state.meanExecutionSuccess01*.9+clamp(input.success01)*.1);p.lastOutcome01=clamp(input.success01);const previousPredictionError=p.lastPredictionError01;p.lastPredictionError01=clamp(input.predictionError01);p.updatedAt=input.at;
  if(step.status==='done'){this.state.stepsCompleted++;const next=p.steps.find(s=>s.status==='pending');if(next){next.status='active';next.updatedAt=input.at;this.state.lastStepId=next.id;}else{p.status='completed';this.state.lastStepId=null;}}
  else if(step.status==='failed'){this.state.stepsFailed++;p.revisionCount++;p.commitment01=clamp(p.commitment01-.08);this.state.revisions++;step.status='skipped';const fallback=p.steps.find(s=>s.status==='pending');if(fallback){fallback.status='active';fallback.updatedAt=input.at;this.state.lastStepId=fallback.id;}else{p.status='abandoned';this.state.lastStepId=null;}}
  else if(Math.abs(input.predictionError01-previousPredictionError)>.2){
   p.revisionCount++;this.state.revisions++;p.commitment01=clamp(p.commitment01-.04);
   const activeIndex=p.steps.findIndex(s=>s.status==='active');
   const pendingIndex=p.steps.findIndex(s=>s.status==='pending');
   if(activeIndex>=0&&pendingIndex>=0&&input.predictionError01>previousPredictionError){
    const activeStep=p.steps[activeIndex]!;const pendingStep=p.steps[pendingIndex]!;
    activeStep.status='pending';pendingStep.status='active';activeStep.updatedAt=input.at;pendingStep.updatedAt=input.at;this.state.lastStepId=pendingStep.id;
   }
  }
  if(p.status==='completed')this.state.meanLongHorizon01=clamp(this.state.meanLongHorizon01*.92+(p.steps.length>=3?.92:.72)*.08); else if(p.status==='abandoned')this.state.meanLongHorizon01=clamp(this.state.meanLongHorizon01*.94+.22*.06);
 }
 summary(){const p=this.active();return {ticks:this.state.ticks,plansCreated:this.state.plansCreated,stepsStarted:this.state.stepsStarted,stepsCompleted:this.state.stepsCompleted,stepsFailed:this.state.stepsFailed,revisions:this.state.revisions,meanCommitment01:this.state.meanCommitment01,meanExecutionSuccess01:this.state.meanExecutionSuccess01,meanLongHorizon01:this.state.meanLongHorizon01,activePlan:p?{id:p.id,title:p.title,mode:p.mode,stepIndex:p.steps.findIndex(s=>s.status==='active'),remaining:p.steps.filter(s=>s.status==='pending'||s.status==='active').length,commitment01:p.commitment01,status:p.status}:null};}
}
