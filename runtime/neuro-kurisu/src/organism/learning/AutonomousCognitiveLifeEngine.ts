import { randomUUID } from 'node:crypto';
import type { ActionKind, OrganismGoal, OrganismState } from '../core/types.ts';
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const mean=(xs:number[],fallback=.5)=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:fallback;
const now=()=>Date.now();

export type LifeHorizon='immediate'|'near'|'long'|'identity';
export type PerceptionMode='verify'|'explore'|'social-check'|'self-check'|'world-check'|'rest';
export type ResearchStatus='proposed'|'running'|'completed'|'aborted';
export type CausalRole='cause'|'correlate'|'uncertain';

export interface AgencyCommitment { id:string; goalId:string|null; action:ActionKind; createdAt:number; dueAt:number; reliability01:number; status:'open'|'fulfilled'|'dropped'|'repair'; }
export interface IntentState { id:string; goalId:string|null; action:ActionKind; priority01:number; persistence01:number; expectedValue01:number; status:'active'|'paused'|'completed'|'invalidated'; createdAt:number; lastAt:number; }
export interface PlanBranch { action:ActionKind; horizon:LifeHorizon; expected01:number; risk01:number; learning01:number; social01:number; identity01:number; evidence01:number; informationValue01:number; feasible01:number; }
export interface PredictionRecord { id:string; action:ActionKind; contextKey:string; predicted01:number; confidence01:number; actual01?:number; error01?:number; causalRole?:CausalRole; verified01?:number; at:number; }
export interface PerceptionCandidate { id:string; mode:PerceptionMode; uncertainty01:number; expectedInformationGain01:number; actionability01:number; novelty01:number; cost01:number; socialRelevance01:number; selfRelevance01:number; selected01:number; rationale:string; }
export interface PersonalityDynamics { curiosity01:number; persistence01:number; caution01:number; sociability01:number; reflection01:number; autonomy01:number; adaptability01:number; coherence01:number; evidenceCount:number; drift01:number; }
export interface ValueDynamics { stability01:number; preferenceConsistency01:number; valueEvidence01:number; revisionPressure01:number; unresolvedValueConflicts:number; }
export interface EmbodiedDynamics { energy01:number; cognitiveCapacity01:number; thermalStrain01:number; sensoryFreshness01:number; recoveryDebt01:number; overload01:number; }
export interface LongitudinalPoint { cycle:number; overall01:number; autonomy01:number; self01:number; social01:number; learning01:number; planning01:number; embodied01:number; verified01:number; at:number; }
export interface ResearchTrial { id:string; hypothesis:string; component:string; control01:number; treatment01:number; delta01:number; confidence01:number; status:ResearchStatus; at:number; }
export interface AutonomousCognitiveLifeState {
  version:1;
  cycles:number;
  lastAt:number;
  autonomousTicks:number;
  activeIntentions:IntentState[];
  commitments:AgencyCommitment[];
  plans:PlanBranch[];
  predictions:PredictionRecord[];
  perceptionQueue:PerceptionCandidate[];
  personality:PersonalityDynamics;
  values:ValueDynamics;
  embodiment:EmbodiedDynamics;
  longitudinal:LongitudinalPoint[];
  researchTrials:ResearchTrial[];
  metrics:{ autonomy01:number; closedLoop01:number; planning01:number; activePerception01:number; causalLearning01:number; transfer01:number; metacognition01:number; socialModel01:number; selfModel01:number; persistence01:number; recovery01:number; embodiedAgency01:number; personalityStability01:number; researchRigor01:number; interactionReadiness01:number; };
  lastAction?:ActionKind;
  lastPredictionError01:number;
  lastInformationGain01:number;
  lastCausalAttribution01:number;
  lastReason:string;
}

export interface AutonomousCognitiveLifeContext {
  state:OrganismState;
  goals:OrganismGoal[];
  activeGoalId?:string|null;
  self01:number;
  identityDrift01:number;
  autobiographical01:number;
  relational01:number;
  social01:number;
  socialError01:number;
  goalPressure01:number;
  uncertainty01:number;
  predictionError01:number;
  selfPredictionError01:number;
  novelty01:number;
  energy01:number;
  capacity01:number;
  thermal01:number;
  sensoryFreshness01:number;
  transfer01:number;
  retention01:number;
  curriculumPressure01:number;
  futureMismatch01:number;
  futureIdentityCoherence01:number;
  regret01:number;
  counterfactualGap01:number;
  evidence01:number;
  resource01:number;
  commitmentCount?:number;
  unfinishedIntentions?:number;
  socialPeople?:number;
  worldEntities?:number;
  contextKey?:string;
  at?:number;
}

export interface ActionEvaluation {
  action:ActionKind;
  branches:PlanBranch[];
  score01:number;
  expectedInformationGain01:number;
  risk01:number;
  confidence01:number;
  rationale:string;
}

const actions:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const horizons:LifeHorizon[]=['immediate','near','long','identity'];

export const defaultAutonomousCognitiveLife=():AutonomousCognitiveLifeState=>({
  version:1,cycles:0,lastAt:0,autonomousTicks:0,activeIntentions:[],commitments:[],plans:[],predictions:[],perceptionQueue:[],
  personality:{curiosity01:.5,persistence01:.52,caution01:.48,sociability01:.5,reflection01:.48,autonomy01:.5,adaptability01:.5,coherence01:.56,evidenceCount:0,drift01:.12},
  values:{stability01:.54,preferenceConsistency01:.5,valueEvidence01:0,revisionPressure01:.2,unresolvedValueConflicts:0},
  embodiment:{energy01:.72,cognitiveCapacity01:.7,thermalStrain01:.12,sensoryFreshness01:.6,recoveryDebt01:.1,overload01:.08},
  longitudinal:[],researchTrials:[],metrics:{autonomy01:.36,closedLoop01:.3,planning01:.34,activePerception01:.28,causalLearning01:.32,transfer01:.3,metacognition01:.35,socialModel01:.35,selfModel01:.42,persistence01:.38,recovery01:.62,embodiedAgency01:.4,personalityStability01:.55,researchRigor01:.1,interactionReadiness01:.45},
  lastPredictionError01:.18,lastInformationGain01:0,lastCausalAttribution01:.3,lastReason:'initial'
});

export class AutonomousCognitiveLifeEngine {
  private state=defaultAutonomousCognitiveLife();
  restore(raw?:Partial<AutonomousCognitiveLifeState>|null){
    const d=defaultAutonomousCognitiveLife();
    let detached:unknown;
    try{
      detached=snapshotPlainData<unknown>(raw??{}, {maxDepth:16,maxNodes:16384,maxStringUnits:512*1024});
    }catch{
      this.state=d;return;
    }
    if(!detached||typeof detached!=='object'||Array.isArray(detached)){
      this.state=d;return;
    }
    const r=detached as Record<string,unknown>;
    if(r.version!==undefined&&r.version!==1){this.state=d;return;}
    const merge=(base:Record<string,unknown>,value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?{...base,...value as Record<string,unknown>}:base;
    const boundedRows=(value:unknown,limit:number)=>Array.isArray(value)?value.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)).slice(-limit):[];
    const count=(value:unknown,fallback=0)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:fallback;
    const timestamp=(value:unknown,fallback=0)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:fallback;
    const metric=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1?value:fallback;
    const personality=merge(d.personality as unknown as Record<string,unknown>,r.personality);
    const values=merge(d.values as unknown as Record<string,unknown>,r.values);
    const embodiment=merge(d.embodiment as unknown as Record<string,unknown>,r.embodiment);
    const metrics=merge(d.metrics as unknown as Record<string,unknown>,r.metrics);
    for(const key of Object.keys(d.personality) as Array<keyof PersonalityDynamics>){
      const fallback=d.personality[key];
      (personality as any)[key]=key==='evidenceCount'?count(personality[key],fallback as number):metric(personality[key],fallback as number);
    }
    for(const key of Object.keys(d.values) as Array<keyof ValueDynamics>){
      const fallback=d.values[key];
      (values as any)[key]=key==='unresolvedValueConflicts'?count(values[key],fallback as number):metric(values[key],fallback as number);
    }
    for(const key of Object.keys(d.embodiment) as Array<keyof EmbodiedDynamics>){
      (embodiment as any)[key]=metric(embodiment[key],d.embodiment[key] as number);
    }
    for(const key of Object.keys(d.metrics) as Array<keyof AutonomousCognitiveLifeState['metrics']>){
      (metrics as any)[key]=metric(metrics[key],d.metrics[key] as number);
    }
    this.state={
      ...d,cycles:count(r.cycles),lastAt:timestamp(r.lastAt),autonomousTicks:count(r.autonomousTicks),
      activeIntentions:boundedRows(r.activeIntentions,32) as IntentState[],
      commitments:boundedRows(r.commitments,32) as AgencyCommitment[],
      plans:boundedRows(r.plans,64) as PlanBranch[],
      predictions:boundedRows(r.predictions,256) as PredictionRecord[],
      perceptionQueue:boundedRows(r.perceptionQueue,32) as PerceptionCandidate[],
      personality:personality as unknown as PersonalityDynamics,
      values:values as unknown as ValueDynamics,
      embodiment:embodiment as unknown as EmbodiedDynamics,
      metrics:metrics as unknown as AutonomousCognitiveLifeState['metrics'],
      longitudinal:boundedRows(r.longitudinal,192) as LongitudinalPoint[],
      researchTrials:boundedRows(r.researchTrials,96) as ResearchTrial[],
      lastAction:actions.includes(r.lastAction as ActionKind)?r.lastAction as ActionKind:undefined,
      lastPredictionError01:metric(r.lastPredictionError01,d.lastPredictionError01),
      lastInformationGain01:metric(r.lastInformationGain01,d.lastInformationGain01),
      lastCausalAttribution01:metric(r.lastCausalAttribution01,d.lastCausalAttribution01),
      lastReason:typeof r.lastReason==='string'?r.lastReason.slice(0,2048):d.lastReason,
    };
  }
  snapshot(){return structuredClone(this.state);}
  beginCycle(ctx:AutonomousCognitiveLifeContext){
    const at=ctx.at??now(); this.state.cycles++; this.state.lastAt=at;
    this.state.embodiment={energy01:clamp(ctx.energy01),cognitiveCapacity01:clamp(ctx.capacity01),thermalStrain01:clamp(ctx.thermal01),sensoryFreshness01:clamp(ctx.sensoryFreshness01),recoveryDebt01:clamp((1-ctx.energy01)*.45+ctx.thermal01*.35+(1-ctx.capacity01)*.2),overload01:clamp(ctx.thermal01*.35+(1-ctx.capacity01)*.45+ctx.uncertainty01*.2)};
    this.expireStale(at);
    this.updatePersonality(ctx);
    this.updateMetrics(ctx);
  }
  integrate(ctx:AutonomousCognitiveLifeContext){
    const active=ctx.goals.find(g=>g.status==='active'&&g.id===ctx.activeGoalId)??ctx.goals.find(g=>g.status==='active');
    const evaluations=actions.map(action=>this.evaluateAction(action,ctx,active));
    const ranked=evaluations.slice().sort((a,b)=>b.score01-a.score01);
    const chosen=ranked[0];
    this.state.plans=ranked.flatMap(x=>x.branches).slice(0,64);
    this.state.perceptionQueue=this.generatePerceptionCandidates(ctx).sort((a,b)=>b.selected01-a.selected01).slice(0,24);
    this.ensureIntent(active,chosen,ctx);
    this.state.lastReason=`selected=${chosen.action}; score=${chosen.score01.toFixed(2)}; info=${chosen.expectedInformationGain01.toFixed(2)}; planRisk=${chosen.risk01.toFixed(2)}; autonomy=${this.state.metrics.autonomy01.toFixed(2)}`;
    return evaluations;
  }
  private evaluateAction(action:ActionKind,ctx:AutonomousCognitiveLifeContext,goal?:OrganismGoal):ActionEvaluation{
    const uncertainty=clamp(ctx.uncertainty01),prediction=clamp(ctx.predictionError01),social=clamp(ctx.social01),identity=clamp(ctx.self01),resource=clamp(ctx.resource01);
    const information=this.informationValue(action,ctx); const branches:PlanBranch[]=[];
    for(const horizon of horizons){
      const urgency=goal?clamp(goal.urgency):.4, importance=goal?clamp(goal.importance):.45;
      const horizonBias=horizon==='immediate'?(urgency*.55+.45):horizon==='near'?(importance*.45+(1-prediction)*.15+.4):horizon==='long'?(importance*.5+ctx.futureIdentityCoherence01*.25+.25):(ctx.futureIdentityCoherence01*.55+ctx.autobiographical01*.25+.2);
      const repair=ctx.socialError01*.3+ctx.regret01*.18+ctx.counterfactualGap01*.18;
      const learning=ctx.curriculumPressure01*.25+ctx.transfer01*.2+ctx.retention01*.2+ctx.novelty01*.15+(1-prediction)*.2;
      let actionFit=.5;
      if(action==='respond') actionFit=.2+social*.35+(1-ctx.socialError01)*.2+ctx.relational01*.15+repair*.1;
      if(action==='explore') actionFit=.18+uncertainty*.3+ctx.novelty01*.22+resource*.15+information*.15;
      if(action==='verify') actionFit=.2+prediction*.34+uncertainty*.28+ctx.evidence01*.18+information*.1;
      if(action==='rest') actionFit=.2+(1-ctx.energy01)*.38+ctx.thermal01*.24+(1-ctx.capacity01)*.18;
      if(action==='reflect') actionFit=.2+ctx.regret01*.18+ctx.identityDrift01*.22+ctx.futureMismatch01*.18+ctx.curriculumPressure01*.14+this.state.personality.reflection01*.08;
      if(action==='wait') actionFit=.3+(1-ctx.goalPressure01)*.25+uncertainty*.18+(1-resource)*.12;
      if(action==='defer') actionFit=.2+(1-ctx.capacity01)*.42+repair*.12;
      const feasibility=clamp(resource*.55+ctx.energy01*.25+ctx.capacity01*.2-(action==='explore'?ctx.thermal01*.12:0));
      const risk=clamp(prediction*.25+uncertainty*.2+ctx.socialError01*.12+ctx.identityDrift01*.13+ctx.futureMismatch01*.13+(1-feasibility)*.17);
      const expected=clamp(actionFit*.26+horizonBias*.2+learning*.14+(1-risk)*.14+ctx.futureIdentityCoherence01*.08+ctx.relational01*.06+ctx.evidence01*.06+information*.06+feasibility*.1);
      branches.push({action,horizon,expected01:expected,risk01:risk,learning01:learning,social01:social,identity01:identity,evidence01:clamp(ctx.evidence01),informationValue01:information,feasible01:feasibility});
    }
    const score=clamp(mean(branches.map(b=>b.expected01))*.72+information*.1+(1-mean(branches.map(b=>b.risk01)))*.08+this.intentPersistenceBonus(action)*.1);
    return {action,branches,score01:score,expectedInformationGain01:information,risk01:mean(branches.map(b=>b.risk01)),confidence01:clamp((1-prediction)*.42+ctx.evidence01*.2+ctx.capacity01*.18+this.state.metrics.selfModel01*.2),rationale:`${action}: multi-horizon score ${score.toFixed(2)}, information value ${information.toFixed(2)}, intent-persistence ${this.intentPersistenceBonus(action).toFixed(2)}`};
  }
  private informationValue(action:ActionKind,ctx:AutonomousCognitiveLifeContext){
    if(action==='verify')return clamp(ctx.uncertainty01*.45+ctx.predictionError01*.35+ctx.evidence01*.2);
    if(action==='explore')return clamp(ctx.uncertainty01*.42+ctx.novelty01*.25+ctx.predictionError01*.18+(1-ctx.evidence01)*.15);
    if(action==='respond')return clamp(ctx.socialError01*.46+ctx.social01*.22+ctx.relational01*.2+ctx.uncertainty01*.12);
    if(action==='reflect')return clamp(ctx.selfPredictionError01*.4+ctx.identityDrift01*.22+ctx.futureMismatch01*.2+ctx.counterfactualGap01*.18);
    return clamp(ctx.uncertainty01*.5+ctx.predictionError01*.2+(1-ctx.resource01)*.3);
  }
  private generatePerceptionCandidates(ctx:AutonomousCognitiveLifeContext):PerceptionCandidate[]{
    const rows:[PerceptionMode,number,number,number,number,number,number,string][]=[
      ['verify',ctx.uncertainty01,ctx.predictionError01,ctx.goalPressure01,ctx.novelty01,ctx.evidence01,0,'reduce uncertain belief before commitment'],
      ['explore',ctx.uncertainty01,ctx.novelty01,1-ctx.evidence01,ctx.novelty01,ctx.resource01,0,'seek informative novelty'],
      ['social-check',ctx.socialError01,ctx.socialError01,ctx.social01,ctx.novelty01,ctx.resource01,ctx.social01,'disambiguate another agent state'],
      ['self-check',ctx.selfPredictionError01,ctx.selfPredictionError01,ctx.self01,ctx.identityDrift01,ctx.resource01,ctx.self01,'calibrate self-model'],
      ['world-check',ctx.uncertainty01,ctx.predictionError01,ctx.goalPressure01,ctx.novelty01,ctx.evidence01,0,'update external world model'],
      ['rest',1-ctx.energy01,ctx.thermal01,ctx.goalPressure01,0,ctx.resource01,0,'recover embodied capacity']
    ];
    return rows.map(([mode,u,ig,a,n,c,s,r],i)=>{const cost=clamp(.12+((mode==='explore'||mode==='social-check')?.12:0)+(1-c)*.18);const score=clamp(ig*.42+a*.23+n*.12+s*.12+(1-cost)*.11);return {id:`perception-${this.state.cycles}-${i}`,mode,uncertainty01:clamp(u),expectedInformationGain01:clamp(ig),actionability01:clamp(a),novelty01:clamp(n),cost01:cost,socialRelevance01:clamp(s),selfRelevance01:mode==='self-check'?1:.3,selected01:score,rationale:r};});
  }
  private ensureIntent(goal:OrganismGoal|undefined,chosen:ActionEvaluation,ctx:AutonomousCognitiveLifeContext){
    const key=goal?.id??'none';
    const existing=this.state.activeIntentions.find(x=>x.goalId===key&&x.status==='active');
    if(existing){existing.priority01=clamp(existing.priority01*.85+chosen.score01*.15);existing.expectedValue01=chosen.score01;existing.lastAt=ctx.at??now();existing.persistence01=clamp(existing.persistence01*.96+.04);}
    else this.state.activeIntentions.unshift({id:`intent-${this.state.cycles}-${key}`,goalId:goal?.id??null,action:chosen.action,priority01:chosen.score01,persistence01:.55,expectedValue01:chosen.score01,status:'active',createdAt:ctx.at??now(),lastAt:ctx.at??now()});
    this.state.activeIntentions=this.state.activeIntentions.slice(0,32);
  }
  private intentPersistenceBonus(action:ActionKind){const rs=this.state.activeIntentions.filter(x=>x.status==='active'&&x.action===action);return rs.length?mean(rs.map(x=>x.persistence01)):0;
  }
  private detachSignalInput<T>(input:T,code:string):T {
    try {
      const detached=snapshotPlainData<T>(input,{allowNonFiniteNumbers:true,maxDepth:8,maxNodes:128,maxStringUnits:4096});
      if(!detached || typeof detached!=='object' || Array.isArray(detached)) throw new Error('not-record');
      return detached;
    } catch {
      throw new TypeError(code);
    }
  }
  private requireUnitSignals(values:unknown[],code:string):void {
    if(values.some(value=>typeof value!=='number'||!Number.isFinite(value)||value<0||value>1)) throw new RangeError(code);
  }
  recordDecision(input:{action:ActionKind;predicted01:number;confidence01:number;contextKey?:string;at?:number}){
    const clean=this.detachSignalInput(input,'autonomous-life-decision-input-invalid');
    if(!actions.includes(clean.action)) throw new TypeError('autonomous-life-decision-action-invalid');
    this.requireUnitSignals([clean.predicted01,clean.confidence01],'autonomous-life-decision-signal-invalid');
    if(clean.contextKey!==undefined&&(typeof clean.contextKey!=='string'||clean.contextKey.length===0||clean.contextKey.length>180||clean.contextKey.trim()!==clean.contextKey)) throw new TypeError('autonomous-life-decision-context-invalid');
    if(clean.at!==undefined&&(!Number.isFinite(clean.at)||clean.at<0)) throw new RangeError('autonomous-life-decision-time-invalid');
    const row:PredictionRecord={id:`pred-${randomUUID()}`,action:clean.action,contextKey:clean.contextKey??'default',predicted01:clean.predicted01,confidence01:clean.confidence01,at:clean.at??now()};
    this.state.predictions.unshift(row);this.state.lastAction=clean.action;this.state.predictions=this.state.predictions.slice(0,256);return structuredClone(row);
  }
  recordOutcome(input:{actual01:number;verified01:number;causal01:number;transfer01:number;social01:number;identity01:number;learning01:number;surprise01:number;action?:ActionKind;at?:number}){
    const clean=this.detachSignalInput(input,'autonomous-life-outcome-input-invalid');
    this.requireUnitSignals([clean.actual01,clean.verified01,clean.causal01,clean.transfer01,clean.social01,clean.identity01,clean.learning01,clean.surprise01],'autonomous-life-outcome-signal-invalid');
    if(clean.action!==undefined&&!actions.includes(clean.action)) throw new TypeError('autonomous-life-outcome-action-invalid');
    if(clean.at!==undefined&&(!Number.isFinite(clean.at)||clean.at<0)) throw new RangeError('autonomous-life-outcome-time-invalid');
    // Validate the complete payload before consuming a pending prediction or updating
    // longitudinal learning metrics. Invalid telemetry/reward must be a no-op.
    const row=this.state.predictions.find(p=>!('actual01' in p)&&(!clean.action||p.action===clean.action));
    const error=row?Math.abs(row.predicted01-clean.actual01):clean.surprise01;
    if(row){row.actual01=clean.actual01;row.error01=error;row.verified01=clean.verified01;row.causalRole=clean.causal01>.65?'cause':clean.causal01>.35?'correlate':'uncertain';}
    this.state.lastPredictionError01=error;this.state.lastCausalAttribution01=clean.causal01;this.state.lastInformationGain01=clean.surprise01;
    this.state.metrics.closedLoop01=clamp(this.state.metrics.closedLoop01*.9+(1-error)*.06+clean.verified01*.02+clean.causal01*.02);
    this.state.metrics.causalLearning01=clamp(this.state.metrics.causalLearning01*.92+clean.causal01*.04+clean.learning01*.04);
    this.state.metrics.transfer01=clamp(this.state.metrics.transfer01*.93+clean.transfer01*.07);
    this.state.metrics.metacognition01=clamp(this.state.metrics.metacognition01*.93+(1-error)*.04+clean.verified01*.03);
    this.state.metrics.socialModel01=clamp(this.state.metrics.socialModel01*.94+clean.social01*.03+(1-clean.surprise01)*.03);
    this.state.metrics.selfModel01=clamp(this.state.metrics.selfModel01*.94+clean.identity01*.03+(1-error)*.03);
    this.state.metrics.autonomy01=clamp(this.state.metrics.autonomy01*.95+this.state.metrics.closedLoop01*.02+this.intentPersistenceBonus(this.state.lastAction??'wait')*.015+this.state.metrics.planning01*.015);
    if(clean.action){const c=this.state.commitments.find(x=>x.action===clean.action&&x.status==='open');if(c){c.reliability01=clamp(c.reliability01*.9+clean.actual01*.1);if(clean.verified01>.7&&clean.actual01>.58)c.status='fulfilled';}}
    if(clean.identity01>.7)this.state.personality.autonomy01=clamp(this.state.personality.autonomy01*.98+this.state.metrics.autonomy01*.02);
    return {predictionError01:error,verified01:clean.verified01,causalAttribution01:this.state.lastCausalAttribution01};
  }
  autonomousTick(ctx:AutonomousCognitiveLifeContext){
    this.state.autonomousTicks++;const evals=this.integrate(ctx);const selected=evals.slice().sort((a,b)=>b.score01-a.score01)[0];
    return {autonomous:true,selected:selected.action,score01:selected.score01,perception:this.state.perceptionQueue[0]??null,reason:this.state.lastReason};
  }
  selectPerception(){return this.state.perceptionQueue[0]??null;}
  addCommitment(input:{goalId?:string|null;action:ActionKind;dueAt?:number;reliability01?:number}){
    const clean=this.detachSignalInput(input,'autonomous-life-commitment-input-invalid');
    if(!actions.includes(clean.action)) throw new TypeError('autonomous-life-commitment-action-invalid');
    if(clean.goalId!==undefined&&clean.goalId!==null&&(typeof clean.goalId!=='string'||!clean.goalId.trim()||clean.goalId.length>180||clean.goalId.trim()!==clean.goalId)) throw new TypeError('autonomous-life-commitment-goal-invalid');
    if(clean.dueAt!==undefined&&(!Number.isFinite(clean.dueAt)||clean.dueAt<0)) throw new RangeError('autonomous-life-commitment-time-invalid');
    if(clean.reliability01!==undefined&&(typeof clean.reliability01!=='number'||!Number.isFinite(clean.reliability01)||clean.reliability01<0||clean.reliability01>1)) throw new RangeError('autonomous-life-commitment-reliability-invalid');
    const createdAt=now();
    const c:AgencyCommitment={id:`commit-${randomUUID()}`,goalId:clean.goalId??null,action:clean.action,createdAt,dueAt:clean.dueAt??createdAt+86400000,reliability01:clean.reliability01??.5,status:'open'};
    this.state.commitments.unshift(c);this.state.commitments=this.state.commitments.slice(0,32);return structuredClone(c);
  }
  updatePersonality(ctx:AutonomousCognitiveLifeContext){
    const prev=this.state.personality;
    const curiosity=clamp(ctx.novelty01*.55+ctx.uncertainty01*.25+(1-ctx.evidence01)*.2);
    const persistence=clamp(ctx.goalPressure01*.35+this.state.activeIntentions.length/20*.2+this.state.metrics.closedLoop01*.25+this.state.metrics.recovery01*.2);
    const caution=clamp(ctx.uncertainty01*.35+ctx.predictionError01*.3+ctx.resource01*.2+(1-ctx.evidence01)*.15);
    const sociability=clamp(ctx.social01*.6+ctx.relational01*.25+(1-ctx.socialError01)*.15);
    const reflection=clamp(ctx.regret01*.35+ctx.selfPredictionError01*.25+ctx.futureMismatch01*.2+ctx.counterfactualGap01*.2);
    const autonomy=clamp(this.state.metrics.autonomy01*.55+ctx.goalPressure01*.2+ctx.self01*.15+(1-ctx.socialError01)*.1);
    const adaptability=clamp(ctx.predictionError01*.3+ctx.transfer01*.3+ctx.retention01*.2+ctx.novelty01*.2);
    const values=[curiosity,persistence,caution,sociability,reflection,autonomy,adaptability];const prevs=[prev.curiosity01,prev.persistence01,prev.caution01,prev.sociability01,prev.reflection01,prev.autonomy01,prev.adaptability01];
    const drift=mean(values.map((v,i)=>Math.abs(v-prevs[i])));
    this.state.personality={curiosity01:clamp(prev.curiosity01*.93+curiosity*.07),persistence01:clamp(prev.persistence01*.93+persistence*.07),caution01:clamp(prev.caution01*.93+caution*.07),sociability01:clamp(prev.sociability01*.93+sociability*.07),reflection01:clamp(prev.reflection01*.93+reflection*.07),autonomy01:clamp(prev.autonomy01*.93+autonomy*.07),adaptability01:clamp(prev.adaptability01*.93+adaptability*.07),coherence01:clamp(1-drift*.8),evidenceCount:prev.evidenceCount+1,drift01:clamp(drift)};
    this.state.values={...this.state.values,stability01:clamp(this.state.values.stability01*.97+(1-drift)*.03),preferenceConsistency01:clamp(this.state.values.preferenceConsistency01*.96+(1-Math.abs(ctx.identityDrift01-this.state.values.revisionPressure01))*.04),valueEvidence01:clamp(this.state.values.valueEvidence01*.95+ctx.evidence01*.05),revisionPressure01:clamp(ctx.identityDrift01*.45+ctx.futureMismatch01*.25+ctx.counterfactualGap01*.3),unresolvedValueConflicts:(ctx.identityDrift01>.65?this.state.values.unresolvedValueConflicts+1:Math.max(0,this.state.values.unresolvedValueConflicts-0.2))};
  }
  updateMetrics(ctx:AutonomousCognitiveLifeContext){
    const intention=clamp(this.state.activeIntentions.length?mean(this.state.activeIntentions.map(x=>x.priority01)):ctx.goalPressure01);
    this.state.metrics.planning01=clamp(this.state.metrics.planning01*.9+intention*.05+(1-ctx.futureMismatch01)*.05);
    this.state.metrics.activePerception01=clamp(this.state.metrics.activePerception01*.92+this.informationValue('verify',ctx)*.04+this.informationValue('explore',ctx)*.04);
    this.state.metrics.persistence01=clamp(this.state.metrics.persistence01*.94+(this.state.activeIntentions.length?1:.35)*.06);
    this.state.metrics.recovery01=clamp(this.state.metrics.recovery01*.92+(ctx.energy01*.45+(1-ctx.thermal01)*.25+ctx.capacity01*.3)*.08);
    this.state.metrics.embodiedAgency01=clamp(ctx.energy01*.25+ctx.capacity01*.25+(1-ctx.thermal01)*.2+this.state.metrics.autonomy01*.15+this.state.metrics.planning01*.15);
    this.state.metrics.interactionReadiness01=clamp(ctx.social01*.3+(1-ctx.socialError01)*.25+ctx.energy01*.2+this.state.metrics.socialModel01*.15+this.state.metrics.autonomy01*.1);
    this.state.metrics.personalityStability01=clamp(1-this.state.personality.drift01*.7+this.state.personality.coherence01*.3);
    this.state.metrics.researchRigor01=clamp(this.state.researchTrials.length?mean(this.state.researchTrials.map(x=>x.confidence01))*.6+this.state.researchTrials.filter(x=>x.status==='completed').length/Math.max(1,this.state.researchTrials.length)*.4:.05);
  }
  appendLongitudinal(input:{overall01:number;autonomy01:number;self01:number;social01:number;learning01:number;planning01:number;embodied01:number;verified01:number;at?:number}){
    this.state.longitudinal.unshift({cycle:this.state.cycles,overall01:clamp(input.overall01),autonomy01:clamp(input.autonomy01),self01:clamp(input.self01),social01:clamp(input.social01),learning01:clamp(input.learning01),planning01:clamp(input.planning01),embodied01:clamp(input.embodied01),verified01:clamp(input.verified01),at:input.at??now()});this.state.longitudinal=this.state.longitudinal.slice(0,192);
  }
  runResearchTrial(input:{id:string;hypothesis:string;component:string;control01:number;treatment01:number;confidence01:number}){
    const delta=clamp(input.treatment01)-clamp(input.control01);const trial:ResearchTrial={id:input.id,hypothesis:input.hypothesis,component:input.component,control01:clamp(input.control01),treatment01:clamp(input.treatment01),delta01:delta,confidence01:clamp(input.confidence01),status:'completed',at:now()};this.state.researchTrials.unshift(trial);this.state.researchTrials=this.state.researchTrials.slice(0,96);return trial;
  }
  ablate(component:string){
    const map:Record<string,number>={
      agency:this.state.metrics.autonomy01*.12, prediction:this.learningMetric()*.14,
      worldModel:(1-this.worldUncertainty())*.12, selfModel:this.state.metrics.selfModel01*.12,
      memory:this.selfContinuityMetric()*.1, social:this.state.metrics.socialModel01*.1,
      workspace:this.state.metrics.metacognition01*.08, embodiment:this.state.metrics.embodiedAgency01*.08,
      activePerception:this.state.metrics.activePerception01*.09, counterfactual:clamp(1-this.state.lastPredictionError01)*.09
    };
    const base=this.overall();const delta=clamp(map[component]??.04);return {component,base01:base,ablated01:clamp(base-delta),delta01:delta,material:delta>=.08};
  }
  diagnostics(){
    const long=this.state.longitudinal.slice(0,24);const stability=long.length?mean(long.map(x=>x.overall01)) : this.overall();
    return {version:1,cycles:this.state.cycles,autonomousTicks:this.state.autonomousTicks,metrics:this.state.metrics,personality:this.state.personality,values:this.state.values,embodiment:this.state.embodiment,intentions:this.state.activeIntentions.length,openCommitments:this.state.commitments.filter(x=>x.status==='open').length,pendingPerceptions:this.state.perceptionQueue.length,longitudinalMean01:stability,lastPredictionError01:this.state.lastPredictionError01,lastInformationGain01:this.state.lastInformationGain01,lastCausalAttribution01:this.state.lastCausalAttribution01,overall01:this.overall(),nextPerception:this.selectPerception(),lastReason:this.state.lastReason};
  }
  benchmark(){
    const rows={
      closedLoop:this.state.metrics.closedLoop01,
      persistentAgency:this.state.metrics.autonomy01*.55+this.state.metrics.persistence01*.45,
      counterfactualPlanning:this.state.metrics.planning01*.55+(1-this.state.lastPredictionError01)*.25+this.state.metrics.metacognition01*.2,
      activePerception:this.state.metrics.activePerception01,
      autonomousLife:this.state.metrics.autonomy01*.4+this.state.metrics.persistence01*.25+this.state.metrics.recovery01*.15+this.state.metrics.interactionReadiness01*.2,
      selfModel:this.state.metrics.selfModel01, personalityStability:this.state.metrics.personalityStability01,
      embodiedAgency:this.state.metrics.embodiedAgency01, socialCognition:this.state.metrics.socialModel01,
      researchRigor:this.state.metrics.researchRigor01, longitudinal:this.state.longitudinal.length?mean(this.state.longitudinal.slice(0,32).map(x=>x.verified01)):.0
    };
    return {scores:rows,overall01:mean(Object.values(rows)),sampleCount:this.state.predictions.length,verifiedPredictions:this.state.predictions.filter(x=>(x.verified01??0)>.7).length,completedResearch:this.state.researchTrials.filter(x=>x.status==='completed').length};
  }
  commitResearchCoverage(coverage01:number){this.state.metrics.researchRigor01=clamp(this.state.metrics.researchRigor01*.8+clamp(coverage01)*.2);}
  private overall(){return clamp(mean([this.state.metrics.autonomy01,this.state.metrics.closedLoop01,this.state.metrics.planning01,this.state.metrics.activePerception01,this.state.metrics.causalLearning01,this.state.metrics.metacognition01,this.state.metrics.socialModel01,this.state.metrics.selfModel01,this.state.metrics.embodiedAgency01,this.state.metrics.personalityStability01,this.state.metrics.researchRigor01]));}
  private learningMetric(){return clamp(this.state.metrics.causalLearning01*.55+this.state.metrics.transfer01*.45);}
  private worldUncertainty(){return clamp(1-this.state.metrics.closedLoop01*.45-this.state.metrics.activePerception01*.35-this.state.metrics.metacognition01*.2);}
  private selfContinuityMetric(){return clamp(this.state.metrics.selfModel01*.5+this.state.personality.coherence01*.25+this.state.values.stability01*.25);}
  private expireStale(at:number){this.state.activeIntentions=this.state.activeIntentions.filter(x=>x.status==='active'&&at-x.lastAt<7*86400000);this.state.commitments=this.state.commitments.map(x=>x.status==='open'&&at>x.dueAt?{...x,status:'repair'}:x);}
  actionBias(action:ActionKind){const intent=this.intentPersistenceBonus(action);const plans=this.state.plans.filter(x=>x.action===action);const p=plans.length?mean(plans.map(x=>x.expected01)):.5;return clamp((p-.5)*.055+intent*.025+(action==='verify'||action==='explore'?this.state.metrics.activePerception01*.012:0));}
}
