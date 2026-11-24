import type { ActionKind, OrganismGoal, OrganismState } from '../core/types.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const mean=(xs:number[],fallback=.5)=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:fallback;
const clean=(x:unknown,n=120)=>String(x??'').trim().replace(/\s+/g,' ').slice(0,n);

export type ContinuityHorizon='immediate'|'near'|'long'|'identity';
export type ContinuityDomain='self'|'world'|'social'|'skills'|'research'|'embodiment';
export type ContinuityPhase='persistent-agency'|'counterfactual-planning'|'temporal-hierarchy'|'autonomous-life'|'self-model'|'autobiography'|'relationship-model'|'social-counterfactual'|'unified-learning'|'transfer'|'skill-development'|'meta-learning'|'global-workspace'|'metacognition'|'simulation'|'conflict-resolution'|'motivation'|'emotion-regulation'|'embodiment'|'value-development'|'personality-dynamics'|'goal-genesis'|'self-development'|'self-audit'|'recovery'|'world-model'|'active-perception'|'external-interaction'|'research-evaluation'|'longitudinal-evaluation'|'ablation'|'integration'|'stress'|'architecture-freeze'|'verification';

export interface ContinuityProjection {
  phase:ContinuityPhase;
  action:ActionKind;
  horizon:ContinuityHorizon;
  score01:number;
  evidence01:number;
  confidence01:number;
  uncertainty01:number;
  rationale:string;
}

export interface FuturePath {
  horizon:ContinuityHorizon;
  value01:number;
  risk01:number;
  coherence01:number;
  agency01:number;
  learning01:number;
  social01:number;
  identity01:number;
  counterfactualGap01:number;
}

export interface AgencyState {
  commitments:number;
  unfinishedIntentions:number;
  executionReliability01:number;
  resumptionReady01:number;
  intentionality01:number;
}

export interface SelfState {
  continuity01:number;
  uncertainty01:number;
  identityDrift01:number;
  autobiographicalCoherence01:number;
  selfModelConfidence01:number;
  metacognitiveAccuracy01:number;
}

export interface RelationalState {
  trust01:number;
  expectationFit01:number;
  unresolved01:number;
  repairNeed01:number;
  socialPrediction01:number;
  socialCounterfactual01:number;
}

export interface LearningState {
  predictionAccuracy01:number;
  causalLearning01:number;
  transfer01:number;
  retention01:number;
  exploration01:number;
  metaLearning01:number;
  skillConsolidation01:number;
}

export interface MotivationState {
  intrinsic01:number;
  curiosity01:number;
  goalPressure01:number;
  valueStability01:number;
  goalGenesisPressure01:number;
  regulation01:number;
}

export interface EmbodimentState {
  energy01:number;
  capacity01:number;
  thermalStrain01:number;
  sensoryFreshness01:number;
  resourceFit01:number;
  recovery01:number;
}

export interface ResearchState {
  evidence01:number;
  benchmarkCoverage01:number;
  ablationCoverage01:number;
  longitudinalCoverage01:number;
  integrationCoverage01:number;
  stressReady01:number;
}

export interface ContinuityOutcome {
  action:ActionKind;
  predicted01:number;
  actual01:number;
  surprise01:number;
  verified01:number;
  causal01:number;
  transfer01:number;
  identityImpact01:number;
  socialImpact01:number;
  learning01:number;
  at:number;
}

export interface CognitiveOrganismContinuityState {
  version:1;
  cycles:number;
  lastAt:number;
  phaseIndex:number;
  phaseProgress01:number;
  activePhase:ContinuityPhase;
  domains:Record<ContinuityDomain,number>;
  agency:AgencyState;
  self:SelfState;
  relational:RelationalState;
  learning:LearningState;
  motivation:MotivationState;
  embodiment:EmbodimentState;
  research:ResearchState;
  futurePaths:FuturePath[];
  projections:ContinuityProjection[];
  outcomes:ContinuityOutcome[];
  unresolvedConflicts:number;
  worldModelUncertainty01:number;
  activePerceptionNeed01:number;
  interactionReadiness01:number;
  workspaceBroadcast01:number;
  simulationReadiness01:number;
  autonomousLife01:number;
  integratedCoherence01:number;
  longitudinalScore01:number;
  selfAuditScore01:number;
  recoveryReadiness01:number;
  architectureHealth01:number;
  verificationScore01:number;
  lastAblation?:Record<string,number>;
  lastReason:string;
}

export interface CognitiveOrganismContext {
  state:OrganismState;
  goals:OrganismGoal[];
  activeGoalId?:string|null;
  identity01:number;
  identityDrift01:number;
  autobiographicalCoherence01:number;
  relationalCoherence01:number;
  goalCoherence01:number;
  social01:number;
  socialError01:number;
  goalPressure01:number;
  novelty01:number;
  uncertainty01:number;
  predictionError01:number;
  selfPredictionError01:number;
  energy01:number;
  cognitiveCapacity01:number;
  thermalStrain01:number;
  sensoryFreshness01:number;
  curriculumPressure01:number;
  transfer01:number;
  retention01:number;
  futureMismatch01:number;
  futureIdentityCoherence01:number;
  regret01:number;
  counterfactualGap01:number;
  evidence01:number;
  portfolioCoherence01:number;
  resource01:number;
  worldEntityCount?:number;
  socialPersonCount?:number;
  unfinishedIntentions?:number;
  commitments?:number;
  at?:number;
}

const phases:ContinuityPhase[]=[
  'persistent-agency','counterfactual-planning','temporal-hierarchy','autonomous-life','self-model','autobiography','relationship-model','social-counterfactual',
  'unified-learning','transfer','skill-development','meta-learning','global-workspace','metacognition','simulation','conflict-resolution','motivation','emotion-regulation',
  'embodiment','value-development','personality-dynamics','goal-genesis','self-development','self-audit','recovery','world-model','active-perception','external-interaction',
  'research-evaluation','longitudinal-evaluation','ablation','integration','stress','architecture-freeze','verification'
];
const actions:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const horizonWeight=(h:ContinuityHorizon)=>({immediate:.17,near:.26,long:.31,identity:.26}[h]);
const horizonFor=(goal?:OrganismGoal):ContinuityHorizon=>{
  if(!goal)return 'near';
  if(goal.urgency>.82)return 'immediate';
  if(goal.importance>.84 && goal.urgency<.62)return 'long';
  if(/identity|self|life|future|relationship/i.test(`${goal.title} ${goal.reason}`))return 'identity';
  return 'near';
};
const domainFor=(goal?:OrganismGoal):ContinuityDomain=>{
  if(!goal)return 'world';
  const t=`${goal.title} ${goal.reason}`.toLowerCase();
  if(/social|person|friend|relationship|dialog|user/.test(t))return 'social';
  if(/research|science|evidence|unknown|verify/.test(t))return 'research';
  if(/skill|learn|practice|train|habit/.test(t))return 'skills';
  if(/body|energy|thermal|sensor|sleep|embod/.test(t))return 'embodiment';
  if(/self|identity|autonomy|development/.test(t))return 'self';
  return 'world';
};

export const defaultCognitiveOrganismContinuity=():CognitiveOrganismContinuityState=>({
  version:1,cycles:0,lastAt:0,phaseIndex:0,phaseProgress01:0,activePhase:phases[0],
  domains:{self:.66,world:.58,social:.54,skills:.48,research:.52,embodiment:.63},
  agency:{commitments:0,unfinishedIntentions:0,executionReliability01:.56,resumptionReady01:.72,intentionality01:.52},
  self:{continuity01:.68,uncertainty01:.25,identityDrift01:.18,autobiographicalCoherence01:.62,selfModelConfidence01:.48,metacognitiveAccuracy01:.45},
  relational:{trust01:.5,expectationFit01:.52,unresolved01:.18,repairNeed01:.18,socialPrediction01:.45,socialCounterfactual01:.42},
  learning:{predictionAccuracy01:.55,causalLearning01:.42,transfer01:.38,retention01:.52,exploration01:.5,metaLearning01:.3,skillConsolidation01:.35},
  motivation:{intrinsic01:.55,curiosity01:.5,goalPressure01:.3,valueStability01:.5,goalGenesisPressure01:.28,regulation01:.56},
  embodiment:{energy01:.72,capacity01:.7,thermalStrain01:.1,sensoryFreshness01:.6,resourceFit01:.67,recovery01:.65},
  research:{evidence01:.45,benchmarkCoverage01:0,ablationCoverage01:0,longitudinalCoverage01:0,integrationCoverage01:0,stressReady01:0},
  futurePaths:[],projections:[],outcomes:[],unresolvedConflicts:0,worldModelUncertainty01:.3,activePerceptionNeed01:.28,interactionReadiness01:.48,workspaceBroadcast01:.4,simulationReadiness01:.44,autonomousLife01:.35,integratedCoherence01:.49,longitudinalScore01:0,selfAuditScore01:.45,recoveryReadiness01:.65,architectureHealth01:.58,verificationScore01:.3,lastReason:'initial'
});

export class CognitiveOrganismContinuityEngine {
  private state=defaultCognitiveOrganismContinuity();

  restore(raw?:Partial<CognitiveOrganismContinuityState>|null){
    const d=defaultCognitiveOrganismContinuity(),r:any=raw??{};
    const clampRecord=(obj:any,keys:string[],fallback:any={})=>Object.fromEntries(keys.map(k=>[k,clamp(Number(obj?.[k]??fallback[k]??.5))]));
    this.state={...d,...r,version:1,
      phaseIndex:Math.max(0,Math.min(phases.length-1,Math.floor(Number(r.phaseIndex??0)))),
      activePhase:phases.includes(r.activePhase)?r.activePhase:phases[Math.max(0,Math.min(phases.length-1,Math.floor(Number(r.phaseIndex??0))))],
      domains:{...d.domains,...clampRecord(r.domains,Object.keys(d.domains),d.domains)},
      agency:{...d.agency,...r.agency,commitments:Math.max(0,Math.floor(Number(r.agency?.commitments??0))),unfinishedIntentions:Math.max(0,Math.floor(Number(r.agency?.unfinishedIntentions??0)))},
      self:{...d.self,...r.self},relational:{...d.relational,...r.relational},learning:{...d.learning,...r.learning},motivation:{...d.motivation,...r.motivation},embodiment:{...d.embodiment,...r.embodiment},research:{...d.research,...r.research},
      futurePaths:Array.isArray(r.futurePaths)?r.futurePaths.slice(-12):[], projections:Array.isArray(r.projections)?r.projections.slice(-64):[], outcomes:Array.isArray(r.outcomes)?r.outcomes.slice(-128):[], lastAblation:r.lastAblation&&typeof r.lastAblation==='object'?r.lastAblation:undefined
    };
  }

  snapshot(){return structuredClone(this.state);}

  beginCycle(at=Date.now()){
    this.state.cycles++;
    this.state.phaseProgress01=clamp(this.state.phaseProgress01+.035);
    if(this.state.phaseProgress01>=1){this.state.phaseProgress01=0;this.state.phaseIndex=(this.state.phaseIndex+1)%phases.length;this.state.activePhase=phases[this.state.phaseIndex];}
    this.state.agency.unfinishedIntentions=Math.max(0,this.state.agency.unfinishedIntentions);
    this.state.recoveryReadiness01=clamp(this.state.recoveryReadiness01*.997+.002);
    this.state.autonomousLife01=clamp(this.state.autonomousLife01*.998+.001);
    this.state.lastAt=at;
  }

  integrate(ctx:CognitiveOrganismContext){
    const at=ctx.at??Date.now();
    const active=ctx.goals.find(g=>g.status==='active'&&g.id===ctx.activeGoalId)??ctx.goals.find(g=>g.status==='active');
    const horizon=horizonFor(active),domain=domainFor(active);
    this.state.domains[domain]=clamp(this.state.domains[domain]*.9+this.domainSignal(ctx,domain)*.1);
    this.state.self={continuity01:clamp(ctx.autobiographicalCoherence01*.6+ctx.identity01*.4),uncertainty01:clamp(ctx.uncertainty01*.7+ctx.selfPredictionError01*.3),identityDrift01:clamp(ctx.identityDrift01),autobiographicalCoherence01:clamp(ctx.autobiographicalCoherence01),selfModelConfidence01:clamp(1-(ctx.selfPredictionError01*.65+ctx.uncertainty01*.35)),metacognitiveAccuracy01:clamp(1-ctx.selfPredictionError01)};
    this.state.relational={trust01:clamp(ctx.relationalCoherence01*.7+ctx.social01*.3),expectationFit01:clamp(1-ctx.socialError01),unresolved01:clamp(ctx.socialError01*.65+ctx.counterfactualGap01*.2),repairNeed01:clamp(ctx.socialError01*.62+ctx.regret01*.18),socialPrediction01:clamp(1-ctx.socialError01),socialCounterfactual01:clamp(1-ctx.counterfactualGap01)};
    this.state.learning={predictionAccuracy01:clamp(1-ctx.predictionError01),causalLearning01:clamp(.42+ctx.transfer01*.28+ctx.evidence01*.18),transfer01:clamp(ctx.transfer01),retention01:clamp(ctx.retention01),exploration01:clamp(ctx.novelty01),metaLearning01:clamp(ctx.curriculumPressure01*.55+ctx.transfer01*.25+(1-ctx.predictionError01)*.2),skillConsolidation01:clamp(ctx.retention01*.6+ctx.transfer01*.4)};
    this.state.motivation={intrinsic01:clamp(ctx.novelty01*.35+ctx.goalPressure01*.35+ctx.autobiographicalCoherence01*.3),curiosity01:clamp(ctx.novelty01*.65+ctx.uncertainty01*.35),goalPressure01:clamp(ctx.goalPressure01),valueStability01:clamp(1-ctx.identityDrift01*.6-ctx.predictionError01*.2),goalGenesisPressure01:clamp(ctx.novelty01*.35+ctx.uncertainty01*.25+ctx.curriculumPressure01*.4),regulation01:clamp(ctx.energy01*.4+ctx.cognitiveCapacity01*.35+(1-ctx.thermalStrain01)*.25)};
    this.state.embodiment={energy01:clamp(ctx.energy01),capacity01:clamp(ctx.cognitiveCapacity01),thermalStrain01:clamp(ctx.thermalStrain01),sensoryFreshness01:clamp(ctx.sensoryFreshness01),resourceFit01:clamp(ctx.resource01),recovery01:clamp(ctx.energy01*.55+(1-ctx.thermalStrain01)*.45)};
    this.state.agency.commitments=Math.max(0,Math.floor(Number(ctx.commitments??this.state.agency.commitments)));
    this.state.agency.unfinishedIntentions=Math.max(0,Math.floor(Number(ctx.unfinishedIntentions??this.state.agency.unfinishedIntentions)));
    this.state.agency.resumptionReady01=clamp(.55+this.state.agency.executionReliability01*.25+this.state.embodiment.recovery01*.2);
    this.state.agency.intentionality01=clamp(.28+this.state.agency.commitments*.012+ctx.goalPressure01*.28+(1-ctx.predictionError01)*.22+this.state.self.continuity01*.18);
    this.state.worldModelUncertainty01=clamp(ctx.uncertainty01);
    this.state.activePerceptionNeed01=clamp(ctx.uncertainty01*.58+ctx.predictionError01*.24+ctx.novelty01*.18);
    this.state.interactionReadiness01=clamp(ctx.social01*.35+(1-ctx.socialError01)*.25+ctx.energy01*.2+this.state.relational.trust01*.2);
    this.state.workspaceBroadcast01=clamp((1-ctx.cognitiveCapacity01)*.05+this.state.self.continuity01*.2+(1-ctx.predictionError01)*.2+this.state.interactionReadiness01*.2+this.state.learning.metaLearning01*.2+.15);
    this.state.simulationReadiness01=clamp(ctx.counterfactualGap01*.55+ctx.futureMismatch01*.25+this.state.learning.predictionAccuracy01*.2);
    this.state.unresolvedConflicts=ctx.socialError01>0.65?Math.max(1,Math.floor(this.state.unresolvedConflicts*.95)+1):Math.max(0,Math.floor(this.state.unresolvedConflicts*.97));
    const projections=actions.flatMap(action=>this.projectAll(action,ctx,active,horizon,domain));
    this.state.projections=[...projections,...this.state.projections].slice(0,64);
    const futurePaths=[...(['immediate','near','long','identity'] as ContinuityHorizon[]).map(h=>this.futurePath(h,ctx,active)),...this.state.futurePaths].slice(0,12);
    this.state.futurePaths=futurePaths;
    this.state.integratedCoherence01=clamp(mean([this.state.self.continuity01,this.state.relational.trust01,1-this.state.worldModelUncertainty01,this.state.learning.predictionAccuracy01,this.state.motivation.regulation01,this.state.embodiment.resourceFit01,this.state.agency.intentionality01]));
    this.state.autonomousLife01=clamp(this.state.autonomousLife01*.7+this.state.agency.intentionality01*.1+this.state.learning.metaLearning01*.08+this.state.self.continuity01*.06+this.state.motivation.goalGenesisPressure01*.06);
    this.state.research.benchmarkCoverage01=clamp(this.state.research.benchmarkCoverage01*.94+(this.state.cycles>0?.06:0));
    this.state.research.longitudinalCoverage01=clamp(this.state.research.longitudinalCoverage01*.97+Math.min(.12,this.state.cycles/2400));
    this.state.research.integrationCoverage01=clamp(this.state.research.integrationCoverage01*.94+this.state.integratedCoherence01*.06);
    this.state.research.stressReady01=clamp(this.state.research.stressReady01*.95+(this.state.embodiment.resourceFit01>.4 && this.state.recoveryReadiness01>.5 ? .05 : 0));
    if(this.state.cycles%8===0)this.selfAudit();
    this.state.lastReason=`phase=${this.state.activePhase}; focus=${domain}/${horizon}; coherence=${this.state.integratedCoherence01?.toFixed?.(2)??this.state.integratedCoherence01}; agency=${this.state.agency.intentionality01.toFixed(2)}; simulation=${this.state.simulationReadiness01.toFixed(2)}`;
    this.state.lastAt=at;
    return projections;
  }

  private domainSignal(ctx:CognitiveOrganismContext,d:ContinuityDomain){
    if(d==='self')return .5*ctx.identity01+.3*ctx.autobiographicalCoherence01+.2*(1-ctx.identityDrift01);
    if(d==='social')return .45*ctx.social01+.3*(1-ctx.socialError01)+.25*ctx.relationalCoherence01;
    if(d==='skills')return .45*ctx.transfer01+.35*ctx.retention01+.2*ctx.curriculumPressure01;
    if(d==='research')return .45*ctx.evidence01+.35*ctx.uncertainty01+.2*ctx.predictionError01;
    if(d==='embodiment')return .45*ctx.resource01+.35*ctx.energy01+.2*ctx.sensoryFreshness01;
    return .55*(1-ctx.uncertainty01)+.25*(1-ctx.predictionError01)+.2*ctx.evidence01;
  }

  private projectAll(action:ActionKind,ctx:CognitiveOrganismContext,goal:OrganismGoal|undefined,horizon:ContinuityHorizon,domain:ContinuityDomain):ContinuityProjection[]{
    const phasesToUse:ContinuityPhase[]=this.state.activePhase==='verification'?['verification','research-evaluation','self-audit']:[this.state.activePhase,'integration'];
    return phasesToUse.map(phase=>{
      const repair=(ctx.socialError01*.18+ctx.regret01*.12+ctx.counterfactualGap01*.14+ctx.futureMismatch01*.1);
      const goalFit=goal?clamp(goal.importance*.45+goal.urgency*.25+goal.progress*.15+(1-goal.progress)*.15):clamp(ctx.goalPressure01);
      const actionFit=this.actionFit(action,ctx,goal,domain);
      const horizonFit=clamp(horizonWeight(horizon)*1.7+this.state.futurePaths.filter(x=>x.horizon===horizon).reduce((s,x)=>s+x.coherence01*.1,0));
      const evidence=clamp(ctx.evidence01*.5+(1-ctx.predictionError01)*.3+ctx.portfolioCoherence01*.2);
      const score=clamp(actionFit*.34+goalFit*.16+horizonFit*.1+this.state.self.continuity01*.1+this.state.relational.trust01*.08+this.state.learning.metaLearning01*.08+(1-repair)*.08+evidence*.06);
      return {phase,action,horizon,score01:score,evidence01:evidence,confidence01:clamp((1-ctx.predictionError01)*.55+evidence*.25+ctx.portfolioCoherence01*.2),uncertainty01:clamp(ctx.uncertainty01),rationale:clean(`${phase}: actionFit=${actionFit.toFixed(2)} goalFit=${goalFit.toFixed(2)} evidence=${evidence.toFixed(2)} repair=${repair.toFixed(2)}`)};
    });
  }

  private actionFit(action:ActionKind,ctx:CognitiveOrganismContext,goal:OrganismGoal|undefined,domain:ContinuityDomain){
    let s=.5;
    if(action==='respond')s=.25+ctx.social01*.25+this.state.relational.repairNeed01*.25+(domain==='social'?.15:0);
    if(action==='explore')s=.2+ctx.novelty01*.28+ctx.uncertainty01*.2+ctx.resource01*.15+ctx.evidence01*.17;
    if(action==='verify')s=.2+ctx.predictionError01*.28+ctx.uncertainty01*.25+ctx.evidence01*.27+.08;
    if(action==='rest')s=.25+(1-ctx.energy01)*.4+ctx.thermalStrain01*.22+(1-ctx.cognitiveCapacity01)*.13;
    if(action==='reflect')s=.22+ctx.regret01*.2+ctx.identityDrift01*.2+ctx.futureMismatch01*.18+ctx.curriculumPressure01*.2;
    if(action==='wait')s=.25+(1-ctx.goalPressure01)*.25+ctx.uncertainty01*.25+(1-ctx.resource01)*.15;
    if(action==='defer')s=.2+(ctx.cognitiveCapacity01<.3?.55:.2);
    if(goal)s+=goal.importance*.08+goal.urgency*.05;
    return clamp(s);
  }

  private futurePath(horizon:ContinuityHorizon,ctx:CognitiveOrganismContext,goal?:OrganismGoal):FuturePath{
    const temporal=({immediate:1,near:.94,long:.86,identity:.8}[horizon]);
    const risk=clamp(ctx.predictionError01*.28+ctx.uncertainty01*.24+ctx.regret01*.15+ctx.counterfactualGap01*.18+ctx.futureMismatch01*.15);
    const identity=clamp(ctx.futureIdentityCoherence01*.55+ctx.autobiographicalCoherence01*.3+ctx.identity01*.15);
    const value=clamp(temporal*.16+(goal?.importance??.5)*.16+identity*.18+this.state.relational.trust01*.12+ctx.goalCoherence01*.14+ctx.transfer01*.08+(1-risk)*.16);
    return {horizon,value01:value,risk01:risk,coherence01:clamp(1-risk*.6+identity*.4),agency01:clamp(this.state.agency.intentionality01*.65+(1-risk)*.35),learning01:clamp(ctx.curriculumPressure01*.45+ctx.transfer01*.35+ctx.retention01*.2),social01:this.state.relational.trust01,identity01:identity,counterfactualGap01:clamp(ctx.counterfactualGap01+ctx.futureMismatch01*.4)};
  }

  actionBias(action:ActionKind){
    if(!this.state.projections.length)return 0;
    const ps=this.state.projections.filter(p=>p.action===action);
    return clamp(mean(ps.map(p=>p.score01),.5)-.5)*.075;
  }

  recordOutcome(outcome:ContinuityOutcome){
    const error=Math.abs(clamp(outcome.predicted01)-clamp(outcome.actual01));
    this.state.outcomes=[{...outcome,predicted01:clamp(outcome.predicted01),actual01:clamp(outcome.actual01),surprise01:clamp(outcome.surprise01),verified01:clamp(outcome.verified01),causal01:clamp(outcome.causal01),transfer01:clamp(outcome.transfer01),identityImpact01:clamp(outcome.identityImpact01),socialImpact01:clamp(outcome.socialImpact01),learning01:clamp(outcome.learning01),at:Number(outcome.at)},...this.state.outcomes].slice(0,128);
    this.state.learning.predictionAccuracy01=clamp(this.state.learning.predictionAccuracy01*.92+(1-error)*.08);
    this.state.learning.causalLearning01=clamp(this.state.learning.causalLearning01*.92+outcome.causal01*.08);
    this.state.learning.transfer01=clamp(this.state.learning.transfer01*.92+outcome.transfer01*.08);
    this.state.self.metacognitiveAccuracy01=clamp(this.state.self.metacognitiveAccuracy01*.93+(1-error)*.07);
    this.state.relational.socialPrediction01=clamp(this.state.relational.socialPrediction01*.93+(1-Math.abs(outcome.socialImpact01-(this.state.relational.trust01)))*.07);
    this.state.relational.repairNeed01=clamp(this.state.relational.repairNeed01*.94+(1-outcome.actual01)*.06);
    this.state.agency.executionReliability01=clamp(this.state.agency.executionReliability01*.94+outcome.actual01*.06);
    this.state.selfAuditScore01=clamp(this.state.selfAuditScore01*.95+(1-error)*.05);
    this.state.verificationScore01=clamp(this.state.verificationScore01*.94+outcome.verified01*.06);
    this.state.longitudinalScore01=clamp(this.state.longitudinalScore01*.97+(1-error)*.03);
    return {error01:error,updated:true};
  }

  /** Controlled research interface: estimates sensitivity without mutating organism state. */
  ablate(component:string){
    const base=this.state.integratedCoherence01;
    const effects:Record<string,number>={
      'self-model':this.state.self.continuity01*.16,
      'world-model':(1-this.state.worldModelUncertainty01)*.15,
      'memory':this.state.self.autobiographicalCoherence01*.14,
      'social':this.state.relational.trust01*.12,
      'prediction':this.state.learning.predictionAccuracy01*.15,
      'counterfactual':(1-this.state.futurePaths.reduce((s,x)=>s+x.counterfactualGap01,0)/Math.max(1,this.state.futurePaths.length))*.1,
      'agency':this.state.agency.intentionality01*.16,
      'workspace':this.state.workspaceBroadcast01*.1,
      'metacognition':this.state.self.metacognitiveAccuracy01*.11,
      'embodiment':this.state.embodiment.resourceFit01*.08,
    };
    const effect=clamp(effects[component]??.04),without=clamp(base-effect);
    this.state.lastAblation={component:without,delta:effect,base};
    return {component,base01:base,ablated01:without,delta01:effect,interpretation:effect>.1?'material-sensitivity':'weak-sensitivity'};
  }

  benchmark(){
    const outcomeQuality=this.state.outcomes.length?mean(this.state.outcomes.map(o=>1-Math.abs(o.actual01-o.predicted01))):0;
    const scores={
      persistentAgency:clamp(this.state.agency.intentionality01*.55+this.state.agency.executionReliability01*.45),
      selfContinuity:clamp(this.state.self.continuity01*.5+this.state.self.autobiographicalCoherence01*.3+this.state.self.metacognitiveAccuracy01*.2),
      relationalCognition:clamp(this.state.relational.trust01*.35+this.state.relational.socialPrediction01*.35+this.state.relational.socialCounterfactual01*.3),
      predictiveLearning:clamp(this.state.learning.predictionAccuracy01*.4+this.state.learning.causalLearning01*.25+this.state.learning.transfer01*.2+outcomeQuality*.15),
      motivation:clamp(this.state.motivation.intrinsic01*.3+this.state.motivation.curiosity01*.25+this.state.motivation.valueStability01*.25+this.state.motivation.regulation01*.2),
      embodiment:clamp(this.state.embodiment.resourceFit01*.35+this.state.embodiment.recovery01*.25+this.state.embodiment.sensoryFreshness01*.2+(1-this.state.embodiment.thermalStrain01)*.2),
      research:clamp(this.state.research.benchmarkCoverage01*.25+this.state.research.longitudinalCoverage01*.2+this.state.research.ablationCoverage01*.2+this.state.research.integrationCoverage01*.2+this.state.research.stressReady01*.15),
      integration:this.state.integratedCoherence01,
      verification:this.state.verificationScore01
    };
    return {scores,overall01:clamp(mean(Object.values(scores))),coverage01:clamp(phases.length>0?(this.state.phaseIndex+this.state.phaseProgress01)/phases.length:0),phase:this.state.activePhase};
  }

  selfAudit(){
    const issues:string[]=[];
    if(this.state.self.metacognitiveAccuracy01<.35)issues.push('metacognitive-calibration');
    if(this.state.learning.predictionAccuracy01<.4)issues.push('prediction');
    if(this.state.relational.repairNeed01>.65)issues.push('social-repair');
    if(this.state.embodiment.resourceFit01<.35)issues.push('resource-friction');
    if(this.state.agency.executionReliability01<.4)issues.push('agency-reliability');
    this.state.selfAuditScore01=clamp(1-issues.length*.12);
    this.state.architectureHealth01=clamp(.55+this.state.selfAuditScore01*.2+this.state.integratedCoherence01*.25);
    return {ok:issues.length===0,issues,score01:this.state.selfAuditScore01,architectureHealth01:this.state.architectureHealth01};
  }

  markResearchCoverage(metrics:Partial<ResearchState>){this.state.research={...this.state.research,...Object.fromEntries(Object.entries(metrics).map(([k,v])=>[k,clamp(Number(v))]))};}

  diagnostics(){
    const b=this.benchmark();
    return {version:1,cycles:this.state.cycles,phase:this.state.activePhase,phaseProgress01:this.state.phaseProgress01,coherence01:this.state.integratedCoherence01,agencyReadiness01:this.state.agency.intentionality01,autonomousLife01:this.state.autonomousLife01,worldUncertainty01:this.state.worldModelUncertainty01,activePerceptionNeed01:this.state.activePerceptionNeed01,simulationReadiness01:this.state.simulationReadiness01,selfContinuity01:this.state.self.continuity01,relational01:this.state.relational.trust01,learning01:this.state.learning.predictionAccuracy01,researchCoverage01:b.scores.research,verification01:this.state.verificationScore01,architectureHealth01:this.state.architectureHealth01,longitudinal01:this.state.longitudinalScore01,benchmark:b};
  }
}
