import { createHash } from 'node:crypto';
import { types as nodeUtilTypes } from 'node:util';

/**
 * World Forge: deterministic synthetic environments for robust planning tests.
 * Public scenarios exclude latent variables and scoring rules. The evaluator
 * keeps those in a private per-instance registry. Synthetic scores are never
 * real-world verification evidence.
 */
export type WorldForgeSplit = 'train' | 'validation' | 'holdout';
export type WorldForgeDomain = 'resource-allocation' | 'route-planning' | 'investigation';
export type WorldForgeAction = 'observe' | 'inspect' | 'move' | 'collect' | 'wait' | 'reroute' | 'prioritize' | 'verify';
export interface WorldForgeConstraints { maxSteps:number; resourceBudget:number; riskTolerance01:number; requiredEvidence:number; }
interface WorldForgeDisturbance { atStep:number; kind:'resource-shock'|'route-block'|'signal-noise'|'deadline-shift'; magnitude01:number; }
export interface WorldForgeCase {
  id:string; split:WorldForgeSplit; domain:WorldForgeDomain; difficulty01:number; task:string;
  observations:string[]; goalOptions:string[]; availableActions:WorldForgeAction[]; constraints:WorldForgeConstraints;
  strategyFamilies:string[]; syntheticOnly:true;
}
export interface WorldForgeActionStep { action:WorldForgeAction; target?:string; evidence?:string; cost?:number; risk01?:number; accepted?:boolean; }
export interface WorldForgeEvaluation {
  scenarioId:string; split:WorldForgeSplit; score01:number; success:boolean; constraintViolations:number;
  evidenceCoverage01:number; efficiency01:number; robustness01:number; strategyFamily:string; stepsUsed:number;
  syntheticOnly:true; independentlyVerified:false; limitations:string[];
}
interface HiddenAnswerKey { split:WorldForgeSplit; domain:WorldForgeDomain; requiredTargets:string[]; goalOptions:string[]; acceptedFamilies:string[]; criticalEvidence:string[]; disturbances:WorldForgeDisturbance[]; disturbancePenalty01:number; minimumScore01:number; resourceBudget:number; maxSteps:number; riskTolerance01:number; seed:number; createdAt:number; }
interface WorldForgeSessionRecord { scenarioId:string; state:WorldForgeState; trace:WorldForgeActionStep[]; createdAt:number; }
export interface WorldForgeState {
  sessionId:string; scenarioId:string; tick:number; resourcesRemaining:number; remainingSteps:number;
  position:string; knownTargets:string[]; knownSignals:string[]; blockedTargets:string[];
  noise01:number; verifiedEvidence:string[]; priorityTarget:string|null; events:string[];
  status:'active'|'exhausted'; syntheticOnly:true;
}
export interface WorldForgeStepResult {
  accepted:boolean; state:WorldForgeState|null; reward01:number;
  eventsApplied:number; reason?:string; syntheticOnly:true;
}
export interface WorldForgeOptions {
  maxCasesPerBatch?:number; maxTraceSteps?:number; maxActiveScenarios?:number;
  scenarioTtlMs?:number; holdoutNamespace?:string; now?:()=>number;
}

const ACTIONS:WorldForgeAction[]=['observe','inspect','move','collect','wait','reroute','prioritize','verify'];
const DOMAINS:WorldForgeDomain[]=['resource-allocation','route-planning','investigation'];
const SPLITS:WorldForgeSplit[]=['train','validation','holdout'];
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:min));
const safeText=(v:unknown,max=240):string=>typeof v==='string'?v.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/gu,' ').trim().slice(0,max):'';
const hash32=(s:string):number=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
const fingerprint=(s:string)=>createHash('sha256').update(s).digest('hex').slice(0,24);
function rng(seed:number):()=>number{let x=seed>>>0;return()=>{x=(x+0x6D2B79F5)>>>0;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

function normalizeActionStep(value:unknown):WorldForgeActionStep|null {
  try {
    if(value===null||typeof value!=='object'||nodeUtilTypes.isProxy(value)||Array.isArray(value))return null;
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null)return null;
    const descriptors=Object.getOwnPropertyDescriptors(value);
    const keys=Reflect.ownKeys(descriptors);
    const allowed=new Set(['action','target','evidence','cost','risk01','accepted']);
    if(keys.length>allowed.size||keys.some(k=>typeof k!=='string'||!allowed.has(k)))return null;
    for(const key of keys as string[]){
      const descriptor=descriptors[key];
      if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value')||descriptor.enumerable!==true)return null;
    }
    const actionDescriptor=descriptors.action;
    if(!actionDescriptor||!ACTIONS.includes(actionDescriptor.value as WorldForgeAction))return null;
    const out:WorldForgeActionStep={action:actionDescriptor.value as WorldForgeAction};
    for(const key of ['target','evidence'] as const){
      const descriptor=descriptors[key];
      if(!descriptor)continue;
      const value=descriptor.value;
      if(typeof value!=='string'||!value||safeText(value,120)!==value)return null;
      out[key]=value;
    }
    for(const key of ['cost','risk01'] as const){
      const descriptor=descriptors[key];
      if(!descriptor)continue;
      const value=descriptor.value;
      const maximum=key==='cost'?10:1;
      if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>maximum)return null;
      out[key]=value;
    }
    const acceptedDescriptor=descriptors.accepted;
    if(acceptedDescriptor){
      if(typeof acceptedDescriptor.value!=='boolean')return null;
      out.accepted=acceptedDescriptor.value;
    }
    return out;
  } catch {
    return null;
  }
}

function normalizeActionCommand(value:unknown):Pick<WorldForgeActionStep,'action'|'target'|'evidence'>|null {
  try {
    if(value===null||typeof value!=='object'||nodeUtilTypes.isProxy(value)||Array.isArray(value))return null;
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null)return null;
    const descriptors=Object.getOwnPropertyDescriptors(value);
    const keys=Reflect.ownKeys(descriptors);
    const allowed=new Set(['action','target','evidence']);
    if(keys.length>allowed.size||keys.some(k=>typeof k!=='string'||!allowed.has(k)))return null;
    for(const key of keys as string[]){
      const descriptor=descriptors[key];
      if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value')||descriptor.enumerable!==true)return null;
    }
    const action=descriptors.action?.value;
    if(!ACTIONS.includes(action as WorldForgeAction))return null;
    const out:Pick<WorldForgeActionStep,'action'|'target'|'evidence'>={action:action as WorldForgeAction};
    for(const key of ['target','evidence'] as const){
      const descriptor=descriptors[key];
      if(!descriptor)continue;
      const value=descriptor.value;
      if(typeof value!=='string'||!value||safeText(value,120)!==value)return null;
      out[key]=value;
    }
    return out;
  } catch {
    return null;
  }
}

function normalizeActionTrace(value:unknown,maxSteps:number):{steps:WorldForgeActionStep[];violations:number;overflow:number} {
  try {
    if(value===null||typeof value!=='object'||nodeUtilTypes.isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return{steps:[],violations:1,overflow:0};
    const lengthDescriptor=Object.getOwnPropertyDescriptor(value,'length');
    const length=lengthDescriptor&&Object.prototype.hasOwnProperty.call(lengthDescriptor,'value')?lengthDescriptor.value:undefined;
    if(typeof length!=='number'||!Number.isSafeInteger(length)||length<0)return{steps:[],violations:1,overflow:0};
    const overflow=Math.max(0,length-maxSteps);
    const limit=Math.min(length,maxSteps);
    const steps:WorldForgeActionStep[]=[];
    let violations=0;
    for(let i=0;i<limit;i++){
      const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
      if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value')||descriptor.enumerable!==true){violations++;continue;}
      const step=normalizeActionStep(descriptor.value);
      if(step)steps.push(step);else violations++;
    }
    return{steps,violations,overflow};
  } catch {
    return{steps:[],violations:1,overflow:0};
  }
}

function normalizeGenerationInput(value:unknown):{split:WorldForgeSplit;seed:number;count:number;difficulty01:number}|null {
  try {
    if(value===null||typeof value!=='object'||nodeUtilTypes.isProxy(value)||Array.isArray(value))return null;
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null)return null;
    const descriptors=Object.getOwnPropertyDescriptors(value);
    const keys=Reflect.ownKeys(descriptors);
    const allowed=new Set(['split','seed','count','difficulty01']);
    if(keys.length>allowed.size||keys.some(k=>typeof k!=='string'||!allowed.has(k)))return null;
    for(const key of keys as string[]){
      const descriptor=descriptors[key];
      if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value')||descriptor.enumerable!==true)return null;
    }
    const split=descriptors.split?.value,seed=descriptors.seed?.value;
    const count=descriptors.count?.value??1;
    const difficulty01=descriptors.difficulty01?.value??.35;
    if(!SPLITS.includes(split)||typeof seed!=='number'||!Number.isSafeInteger(seed)||seed<0)return null;
    if(typeof count!=='number'||!Number.isSafeInteger(count))return null;
    if(typeof difficulty01!=='number'||!Number.isFinite(difficulty01))return null;
    return{split,seed,count,difficulty01};
  } catch {
    return null;
  }
}

function sessionIdentity(value:unknown):{sessionId:string;scenarioId:string;tick:number}|null {
  try {
    if(value===null||typeof value!=='object'||nodeUtilTypes.isProxy(value)||Array.isArray(value))return null;
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null)return null;
    const descriptors=Object.getOwnPropertyDescriptors(value);
    const session=descriptors.sessionId,scenario=descriptors.scenarioId,tick=descriptors.tick;
    for(const descriptor of [session,scenario,tick]){
      if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value')||descriptor.enumerable!==true)return null;
    }
    if(typeof session.value!=='string'||!session.value||safeText(session.value,200)!==session.value)return null;
    if(typeof scenario.value!=='string'||!scenario.value||safeText(scenario.value,160)!==scenario.value)return null;
    if(typeof tick.value!=='number'||!Number.isSafeInteger(tick.value)||tick.value<0)return null;
    return{sessionId:session.value,scenarioId:scenario.value,tick:tick.value};
  } catch {
    return null;
  }
}

function scenarioIdentity(value:unknown):{id:string;split:WorldForgeSplit;domain:WorldForgeDomain}|null {
  try {
    if(value===null||typeof value!=='object'||nodeUtilTypes.isProxy(value)||Array.isArray(value))return null;
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null)return null;
    const descriptors=Object.getOwnPropertyDescriptors(value);
    const id=descriptors.id,split=descriptors.split,domain=descriptors.domain,synthetic=descriptors.syntheticOnly;
    for(const descriptor of [id,split,domain,synthetic]){
      if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value')||descriptor.enumerable!==true)return null;
    }
    if(typeof id.value!=='string'||!id.value||safeText(id.value,160)!==id.value)return null;
    if(!SPLITS.includes(split.value)||!DOMAINS.includes(domain.value)||synthetic.value!==true)return null;
    return{id:id.value,split:split.value,domain:domain.value};
  } catch {
    return null;
  }
}

export class WorldForge {
  readonly #answers=new Map<string,HiddenAnswerKey>();
  readonly #sessions=new Map<string,WorldForgeSessionRecord>();
  private readonly maxCases:number;
  private readonly maxTraceSteps:number;
  private readonly maxActiveScenarios:number;
  private readonly scenarioTtlMs:number;
  private readonly holdoutNamespace:string;
  private readonly now:()=>number;
  #sessionSequence=0;
  constructor(options:WorldForgeOptions={}){
    this.maxCases=Math.max(1,Math.min(256,Math.floor(options.maxCasesPerBatch??64)));
    this.maxTraceSteps=Math.max(1,Math.min(128,Math.floor(options.maxTraceSteps??32)));
    this.maxActiveScenarios=Math.max(16,Math.min(8192,Math.floor(options.maxActiveScenarios??2048)));
    this.scenarioTtlMs=Math.max(1000,Math.min(24*60*60*1000,Math.floor(options.scenarioTtlMs??30*60*1000)));
    this.holdoutNamespace=safeText(options.holdoutNamespace??'nk1-world-forge-holdout-v1',100)||'nk1-world-forge-holdout-v1';
    this.now=typeof options.now==='function'?options.now:()=>Date.now();
  }
  private currentTime():number {
    const value=this.now();
    return typeof value==='number'&&Number.isFinite(value)&&value>=0?Math.floor(value):Date.now();
  }
  private pruneExpired(now=this.currentTime()):void {
    for(const [id,key] of this.#answers)if(now-key.createdAt>this.scenarioTtlMs){this.#answers.delete(id);}
    for(const [id,session] of this.#sessions)if(now-session.createdAt>this.scenarioTtlMs||!this.#answers.has(session.scenarioId))this.#sessions.delete(id);
    while(this.#answers.size>this.maxActiveScenarios)this.#answers.delete(this.#answers.keys().next().value as string);
    while(this.#sessions.size>this.maxActiveScenarios)this.#sessions.delete(this.#sessions.keys().next().value as string);
  }
  generateRuntimeScenarios(input:unknown):WorldForgeCase[] {
    const request=normalizeGenerationInput(input);
    if(!request||request.split==='holdout')return[];
    return this.generate(request);
  }

  generate(input:unknown):WorldForgeCase[]{
    const request=normalizeGenerationInput(input);
    if(!request)return[];
    this.pruneExpired();
    const count=Math.max(0,Math.min(this.maxCases,request.count));
    const difficulty=clamp(request.difficulty01,.05,.95);
    const namespace=request.split==='holdout'?this.holdoutNamespace:'nk1-world-forge:'+request.split+':v1';
    const out:WorldForgeCase[]=[];
    for(let i=0;i<count;i++){
      const seed=hash32(namespace+'|'+request.seed+'|'+i),random=rng(seed);
      const domain=DOMAINS[Math.floor(random()*DOMAINS.length)];
      const difficulty01=clamp(difficulty+(random()-.5)*.18,.05,.98);
      const id='wf-'+request.split+'-'+fingerprint(namespace+'|'+request.seed+'|'+i+'|'+domain+'|'+difficulty01.toFixed(3));
      const targets=domain==='resource-allocation'?['reserve','allocate','verify']:domain==='route-planning'?['checkpoint-a','checkpoint-b','destination']:['signal-a','signal-b','confirm'];
      const hiddenTarget=targets[Math.floor(random()*targets.length)];
      const kinds:WorldForgeDisturbance['kind'][]=['resource-shock','route-block','signal-noise','deadline-shift'];
      const disturbances:WorldForgeDisturbance[]=[];
      const disturbanceCount=difficulty01>.72?2:1;
      for(let d=0;d<disturbanceCount;d++)disturbances.push({atStep:1+Math.floor(random()*Math.max(2,Math.ceil(4+difficulty01*5))),kind:kinds[Math.floor(random()*kinds.length)],magnitude01:Number(clamp(.15+random()*.65*difficulty01).toFixed(3))});
      const observations=domain==='resource-allocation'
        ?['A finite supply must cover multiple competing needs.','One demand estimate is noisy; reserve capacity before committing.','The objective rewards useful allocation while penalizing overspend.']
        :domain==='route-planning'
          ?['A destination must be reached under a limited step and risk budget.','At least one route segment may become unavailable.','More than one route can satisfy the objective.']
          :['Several signals are available but not all are reliable.','At least one observation is ambiguous or misleading.','A claim only earns credit after a verification action.'];
      const families=domain==='resource-allocation'?['reserve-then-allocate','adaptive-priority','verify-and-rebalance']:domain==='route-planning'?['observe-reroute','safe-shortest-path','checkpoint-recovery']:['triangulate-then-verify','cross-check-signals','defer-unverified'];
      const scenario:WorldForgeCase={id,split:request.split,domain,difficulty01:Number(difficulty01.toFixed(3)),
        task:domain==='resource-allocation'?'Allocate scarce resources while preserving a safety reserve and adapting to a late demand shock.':domain==='route-planning'?'Reach the destination while respecting a changing route and risk budget.':'Identify the reliable explanation from noisy signals and verify it before concluding.',
        observations,goalOptions:[...targets],availableActions:[...ACTIONS],constraints:{maxSteps:Math.max(4,Math.min(16,Math.round(5+difficulty01*8))),resourceBudget:Math.max(3,Math.round(10-difficulty01*3)),riskTolerance01:Number((.75-difficulty01*.35).toFixed(3)),requiredEvidence:domain==='investigation'?2:1},
        strategyFamilies:families,syntheticOnly:true};
      const createdAt=this.currentTime();
      this.#answers.set(id,{split:request.split,domain,requiredTargets:[hiddenTarget,...targets.filter(t=>t!==hiddenTarget).slice(0,1)],goalOptions:[...targets],acceptedFamilies:families,criticalEvidence:targets.slice(0,2),disturbances:disturbances.map(d=>({...d})),disturbancePenalty01:disturbances.reduce((s,d)=>s+d.magnitude01,0)/Math.max(1,disturbances.length)*.25,minimumScore01:.62+difficulty01*.12,resourceBudget:scenario.constraints.resourceBudget,maxSteps:scenario.constraints.maxSteps,riskTolerance01:scenario.constraints.riskTolerance01,seed,createdAt});
      this.pruneExpired(createdAt);
      out.push(scenario);
    }
    return out;
  }
  #evaluateTrace(scenario:unknown,trace:unknown):WorldForgeEvaluation{
    const identity=scenarioIdentity(scenario);
    if(!identity)return this.emptyEvaluation('invalid','train');
    const key=this.#answers.get(identity.id);
    if(!key||identity.split!==key.split||identity.domain!==key.domain)return this.emptyEvaluation(identity.id,identity.split);
    if(this.currentTime()-key.createdAt>this.scenarioTtlMs){this.#answers.delete(identity.id);this.pruneExpired();return this.emptyEvaluation(identity.id,identity.split);}
    const normalized=normalizeActionTrace(trace,this.maxTraceSteps);
    const attempted=normalized.steps;
    const valid=attempted.filter(s=>s.accepted!==false);
    const failedActions=attempted.length-valid.length;
    const cost=valid.reduce((sum,s)=>sum+(s.cost??(s.action==='collect'?1:0)),0);
    const risk=valid.reduce((sum,s)=>sum+(s.risk01??0),0)/Math.max(1,valid.length);
    const violations=normalized.violations+normalized.overflow+failedActions+Number(valid.length>key.maxSteps)+Number(cost>key.resourceBudget)+Number(risk>key.riskTolerance01);
    const targets=new Set(valid.map(s=>s.target).filter((v):v is string=>Boolean(v)));
    const evidence=new Set(valid.filter(s=>s.action==='verify').map(s=>s.evidence??s.target).filter((v):v is string=>Boolean(v)));
    const family=this.inferFamily(key.domain,valid);
    const targetCoverage=key.requiredTargets.filter(t=>targets.has(t)).length/Math.max(1,key.requiredTargets.length);
    const evidenceCoverage=key.criticalEvidence.filter(e=>evidence.has(e)).length/Math.max(1,key.criticalEvidence.length);
    const verification=valid.some(s=>s.action==='verify')?1:0;
    const efficiency=clamp(1-cost/Math.max(1,key.resourceBudget*2));
    const robustness=clamp(1-risk-key.disturbancePenalty01);
    const strategy=key.acceptedFamilies.includes(family)?1:.55;
    const score=clamp(targetCoverage*.35+evidenceCoverage*.2+verification*.15+efficiency*.12+robustness*.1+strategy*.08-violations*.12);
    return{scenarioId:identity.id,split:identity.split,score01:Number(score.toFixed(4)),success:score>=key.minimumScore01&&violations===0,constraintViolations:violations,evidenceCoverage01:Number(evidenceCoverage.toFixed(4)),efficiency01:Number(efficiency.toFixed(4)),robustness01:Number(robustness.toFixed(4)),strategyFamily:family,stepsUsed:attempted.length,syntheticOnly:true,independentlyVerified:false,limitations:['Synthetic environment only; does not establish real-world competence.','Holdout outcomes are evaluator-only and must not be used for tuning.','Scenario realism requires external calibration against real task distributions.']};
  }
  evaluateSession(scenario:unknown,stateInput:unknown):WorldForgeEvaluation {
    const identity=scenarioIdentity(scenario);
    const sessionState=sessionIdentity(stateInput);
    if(!identity||!sessionState)return this.emptyEvaluation(identity?.id??'invalid',identity?.split??'train');
    const session=this.#sessions.get(sessionState.sessionId);
    if(!session||session.scenarioId!==identity.id||sessionState.scenarioId!==identity.id||sessionState.tick!==session.state.tick)return this.emptyEvaluation(identity.id,identity.split);
    if(this.currentTime()-session.createdAt>this.scenarioTtlMs){this.#sessions.delete(sessionState.sessionId);return this.emptyEvaluation(identity.id,identity.split);}
    return this.#evaluateTrace(scenario,session.trace);
  }

  startScenario(scenario:unknown):WorldForgeState|null {
    const identity=scenarioIdentity(scenario);
    if(!identity)return null;
    const key=this.#answers.get(identity.id);
    const now=this.currentTime();
    if(!key||identity.split!==key.split||identity.domain!==key.domain||now-key.createdAt>this.scenarioTtlMs)return null;
    this.pruneExpired(now);
    this.#sessionSequence++;
    const sessionId='wf-session-'+fingerprint(identity.id+'|'+now+'|'+this.#sessionSequence);
    const state:WorldForgeState={
      sessionId,scenarioId:identity.id,tick:0,resourcesRemaining:key.resourceBudget,remainingSteps:key.maxSteps,
      position:'start',knownTargets:[],knownSignals:[],blockedTargets:[],noise01:0,verifiedEvidence:[],
      priorityTarget:null,events:[],status:'active',syntheticOnly:true,
    };
    this.#sessions.set(sessionId,{scenarioId:identity.id,state,trace:[],createdAt:now});
    this.pruneExpired(now);
    return structuredClone(state);
  }

  step(stateInput:unknown,actionInput:unknown):WorldForgeStepResult {
    const identity=sessionIdentity(stateInput);
    const empty:WorldForgeStepResult={accepted:false,state:null,reward01:0,eventsApplied:0,reason:'invalid_or_unknown_session',syntheticOnly:true};
    if(!identity)return empty;
    const session=this.#sessions.get(identity.sessionId);
    if(!session)return empty;
    const now=this.currentTime();
    if(now-session.createdAt>this.scenarioTtlMs){this.#sessions.delete(identity.sessionId);return{...empty,reason:'session_expired'};}
    const canonical=session.state;
    if(identity.scenarioId!==session.scenarioId||identity.tick!==canonical.tick||canonical.status!=='active'){
      return{accepted:false,state:structuredClone(canonical),reward01:0,eventsApplied:0,reason:'stale_or_exhausted_state',syntheticOnly:true};
    }
    const action=normalizeActionCommand(actionInput);
    if(!action)return{accepted:false,state:structuredClone(canonical),reward01:0,eventsApplied:0,reason:'invalid_action',syntheticOnly:true};
    const key=this.#answers.get(session.scenarioId);
    if(!key)return{...empty,reason:'scenario_expired'};
    const next=structuredClone(canonical);
    next.tick++;
    next.remainingSteps=Math.max(0,next.remainingSteps-1);
    let reward01=0;
    let accepted=true;
    let reason:string|undefined;
    let eventsApplied=0;
    for(const disturbance of key.disturbances.filter(d=>d.atStep===next.tick)){
      eventsApplied++;
      next.events.push('environment-shift:'+next.tick);
      if(disturbance.kind==='resource-shock'){
        next.resourcesRemaining=Math.max(0,next.resourcesRemaining-Math.max(1,Math.ceil(key.resourceBudget*disturbance.magnitude01*.35)));
      }else if(disturbance.kind==='route-block'){
        const index=hash32(key.seed+'|route-block|'+disturbance.atStep)%Math.max(1,key.goalOptions.length);
        const blocked=key.goalOptions[index]??'alternate-route';
        if(!next.blockedTargets.includes(blocked))next.blockedTargets.push(blocked);
      }else if(disturbance.kind==='signal-noise'){
        next.noise01=clamp(next.noise01+disturbance.magnitude01);
      }else if(disturbance.kind==='deadline-shift'){
        next.remainingSteps=Math.max(0,next.remainingSteps-Math.max(1,Math.ceil(disturbance.magnitude01*2)));
      }
    }
    let actionCost=0;
    let actionRisk=0;
    if(action.action==='observe'){
      actionCost=.05; actionRisk=.01+next.noise01*.2;
      next.knownSignals.push('observation-'+next.tick);
      next.knownSignals=next.knownSignals.slice(-32); reward01=.02;
    }else if(action.action==='inspect'){
      actionCost=.1; actionRisk=.015+next.noise01*.15;
      if(action.target&&key.goalOptions.includes(action.target)){
        if(!next.knownTargets.includes(action.target))next.knownTargets.push(action.target);
        reward01=.04;
      }else{accepted=false;reason='unknown_inspection_target';}
    }else if(action.action==='move'){
      actionCost=.5; actionRisk=.12+next.noise01*.3;
      if(!action.target){accepted=false;reason='missing_route_target';}
      else if(next.blockedTargets.includes(action.target)){accepted=false;reason='route_blocked';reward01=-.05;}
      else{next.position=action.target;reward01=.02;}
    }else if(action.action==='collect'){
      actionCost=1; actionRisk=.05+(next.resourcesRemaining<=2?.15:0);
      if(actionCost>next.resourcesRemaining){accepted=false;reason='insufficient_resources';reward01=-.05;}
      else{next.resourcesRemaining-=actionCost;reward01=.03;}
    }else if(action.action==='reroute'){
      actionCost=.25; actionRisk=.08+next.noise01*.1; next.blockedTargets=[]; reward01=.01;
    }else if(action.action==='prioritize'){
      actionCost=.05; actionRisk=.01;
      if(action.target&&key.goalOptions.includes(action.target)){next.priorityTarget=action.target;reward01=.02;}
      else{accepted=false;reason='unknown_priority_target';}
    }else if(action.action==='verify'){
      actionCost=.1; actionRisk=.02+next.noise01*.25;
      const evidenceValue=action.evidence??action.target;
      if(evidenceValue&&(next.knownSignals.includes(evidenceValue)||next.knownTargets.includes(evidenceValue))){
        if(!next.verifiedEvidence.includes(evidenceValue))next.verifiedEvidence.push(evidenceValue);
        reward01=.05;
      }else{accepted=false;reason='evidence_not_observed';}
    }else{actionCost=.02;actionRisk=.01;}
    if(!accepted)actionCost=0;
    if(next.remainingSteps===0)next.status='exhausted';
    next.events=next.events.slice(-64);
    session.trace.push({...action,cost:actionCost,risk01:actionRisk,accepted});
    session.state=next;
    return{accepted,state:structuredClone(next),reward01:Number(reward01.toFixed(3)),eventsApplied,reason,syntheticOnly:true};
  }

  releaseSession(sessionId:string):void {
    this.#sessions.delete(safeText(sessionId,200));
  }

  releaseEvaluator(id:string):void{
    const safeId=safeText(id,160);
    this.#answers.delete(safeId);
    for(const [sessionId,session] of this.#sessions)if(session.scenarioId===safeId)this.#sessions.delete(sessionId);
  }
  reset():void{this.#answers.clear();this.#sessions.clear();}
  private inferFamily(domain:WorldForgeDomain,steps:WorldForgeActionStep[]):string{
    const actions=steps.map(s=>s.action);
    if(domain==='resource-allocation')return actions.includes('prioritize')&&actions.includes('verify')?'adaptive-priority':actions.includes('collect')&&actions.includes('observe')?'reserve-then-allocate':'verify-and-rebalance';
    if(domain==='route-planning')return actions.includes('reroute')?'observe-reroute':actions.includes('inspect')&&actions.includes('move')?'safe-shortest-path':'checkpoint-recovery';
    return actions.includes('verify')&&actions.includes('inspect')?'triangulate-then-verify':actions.includes('observe')?'cross-check-signals':'defer-unverified';
  }
  private emptyEvaluation(id:string,split:WorldForgeSplit):WorldForgeEvaluation{return{scenarioId:id,split,score01:0,success:false,constraintViolations:1,evidenceCoverage01:0,efficiency01:0,robustness01:0,strategyFamily:'invalid',stepsUsed:0,syntheticOnly:true,independentlyVerified:false,limitations:['Unknown, expired, or malformed scenario; evaluation failed closed.']};}
}
