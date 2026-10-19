import type { EmbodiedActionResult } from '../body/EmbodiedActionExecutor.ts';
import type { ActionKind } from '../core/types.ts';

export type RealityGroundingMode = 'simulation-only' | 'hybrid' | 'external-first';
export type RealityOutcomeSource = 'external' | 'simulation';

export interface RealityGroundingRecord {
  tick:number;
  action:ActionKind|null;
  contextKey?:string;
  source:RealityOutcomeSource;
  realityClass:string;
  status:string;
  verified01:number;
  independent01:number;
  evidence01:number;
  expectedReward01:number;
  reward01:number;
  surprise01:number;
  consequence01:number;
  consequenceError01:number;
  novelty01:number;
  predictionConfidence01:number;
  fallback:boolean;
  shadowSimulation:boolean;
  reason:string;
}

export interface RealityGroundingState {
  version:1;
  mode:RealityGroundingMode;
  steps:number;
  externalCandidates:number;
  externalPrimary:number;
  verifiedExternal:number;
  independentlyVerifiedExternal:number;
  actuationReceipts:number;
  simulatedPrimary:number;
  simulatedFallbacks:number;
  externalFailures:number;
  observationActions:number;
  actuationActions:number;
  meanGrounding01:number;
  meanEvidence01:number;
  meanIndependent01:number;
  meanConsequenceError01:number;
  meanNovelty01:number;
  meanSurprise01:number;
  calibrationError01:number;
  closedLoop01:number;
  shadowAgreement01:number;
  learningPriority01:number;
  last:RealityGroundingRecord|null;
  history:RealityGroundingRecord[];
}

export interface RealityGroundingResolution {
  source:RealityOutcomeSource;
  reward01:number;
  surprise01:number;
  success01:number;
  verified01:number;
  independent01:number;
  evidence01:number;
  consequence01:number;
  consequenceError01:number;
  learningPriority01:number;
  shadowSimulation:boolean;
  reason:string;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

const OBSERVATION_ACTIONS=new Set<ActionKind>(['explore','verify','wait','inspect' as ActionKind]);
const ACTUATION_ACTIONS=new Set<ActionKind>(['respond','rest']);

function isExternalCandidate(r:EmbodiedActionResult|null|undefined):boolean {
  if(!r) return false;
  if(r.status!=='executed') return false;
  if(r.source!=='android-termux') return false;
  return r.realityClass==='device-observation' || r.realityClass==='device-actuation';
}

function rewardFromExternal(r:EmbodiedActionResult, verified01:number, independent01:number, consequence01:number):number {
  const executed=r.status==='executed' ? 1 : 0;
  // Conservative grounding/evidence signal; this is not a task reward claim.
  return clamp(executed*.15 + verified01*.65 + independent01*.15 + consequence01*.05);
}

function surpriseFromExternal(expected01:number, consequence01:number, simulatedSurprise01:number, verified01:number):number {
  const mismatch=Math.abs(clamp(expected01)-clamp(.5+consequence01*.5));
  return clamp(.35*simulatedSurprise01+.40*mismatch+.15*(1-verified01)+.10*(1-consequence01));
}

export const defaultRealityGroundingState=():RealityGroundingState=>({
  version:1,mode:'hybrid',steps:0,externalCandidates:0,externalPrimary:0,verifiedExternal:0,independentlyVerifiedExternal:0,
  actuationReceipts:0,simulatedPrimary:0,simulatedFallbacks:0,externalFailures:0,observationActions:0,actuationActions:0,
  meanGrounding01:.15,meanEvidence01:.25,meanIndependent01:.12,meanConsequenceError01:.5,meanNovelty01:.35,meanSurprise01:.25,
  calibrationError01:.5,closedLoop01:.2,shadowAgreement01:.5,learningPriority01:.25,last:null,history:[],
});

export class RealityGroundingController {
  private state=defaultRealityGroundingState();

  snapshot(){ return structuredClone(this.state); }
  restore(raw?:Partial<RealityGroundingState>|null){
    const d=defaultRealityGroundingState(),r:any=raw??{};
    this.state={...d,...structuredClone(r),version:1,history:Array.isArray(r.history)?r.history.slice(-256):[],last:r.last?structuredClone(r.last):null,mode:r.mode==='simulation-only'||r.mode==='external-first'||r.mode==='hybrid'?r.mode:'hybrid'};
  }
  setMode(mode:RealityGroundingMode){this.state.mode=mode;}
  causalHoldoutReadiness(action:ActionKind|null, source:RealityOutcomeSource='external', minTrials=6){
    if(!action) return 0;
    const rows=this.state.history.filter(x=>x.action===action && x.source===source).slice(0,64);
    if(!rows.length) return 0;
    const n=Math.min(1,rows.length/Math.max(1,minTrials));
    const mae=rows.reduce((sum,x)=>sum+Math.abs(x.expectedReward01-x.reward01),0)/rows.length;
    const verified=rows.reduce((sum,x)=>sum+x.verified01,0)/rows.length;
    const independent=rows.reduce((sum,x)=>sum+x.independent01,0)/rows.length;
    const quality=clamp(.45*verified+.30*independent+.25*(1-mae));
    // Evidence quality cannot compensate for missing repeated trials.  The
    // coverage term therefore gates the whole readiness score instead of being
    // merely one additive contributor.  A first verified observation should
    // teach the predictive substrate, but should not immediately hard-promote
    // autobiographical identity or long-lived memory.
    return clamp(n*(.60+.40*quality));
  }

  refineLatest(patch:{verified01?:number;independent01?:number;evidence01?:number;consequence01?:number;reason?:string}){
    const last=this.state.last;
    if(!last) return null;
    const verified=patch.verified01==null?last.verified01:clamp(patch.verified01);
    const independent=patch.independent01==null?last.independent01:clamp(patch.independent01);
    const evidence=patch.evidence01==null?last.evidence01:clamp(patch.evidence01);
    const consequence=patch.consequence01==null?last.consequence01:clamp(patch.consequence01);
    const next={...last,verified01:verified,independent01:independent,evidence01:evidence,consequence01:consequence,reason:patch.reason??last.reason};
    this.state.last=next;
    if(this.state.history.length)this.state.history=[next,...this.state.history.slice(1)];
    const a=.12;
    this.state.meanEvidence01=clamp(this.state.meanEvidence01*(1-a)+evidence*a);
    this.state.meanIndependent01=clamp(this.state.meanIndependent01*(1-a)+independent*a);
    this.state.closedLoop01=clamp(this.state.closedLoop01*(1-a)+(verified*.65+independent*.35)*a);
    return structuredClone(next);
  }

  diagnostics(){ return {
    steps:this.state.steps, externalCandidates:this.state.externalCandidates, externalPrimary:this.state.externalPrimary,
    verifiedExternal:this.state.verifiedExternal, independentlyVerifiedExternal:this.state.independentlyVerifiedExternal,
    actuationReceipts:this.state.actuationReceipts, simulatedPrimary:this.state.simulatedPrimary, simulatedFallbacks:this.state.simulatedFallbacks,
    externalFailures:this.state.externalFailures, observationActions:this.state.observationActions, actuationActions:this.state.actuationActions,
    meanGrounding01:this.state.meanGrounding01, meanEvidence01:this.state.meanEvidence01, meanIndependent01:this.state.meanIndependent01,
    meanConsequenceError01:this.state.meanConsequenceError01, meanNovelty01:this.state.meanNovelty01, meanSurprise01:this.state.meanSurprise01,
    calibrationError01:this.state.calibrationError01, closedLoop01:this.state.closedLoop01, shadowAgreement01:this.state.shadowAgreement01, learningPriority01:this.state.learningPriority01
  }; }

  resolve(input:{
    tick:number;
    action:ActionKind|null;
    expectedReward01:number;
    predictionConfidence01:number;
    simulatedReward01:number;
    simulatedSurprise01:number;
    simulatedSuccess01:number;
    embodiedAction:EmbodiedActionResult|null;
    novelty01:number;
    resource01:number;
    contextKey?:string;
  }):RealityGroundingResolution {
    const r=input.embodiedAction;
    const externalCandidate=isExternalCandidate(r);
    const externalObserved=Boolean(r && r.status==='executed' && r.source==='android-termux');
    const observation=Boolean(input.action && OBSERVATION_ACTIONS.has(input.action));
    const actuation=Boolean(input.action && ACTUATION_ACTIONS.has(input.action));
    if(observation)this.state.observationActions++;
    if(actuation)this.state.actuationActions++;
    if(externalCandidate)this.state.externalCandidates++;
    if(!externalCandidate && externalObserved===false && r?.status==='failed')this.state.externalFailures++;

    let source:RealityOutcomeSource='simulation';
    let reward01=clamp(input.simulatedReward01);
    let surprise01=clamp(input.simulatedSurprise01);
    let success01=clamp(input.simulatedSuccess01);
    let verified01=0;
    let independent01=0;
    let evidence01=.18;
    let consequence01=.18;
    let reason='simulation-shadow-outcome-used-as-primary';

    if(this.state.mode!=='simulation-only' && externalCandidate){
      source='external';
      verified01=clamp(r!.consequenceVerification.verified?1:0);
      independent01=clamp(r!.consequenceVerification.independent?1:0);
      consequence01=clamp(r!.consequenceVerification.changed01);
      const effectConfidence=clamp(.65*r!.effect01+.35*consequence01);
      evidence01=clamp(.34+verified01*.28+independent01*.22+(r!.consequenceVerification.sourceStable ? .10 : 0)+effectConfidence*.06);
      reward01=rewardFromExternal(r!,verified01,independent01,consequence01);
      surprise01=surpriseFromExternal(input.expectedReward01,consequence01,input.simulatedSurprise01,verified01);
      success01=clamp(.45+.22*(r!.status==='executed'?1:0)+.18*verified01+.10*independent01+.05*consequence01);
      reason=verified01>0?'external-device-observation-primary':'external-device-action-primary-without-independent-effect-proof';
    } else if(this.state.mode==='external-first' && r && r.status!=='executed') {
      source='simulation';
      reason='external-first-requested-but-device-action-unavailable;safe-simulation-fallback';
    } else if(this.state.mode==='hybrid' && r?.status==='executed' && r.source!=='android-termux') {
      reason='hybrid-mode-host-only-embodiment;simulation-remains-primary';
    }

    const consequenceError01=clamp(Math.abs(clamp(.25+.55*input.predictionConfidence01)-consequence01));
    const predictionMismatch01=clamp(Math.abs(input.expectedReward01-reward01));
    const learningPriority01=clamp(
      .24*input.novelty01+
      .23*surprise01+
      .20*predictionMismatch01+
      .15*consequenceError01+
      .10*verified01+
      .05*independent01+
      .03*(1-input.resource01)
    );
    const shadowSimulation=source==='external';
    const record:RealityGroundingRecord={
      tick:input.tick,action:input.action,contextKey:input.contextKey,source,realityClass:r?.realityClass??'simulator',status:r?.status??'simulated',verified01,independent01,evidence01,expectedReward01:clamp(input.expectedReward01),reward01,surprise01,
      consequence01,consequenceError01,novelty01:clamp(input.novelty01),predictionConfidence01:clamp(input.predictionConfidence01),fallback:source==='simulation'&&externalCandidate,
      shadowSimulation,reason,
    };
    this.state.steps++;
    if(source==='external'){this.state.externalPrimary++;this.state.verifiedExternal+=verified01>0?1:0;this.state.independentlyVerifiedExternal+=independent01>0?1:0;if(actuation&&r?.status==='executed'&&!verified01)this.state.actuationReceipts++;}
    else {this.state.simulatedPrimary++;this.state.simulatedFallbacks+=externalCandidate?1:0;}
    const alpha=.08;
    this.state.meanGrounding01=clamp(this.state.meanGrounding01*(1-alpha)+(source==='external'?1:0)*alpha);
    this.state.meanEvidence01=clamp(this.state.meanEvidence01*(1-alpha)+evidence01*alpha);
    this.state.meanIndependent01=clamp(this.state.meanIndependent01*(1-alpha)+independent01*alpha);
    this.state.meanConsequenceError01=clamp(this.state.meanConsequenceError01*(1-alpha)+consequenceError01*alpha);
    this.state.meanNovelty01=clamp(this.state.meanNovelty01*(1-alpha)+clamp(input.novelty01)*alpha);
    this.state.meanSurprise01=clamp(this.state.meanSurprise01*(1-alpha)+surprise01*alpha);
    this.state.calibrationError01=clamp(this.state.calibrationError01*(1-alpha)+predictionMismatch01*alpha);
    this.state.closedLoop01=clamp(this.state.closedLoop01*(1-alpha)+(verified01*.65+independent01*.35)*alpha);
    this.state.shadowAgreement01=clamp(this.state.shadowAgreement01*(1-alpha)+(source==='external'?(1-predictionMismatch01):.5)*alpha);
    this.state.learningPriority01=clamp(this.state.learningPriority01*(1-alpha)+learningPriority01*alpha);
    this.state.last=record;this.state.history=[record,...this.state.history].slice(0,256);
    return {source,reward01,surprise01,success01,verified01,independent01,evidence01,consequence01,consequenceError01,learningPriority01,shadowSimulation,reason};
  }
}
