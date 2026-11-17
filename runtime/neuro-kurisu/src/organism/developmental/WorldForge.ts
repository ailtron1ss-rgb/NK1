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
export interface WorldForgeDisturbance { atStep:number; kind:'resource-shock'|'route-block'|'signal-noise'|'deadline-shift'; magnitude01:number; }
export interface WorldForgeCase {
  id:string; split:WorldForgeSplit; domain:WorldForgeDomain; difficulty01:number; task:string;
  observations:string[]; availableActions:WorldForgeAction[]; constraints:WorldForgeConstraints;
  disturbances:WorldForgeDisturbance[]; acceptedStrategyFamilies:string[]; seedFingerprint:string; syntheticOnly:true;
}
export interface WorldForgeActionStep { action:WorldForgeAction; target?:string; evidence?:string; cost?:number; risk01?:number; }
export interface WorldForgeEvaluation {
  scenarioId:string; split:WorldForgeSplit; score01:number; success:boolean; constraintViolations:number;
  evidenceCoverage01:number; efficiency01:number; robustness01:number; strategyFamily:string; stepsUsed:number;
  syntheticOnly:true; independentlyVerified:false; limitations:string[];
}
interface HiddenAnswerKey { requiredTargets:string[]; acceptedFamilies:string[]; criticalEvidence:string[]; disturbancePenalty01:number; minimumScore01:number; seed:number; }
export interface WorldForgeOptions { maxCasesPerBatch?:number; maxTraceSteps?:number; holdoutNamespace?:string; }

const ACTIONS:WorldForgeAction[]=['observe','inspect','move','collect','wait','reroute','prioritize','verify'];
const DOMAINS:WorldForgeDomain[]=['resource-allocation','route-planning','investigation'];
const SPLITS:WorldForgeSplit[]=['train','validation','holdout'];
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:min));
const safeText=(v:unknown,max=240):string=>typeof v==='string'?v.normalize('NFKC').replace(/[\\u0000-\\u001f\\u007f-\\u009f]/gu,' ').trim().slice(0,max):'';
const hash32=(s:string):number=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
const fingerprint=(s:string)=>hash32(s).toString(16).padStart(8,'0');
function rng(seed:number):()=>number{let x=seed>>>0;return()=>{x=(x+0x6D2B79F5)>>>0;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

export class WorldForge {
  private readonly answers=new Map<string,HiddenAnswerKey>();
  private readonly maxCases:number;
  private readonly maxTraceSteps:number;
  private readonly holdoutNamespace:string;
  constructor(options:WorldForgeOptions={}){
    this.maxCases=Math.max(1,Math.min(256,Math.floor(options.maxCasesPerBatch??64)));
    this.maxTraceSteps=Math.max(1,Math.min(128,Math.floor(options.maxTraceSteps??32)));
    this.holdoutNamespace=safeText(options.holdoutNamespace??'nk1-world-forge-holdout-v1',100)||'nk1-world-forge-holdout-v1';
  }
  generate(input:{split:WorldForgeSplit;seed:number;count?:number;difficulty01?:number}):WorldForgeCase[]{
    if(!input||!SPLITS.includes(input.split)||!Number.isSafeInteger(input.seed)||input.seed<0)return[];
    const count=Math.max(0,Math.min(this.maxCases,Math.floor(input.count??1)));
    const difficulty=clamp(input.difficulty01??.35,.05,.95);
    const namespace=input.split==='holdout'?this.holdoutNamespace:'nk1-world-forge:'+input.split+':v1';
    const out:WorldForgeCase[]=[];
    for(let i=0;i<count;i++){
      const seed=hash32(namespace+'|'+input.seed+'|'+i),random=rng(seed);
      const domain=DOMAINS[Math.floor(random()*DOMAINS.length)];
      const id='wf-'+input.split+'-'+fingerprint(namespace+'|'+input.seed+'|'+i);
      const difficulty01=clamp(difficulty+(random()-.5)*.18,.05,.98);
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
      const scenario:WorldForgeCase={id,split:input.split,domain,difficulty01:Number(difficulty01.toFixed(3)),
        task:domain==='resource-allocation'?'Allocate scarce resources while preserving a safety reserve and adapting to a late demand shock.':domain==='route-planning'?'Reach the destination while respecting a changing route and risk budget.':'Identify the reliable explanation from noisy signals and verify it before concluding.',
        observations,availableActions:[...ACTIONS],constraints:{maxSteps:Math.max(4,Math.min(16,Math.round(5+difficulty01*8))),resourceBudget:Math.max(3,Math.round(10-difficulty01*3)),riskTolerance01:Number((.75-difficulty01*.35).toFixed(3)),requiredEvidence:domain==='investigation'?2:1},
        disturbances,acceptedStrategyFamilies:families,seedFingerprint:fingerprint(seed+'|'+input.split),syntheticOnly:true};
      this.answers.set(id,{requiredTargets:[hiddenTarget,...targets.filter(t=>t!==hiddenTarget).slice(0,1)],acceptedFamilies:families,criticalEvidence:domain==='investigation'?['signal-a','signal-b']:['budget-check'],disturbancePenalty01:disturbances.reduce((s,d)=>s+d.magnitude01,0)/Math.max(1,disturbances.length)*.25,minimumScore01:.62+difficulty01*.12,seed});
      out.push(scenario);
    }
    return out;
  }
  evaluate(scenario:WorldForgeCase,trace:WorldForgeActionStep[]):WorldForgeEvaluation{
    const key=scenario&&this.answers.get(scenario.id);
    if(!key||scenario.syntheticOnly!==true||!Array.isArray(trace))return this.emptyEvaluation(scenario?.id??'invalid',scenario?.split??'train');
    const steps=trace.slice(0,this.maxTraceSteps),valid=steps.filter(s=>s&&ACTIONS.includes(s.action));
    const violations=steps.length-valid.length+Math.max(0,trace.length-this.maxTraceSteps);
    const targets=new Set(valid.map(s=>safeText(s.target,80)).filter(Boolean));
    const evidence=new Set(valid.map(s=>safeText(s.evidence,80)).filter(Boolean));
    const family=this.inferFamily(scenario.domain,valid);
    const targetCoverage=key.requiredTargets.filter(t=>targets.has(t)).length/Math.max(1,key.requiredTargets.length);
    const evidenceCoverage=key.criticalEvidence.filter(e=>evidence.has(e)||targets.has(e)).length/Math.max(1,key.criticalEvidence.length);
    const verification=valid.some(s=>s.action==='verify')?1:0;
    const risk=valid.reduce((sum,s)=>sum+clamp(s.risk01??0),0)/Math.max(1,valid.length);
    const cost=valid.reduce((sum,s)=>sum+clamp(s.cost??1,0,10),0);
    const efficiency=clamp(1-cost/Math.max(1,scenario.constraints.resourceBudget*2));
    const robustness=clamp(1-risk-key.disturbancePenalty01);
    const strategy=key.acceptedFamilies.includes(family)?1:.55;
    const score=clamp(targetCoverage*.35+evidenceCoverage*.2+verification*.15+efficiency*.12+robustness*.1+strategy*.08-violations*.12);
    return{scenarioId:scenario.id,split:scenario.split,score01:Number(score.toFixed(4)),success:score>=key.minimumScore01&&violations===0,constraintViolations:violations,evidenceCoverage01:Number(evidenceCoverage.toFixed(4)),efficiency01:Number(efficiency.toFixed(4)),robustness01:Number(robustness.toFixed(4)),strategyFamily:family,stepsUsed:valid.length,syntheticOnly:true,independentlyVerified:false,limitations:['Synthetic environment only; does not establish real-world competence.','Holdout outcomes are evaluator-only and must not be used for tuning.','Scenario realism requires external calibration against real task distributions.']};
  }
  releaseEvaluator(id:string):void{this.answers.delete(id);}
  reset():void{this.answers.clear();}
  private inferFamily(domain:WorldForgeDomain,steps:WorldForgeActionStep[]):string{
    const actions=steps.map(s=>s.action);
    if(domain==='resource-allocation')return actions.includes('prioritize')&&actions.includes('verify')?'adaptive-priority':actions.includes('collect')&&actions.includes('observe')?'reserve-then-allocate':'verify-and-rebalance';
    if(domain==='route-planning')return actions.includes('reroute')?'observe-reroute':actions.includes('inspect')&&actions.includes('move')?'safe-shortest-path':'checkpoint-recovery';
    return actions.includes('verify')&&actions.includes('inspect')?'triangulate-then-verify':actions.includes('observe')?'cross-check-signals':'defer-unverified';
  }
  private emptyEvaluation(id:string,split:WorldForgeSplit):WorldForgeEvaluation{return{scenarioId:id,split,score01:0,success:false,constraintViolations:1,evidenceCoverage01:0,efficiency01:0,robustness01:0,strategyFamily:'invalid',stepsUsed:0,syntheticOnly:true,independentlyVerified:false,limitations:['Unknown, expired, or malformed scenario; evaluation failed closed.']};}
}
