import type { ActionKind, OrganismGoal, OrganismState } from '../core/types.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clean=(x:unknown,n=160)=>String(x??'').trim().replace(/\s+/g,' ').slice(0,n);

type Horizon='immediate'|'near'|'long'|'identity';
type Domain='self'|'world'|'social'|'skills'|'research'|'embodiment';

export interface TrajectoryProjection {
  action:ActionKind;
  horizon:Horizon;
  value01:number;
  continuity01:number;
  goalFit01:number;
  socialFit01:number;
  identityFit01:number;
  learningReturn01:number;
  futureFit01:number;
  uncertainty01:number;
  repairNeed01:number;
  commitmentRelief01:number;
  resourceFit01:number;
  explanation:string;
}

export interface TrajectoryForecast {
  action:ActionKind;
  score01:number;
  horizonValues:Record<Horizon,number>;
  expectedContinuity01:number;
  expectedAgency01:number;
  expectedSocial01:number;
  expectedGoalCoherence01:number;
  expectedLearning01:number;
  expectedRepair01:number;
  predictedRisk01:number;
  confidence01:number;
  generatedAt:number;
}

export interface TrajectoryOutcomeRecord {
  id:string;
  action:ActionKind;
  predicted01:number;
  actual01:number;
  error01:number;
  verified01:number;
  surprise01:number;
  contextKey:string;
  at:number;
}

export interface IntegratedLifeTrajectoryState {
  version:1;
  cycles:number;
  focusGoalId:string|null;
  focusDomain:Domain|'none';
  focusHorizon:Horizon;
  trajectoryCoherence01:number;
  selfContinuity01:number;
  socialContinuity01:number;
  goalContinuity01:number;
  futureAlignment01:number;
  agencyReadiness01:number;
  repairPressure01:number;
  commitmentPressure01:number;
  learningPressure01:number;
  predictionError01:number;
  counterfactualGap01:number;
  lastForecast:TrajectoryForecast|null;
  forecasts:TrajectoryForecast[];
  outcomes:TrajectoryOutcomeRecord[];
  lastReason:string;
  lastAt:number;
}

export const defaultIntegratedLifeTrajectory=():IntegratedLifeTrajectoryState=>({
  version:1,cycles:0,focusGoalId:null,focusDomain:'none',focusHorizon:'near',
  trajectoryCoherence01:.62,selfContinuity01:.68,socialContinuity01:.56,goalContinuity01:.61,
  futureAlignment01:.6,agencyReadiness01:.55,repairPressure01:.18,commitmentPressure01:.2,
  learningPressure01:.3,predictionError01:.18,counterfactualGap01:.2,lastForecast:null,
  forecasts:[],outcomes:[],lastReason:'initial',lastAt:0,
});

export interface TrajectoryContext {
  state:OrganismState;
  goals:OrganismGoal[];
  activeGoalId?:string|null;
  identity01:number;
  identityDrift01:number;
  social01:number;
  socialError01:number;
  goalPressure01:number;
  worldUncertainty01:number;
  predictionError01:number;
  novelty01:number;
  energy01:number;
  cognitiveLoad01:number;
  portfolioDomain?:Domain|'none';
  portfolioAllocation01?:number;
  portfolioCompetition01?:number;
  portfolioCoherence01?:number;
  curriculumPressure01?:number;
  transfer01?:number;
  autobiographicalCoherence01?:number;
  relationalCoherence01?:number;
  goalCoherence01?:number;
  worldlineStability01?:number;
  worldlineCommitmentDebt01?:number;
  worldlineIdentityPressure01?:number;
  worldlineSocialRepair01?:number;
  worldlineLearningPressure01?:number;
  worldlineCounterfactualGap01?:number;
  futureMismatch01?:number;
  futureIdentityCoherence01?:number;
  futureDevelopmentalBias01?:number;
  regret01?:number;
  evidence01?:number;
  resource01?:number;
  at?:number;
}

export interface TrajectoryDecision {
  action:ActionKind;
  score01:number;
  confidence01:number;
  selectedByTrajectory:boolean;
  projections:TrajectoryProjection[];
  forecast:TrajectoryForecast;
}

const horizonWeight=(h:Horizon)=>({immediate:.18,near:.28,long:.30,identity:.24}[h]);
const domainOf=(g?:OrganismGoal|null):Domain=>{
  if(!g)return 'world';
  const t=`${g.title} ${g.reason} ${g.source}`.toLowerCase();
  if(/social|person|friend|relationship|dialog|communicat|user/.test(t))return 'social';
  if(/research|science|evidence|unknown|verify/.test(t))return 'research';
  if(/skill|learn|practice|habit|train/.test(t))return 'skills';
  if(/body|energy|thermal|sensor|sleep|embod/.test(t))return 'embodiment';
  if(/self|identity|autonomy|development|reflect/.test(t))return 'self';
  return 'world';
};
const horizonFor=(g?:OrganismGoal|null):Horizon=>{
  if(!g)return 'near';
  const p=clamp((g.urgency*.45)+(g.importance*.35)+(1-g.progress)*.20);
  if(p>.82)return 'immediate';
  if(g.importance>.78&&g.urgency<.62)return 'long';
  if(g.importance>.82||/identity|self|life|future|relationship/.test(`${g.title} ${g.reason}`.toLowerCase()))return 'identity';
  return 'near';
};

export class IntegratedLifeTrajectoryEngine {
  private state=defaultIntegratedLifeTrajectory();

  restore(raw?:Partial<IntegratedLifeTrajectoryState>|null){
    const d=defaultIntegratedLifeTrajectory(),r:any=raw??{};
    const safeForecast=(x:any):TrajectoryForecast|null=>x&&typeof x==='object'?{
      action:x.action as ActionKind,score01:clamp(Number(x.score01)),horizonValues:{immediate:clamp(Number(x.horizonValues?.immediate??.5)),near:clamp(Number(x.horizonValues?.near??.5)),long:clamp(Number(x.horizonValues?.long??.5)),identity:clamp(Number(x.horizonValues?.identity??.5))},
      expectedContinuity01:clamp(Number(x.expectedContinuity01??.5)),expectedAgency01:clamp(Number(x.expectedAgency01??.5)),expectedSocial01:clamp(Number(x.expectedSocial01??.5)),expectedGoalCoherence01:clamp(Number(x.expectedGoalCoherence01??.5)),expectedLearning01:clamp(Number(x.expectedLearning01??.5)),expectedRepair01:clamp(Number(x.expectedRepair01??.2)),predictedRisk01:clamp(Number(x.predictedRisk01??.3)),confidence01:clamp(Number(x.confidence01??.4)),generatedAt:Number(x.generatedAt??0)
    }:null;
    this.state={...d,...r,version:1,focusDomain:['self','world','social','skills','research','embodiment','none'].includes(r.focusDomain)?r.focusDomain:'none',focusHorizon:['immediate','near','long','identity'].includes(r.focusHorizon)?r.focusHorizon:'near',lastForecast:safeForecast(r.lastForecast),forecasts:Array.isArray(r.forecasts)?r.forecasts.slice(0,96).map(safeForecast).filter(Boolean):[],outcomes:Array.isArray(r.outcomes)?r.outcomes.slice(0,128).map((x:any)=>({...x,error01:clamp(Number(x?.error01)),predicted01:clamp(Number(x?.predicted01)),actual01:clamp(Number(x?.actual01))})):[]};
  }

  snapshot(){return structuredClone(this.state);}

  beginCycle(at=Date.now()){
    this.state.cycles++;
    this.state.learningPressure01=clamp(this.state.learningPressure01*.995);
    this.state.repairPressure01=clamp(this.state.repairPressure01*.998);
    this.state.commitmentPressure01=clamp(this.state.commitmentPressure01*.997);
    this.state.lastAt=at;
  }

  assess(ctx:TrajectoryContext):TrajectoryDecision[] {
    const at=ctx.at??Date.now();
    const active=ctx.goals.find(g=>g.status==='active'&&g.id===ctx.activeGoalId)??ctx.goals.find(g=>g.status==='active');
    const focusGoalId=active?.id??null;
    const domain=ctx.portfolioDomain&&ctx.portfolioDomain!=='none'?ctx.portfolioDomain:domainOf(active);
    const horizon=horizonFor(active);
    this.state.focusGoalId=focusGoalId; this.state.focusDomain=domain; this.state.focusHorizon=horizon;
    this.state.selfContinuity01=clamp(ctx.autobiographicalCoherence01??ctx.identity01);
    this.state.socialContinuity01=clamp(ctx.relationalCoherence01??ctx.social01);
    this.state.goalContinuity01=clamp(ctx.goalCoherence01??(active?.progress??.5));
    this.state.futureAlignment01=clamp((ctx.futureIdentityCoherence01??.6)*.55+(1-(ctx.futureMismatch01??.25))*.45);
    this.state.repairPressure01=clamp((ctx.worldlineSocialRepair01??ctx.socialError01)*.32+(ctx.regret01??0)*.22+(ctx.worldlineCounterfactualGap01??ctx.predictionError01)*.18+(ctx.identityDrift01)*.12+(ctx.futureMismatch01??0)*.16);
    this.state.commitmentPressure01=clamp((ctx.worldlineCommitmentDebt01??ctx.goalPressure01)*.7+ctx.goalPressure01*.3);
    this.state.learningPressure01=clamp((ctx.worldlineLearningPressure01??ctx.curriculumPressure01??.3)*.55+ctx.predictionError01*.2+(1-(ctx.transfer01??.5))*.15+ctx.novelty01*.1);
    this.state.predictionError01=clamp(ctx.predictionError01);
    this.state.counterfactualGap01=clamp(ctx.worldlineCounterfactualGap01??ctx.futureMismatch01??.2);
    const actions:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
    this.state.agencyReadiness01=clamp(ctx.energy01*.28+(1-ctx.cognitiveLoad01)*.22+(1-ctx.socialError01)*.10+this.state.futureAlignment01*.16+(1-this.state.commitmentPressure01)*.10+this.state.goalContinuity01*.14);
    const decisions=actions.map(action=>this.project(ctx,action,active,domain,horizon,at));
    const max=Math.max(...decisions.map(x=>x.forecast.score01),0);
    const selected=decisions.filter(x=>x.forecast.score01>=max-.0001);
    if(selected[0]) this.state.lastForecast=selected[0].forecast;
    this.state.forecasts=[...decisions.map(x=>x.forecast),...this.state.forecasts].slice(0,96);
    this.state.trajectoryCoherence01=clamp(this.state.selfContinuity01*.24+this.state.socialContinuity01*.18+this.state.goalContinuity01*.22+this.state.futureAlignment01*.20+(1-this.state.predictionError01)*.10+(1-this.state.counterfactualGap01)*.06);
    this.state.lastReason=`focus=${domain}/${horizon}; trajectory=${this.state.trajectoryCoherence01.toFixed(2)}; repair=${this.state.repairPressure01.toFixed(2)}; learning=${this.state.learningPressure01.toFixed(2)}`;
    this.state.lastAt=at;
    return decisions.sort((a,b)=>b.score01-a.score01);
  }

  private project(ctx:TrajectoryContext,action:ActionKind,goal:OrganismGoal|undefined,domain:Domain,horizon:Horizon,at:number):TrajectoryDecision{
    const urgency=clamp(goal?.urgency??ctx.goalPressure01);
    const importance=clamp(goal?.importance??.45);
    const progress=clamp(goal?.progress??.35);
    const socialNeed=clamp(ctx.social01);
    const uncertainty=clamp(ctx.worldUncertainty01);
    const identity=clamp(ctx.identity01);
    const repair=this.state.repairPressure01;
    const commitment=this.state.commitmentPressure01;
    const learning=this.state.learningPressure01;
    const resource=clamp(ctx.resource01??(1-ctx.cognitiveLoad01));
    const evidence=clamp(ctx.evidence01??1-ctx.predictionError01);
    const actionFit=(a:ActionKind)=>{
      if(a==='respond')return domain==='social'? .94 : socialNeed*.55;
      if(a==='explore')return domain==='world'||domain==='skills'||domain==='research' ? .88 : ctx.novelty01*.65;
      if(a==='verify')return domain==='research'||domain==='world'? .94 : uncertainty*.72;
      if(a==='rest')return 1-resource+ctx.cognitiveLoad01*.7;
      if(a==='reflect')return domain==='self'? .93 : (identity*.5+ctx.identityDrift01*.5);
      if(a==='wait')return (1-urgency)*.55+(1-uncertainty)*.45;
      return repair*.55+commitment*.45;
    };
    const fit=clamp(actionFit(action));
    const immediate=clamp(.28*fit+.19*(1-repair)+.16*(1-commitment)+.14*resource+.13*(1-ctx.predictionError01)+.10*urgency);
    const near=clamp(.23*fit+.20*importance+.17*progress+.15*this.state.goalContinuity01+.12*this.state.learningPressure01+.08*this.state.futureAlignment01+.05*(1-this.state.counterfactualGap01));
    const long=clamp(.19*fit+.20*importance+.18*this.state.futureAlignment01+.15*this.state.selfContinuity01+.14*(ctx.transfer01??.5)+.08*this.state.goalContinuity01+.06*(1-repair));
    const identityValue=clamp(.18*fit+.28*identity+.18*this.state.selfContinuity01+.14*this.state.futureAlignment01+.10*(1-ctx.identityDrift01)+.07*(ctx.autobiographicalCoherence01??.6)+.05*(domain==='self'?1:.5));
    const continuity=clamp(this.state.selfContinuity01*.28+this.state.futureAlignment01*.22+this.state.goalContinuity01*.16+(1-repair)*.16+(1-ctx.identityDrift01)*.10+fit*.08);
    const goalFit=clamp(goal?goal.importance*.4+goal.urgency*.25+(1-goal.progress)*.15+fit*.2:fit*.65+(1-uncertainty)*.35);
    const socialFit=clamp(action==='respond'?ctx.social01*.55+(1-ctx.socialError01)*.45:this.state.socialContinuity01*.5+(1-repair)*.5);
    const identityFit=clamp(identityValue);
    const learningReturn=clamp(this.state.learningPressure01*.45+(ctx.predictionError01*.25)+ctx.novelty01*.1+(1-(ctx.transfer01??.5))*.2);
    const futureFit=clamp(this.state.futureAlignment01*.45+long*.3+identityValue*.25);
    const repairNeed=clamp(repair*(action==='defer'||action==='respond'||action==='reflect'?1:.72));
    const commitmentRelief=clamp(commitment*(action==='verify'||action==='respond'||action==='reflect'?1:.58));
    const resourceFit=clamp(action==='rest'?(1-resource)*.78+.22:resource);
    const uncertaintyPenalty=uncertainty*(action==='explore'?.12:action==='verify'?.02:action==='wait'?.04:.07);
    const risk=clamp(ctx.cognitiveLoad01*.20+ctx.socialError01*.12+ctx.identityDrift01*.15+this.state.counterfactualGap01*.18+(ctx.futureMismatch01??0)*.15+(1-resource)*.10);
    const score=clamp(immediate*horizonWeight('immediate')+near*horizonWeight('near')+long*horizonWeight('long')+identityValue*horizonWeight('identity')+goalFit*.10+learningReturn*.08+futureFit*.09+commitmentRelief*.04+resourceFit*.05-repairNeed*.04-uncertaintyPenalty);
    const confidence=clamp(.26+evidence*.22+(1-ctx.socialError01)*.10+(1-uncertainty)*.12+this.state.futureAlignment01*.12+this.state.trajectoryCoherence01*.10+(ctx.portfolioCoherence01??.5)*.08);
    const projection=(h:Horizon,v:number):TrajectoryProjection=>({action,horizon:h,value01:clamp(v),continuity01:continuity,goalFit01:goalFit,socialFit01:socialFit,identityFit01:identityFit,learningReturn01:learningReturn,futureFit01:futureFit,uncertainty01:uncertainty,repairNeed01:repairNeed,commitmentRelief01:commitmentRelief,resourceFit01:resourceFit,explanation:`${action}: ${h}; domain=${domain}; goal=${domainOf(goal)}; fit=${fit.toFixed(2)}; repair=${repair.toFixed(2)}; commitment=${commitment.toFixed(2)}`});
    const forecast:TrajectoryForecast={action,score01:score,horizonValues:{immediate,near,long,identity:identityValue},expectedContinuity01:continuity,expectedAgency01:this.state.agencyReadiness01,expectedSocial01:socialFit,expectedGoalCoherence01:goalFit,expectedLearning01:learningReturn,expectedRepair01:repairNeed,predictedRisk01:risk,confidence01:confidence,generatedAt:at};
    return {action,score01:score,confidence01:confidence,selectedByTrajectory:false,projections:[projection('immediate',immediate),projection('near',near),projection('long',long),projection('identity',identityValue)],forecast};
  }

  choose(actionScores:Map<ActionKind,number>,decisions:TrajectoryDecision[]):TrajectoryDecision|null{
    if(!decisions.length)return null;
    const best=[...decisions].sort((a,b)=>b.score01-a.score01)[0];
    const blended=decisions.map(d=>({d,s:clamp((actionScores.get(d.action)??0)*.82+d.score01*.18)})).sort((a,b)=>b.s-a.s)[0];
    if(blended){best.action=blended.d.action;best.score01=blended.s;best.selectedByTrajectory=true;}
    return best;
  }

  actionBias(action:ActionKind,decisions:TrajectoryDecision[]=[]){
    const row=decisions.find(d=>d.action===action); if(!row)return 0;
    const max=Math.max(...decisions.map(x=>x.score01),.5); const delta=row.score01-max;
    return clamp((delta+.08)*.05 + (row.forecast.expectedLearning01-.5)*.014 + (row.forecast.expectedContinuity01-.5)*.012);
  }

  recordOutcome(input:{action:ActionKind;actual01:number;verified01:number;surprise01:number;contextKey:string;at?:number}){
    const at=input.at??Date.now(); const prior=this.state.forecasts.find(f=>f.action===input.action)??this.state.lastForecast;
    if(!prior)return null;
    const error=clamp(Math.abs(prior.score01-clamp(input.actual01)));
    const row:TrajectoryOutcomeRecord={id:`trajectory-outcome-${at}-${Math.random().toString(16).slice(2)}`,action:input.action,predicted01:prior.score01,actual01:clamp(input.actual01),error01:error,verified01:clamp(input.verified01),surprise01:clamp(input.surprise01),contextKey:clean(input.contextKey),at};
    this.state.outcomes=[row,...this.state.outcomes].slice(0,128);
    this.state.predictionError01=clamp(this.state.predictionError01*.9+error*.1);
    this.state.counterfactualGap01=clamp(this.state.counterfactualGap01*.9+(error*.55+input.surprise01*.25+(1-input.verified01)*.2)*.1);
    this.state.futureAlignment01=clamp(this.state.futureAlignment01*.94+(1-error)*.06);
    this.state.trajectoryCoherence01=clamp(this.state.trajectoryCoherence01*.94+(1-error)*.04+input.verified01*.02);
    this.state.learningPressure01=clamp(this.state.learningPressure01*.94+error*.06);
    return structuredClone(row);
  }

  diagnostics(){
    const latest=this.state.outcomes[0];
    return {
      version:1, cycles:this.state.cycles, focusGoalId:this.state.focusGoalId, focusDomain:this.state.focusDomain,
      focusHorizon:this.state.focusHorizon, trajectoryCoherence01:this.state.trajectoryCoherence01, selfContinuity01:this.state.selfContinuity01,
      socialContinuity01:this.state.socialContinuity01, goalContinuity01:this.state.goalContinuity01, futureAlignment01:this.state.futureAlignment01,
      agencyReadiness01:this.state.agencyReadiness01, repairPressure01:this.state.repairPressure01, commitmentPressure01:this.state.commitmentPressure01,
      learningPressure01:this.state.learningPressure01, predictionError01:this.state.predictionError01, counterfactualGap01:this.state.counterfactualGap01,
      forecastCount:this.state.forecasts.length, outcomeCount:this.state.outcomes.length, lastOutcomeError01:latest?.error01??0,
      lastReason:clean(this.state.lastReason,240),
    };
  }
}
