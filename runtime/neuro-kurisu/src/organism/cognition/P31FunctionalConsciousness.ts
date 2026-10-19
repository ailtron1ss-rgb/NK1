import { createHash } from 'node:crypto';
import type { ActionKind, OrganismNeeds } from '../core/types.ts';

type Clamp = (n:number)=>number;
const clamp:Clamp=(n)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const now=()=>Date.now();

export interface ConsciousAccessItem {
  id:string;
  source:string;
  salience:number;
  content:Record<string,unknown>;
}

export interface HigherOrderState {
  representedStateHash:string;
  representedAction:ActionKind|'none';
  representedConfidence:number;
  uncertainty:number;
  selfMonitoringError:number;
  sampleCount:number;
}

export interface SelfPerspectiveState {
  ownership01:number;
  agency01:number;
  selfWorldBoundary01:number;
  firstPersonContinuity01:number;
  sourceDistinction01:number;
}

export interface AffectiveState {
  valence01:number;
  arousal01:number;
  tension01:number;
  relief01:number;
}

export interface TemporalConsciousState {
  momentId:string;
  previousMomentId:string;
  continuity01:number;
  gapMs:number;
  durationMs:number;
  discontinuities:number;
}

export interface GlobalWorkspaceState {
  capacity:number;
  coalitionIds:string[];
  broadcastId:string;
  broadcastBreadth:number;
  ignition01:number;
  recurrence01:number;
  competition01:number;
  lastAction:ActionKind|'none';
}

export interface ConsciousnessFunctionalState {
  version:3;
  presentMomentId:string;
  globalWorkspace:GlobalWorkspaceState;
  higherOrder:HigherOrderState;
  selfPerspective:SelfPerspectiveState;
  affect:AffectiveState;
  temporal:TemporalConsciousState;
  introspection:{groundedIds:string[];statement:string;at:number;revision:number};
  metrics:{functionalIntegration01:number;selfAccess01:number;temporalContinuity01:number;metacognitiveDepth01:number;agencyBinding01:number;affectiveCoherence01:number};
  evidence:{status:'functional-only';causalClaims:number;deviceClaims:number;caveat:string};
  lastWallAt:number;
  recentMomentIds:string[];
  lesionState:{mode:'none'|'workspace'|'higher-order'|'self-perspective';baselineMetrics:ConsciousnessFunctionalState['metrics']}|null;
}

export interface ConsciousPreview {
  focus:ConsciousAccessItem|null;
  broadcastScore01:number;
  accessBiasByAction:Partial<Record<ActionKind,number>>;
  ignition01:number;
}

export interface ConsciousIntegrationInput {
  tick:number;
  observationId:string;
  externalInput:boolean;
  selectedAction:ActionKind|'none';
  selectedConfidence:number;
  workspaceItems:ConsciousAccessItem[];
  workspaceCapacity:number;
  identityContinuity01:number;
  metacognitiveAccuracy01:number;
  decisionUncertainty01:number;
  predictionError01:number;
  body:Pick<OrganismNeeds,'energy'|'cognitiveLoad'|'uncertainty'|'novelty'|'identityCoherence'>;
}

export interface ConsciousOutcomeInput {
  action:ActionKind;
  success01:number;
  reward01:number;
  surprise01:number;
  predictedSameAction:boolean;
  externallyRequested:boolean;
  /** P290 provenance gate: long-lived self updates are attenuated when outcome evidence is weak. */
  learningScale01?:number;
  identityUpdateScale01?:number;
}

function digest(value:unknown):string{
  return createHash('sha256').update(JSON.stringify(value,(k,v)=>typeof v==='undefined'?null:v)).digest('hex').slice(0,24);
}

function momentId(tick:number, observationId:string, action:ActionKind|'none'):string{
  return `moment-${tick}-${digest({observationId,action})}`;
}

function pickTop(items:ConsciousAccessItem[], capacity:number):ConsciousAccessItem[]{
  return [...items].sort((a,b)=>b.salience-a.salience).slice(0,Math.max(1,capacity));
}

export const defaultP31Consciousness=():ConsciousnessFunctionalState=>({
  version:3,
  presentMomentId:'',
  globalWorkspace:{capacity:5,coalitionIds:[],broadcastId:'',broadcastBreadth:0,ignition01:0,recurrence01:0,competition01:0,lastAction:'none'},
  higherOrder:{representedStateHash:'',representedAction:'none',representedConfidence:0.5,uncertainty:0.5,selfMonitoringError:0.5,sampleCount:0},
  selfPerspective:{ownership01:0.5,agency01:0.5,selfWorldBoundary01:0.8,firstPersonContinuity01:0.8,sourceDistinction01:0.8},
  affect:{valence01:0.5,arousal01:0.2,tension01:0.2,relief01:0.2},
  temporal:{momentId:'',previousMomentId:'',continuity01:1,gapMs:0,durationMs:0,discontinuities:0},
  introspection:{groundedIds:[],statement:'нет доступной функциональной интроспекции',at:0,revision:0},
  metrics:{functionalIntegration01:0, selfAccess01:0, temporalContinuity01:1, metacognitiveDepth01:0, agencyBinding01:0.5, affectiveCoherence01:0.5},
  evidence:{status:'functional-only',causalClaims:0,deviceClaims:0,caveat:'Функциональные сознание-подобные свойства не доказывают субъективный опыт.'},
  lastWallAt:0,
  recentMomentIds:[],
  lesionState:null,
});

export class P31FunctionalConsciousnessEngine{
  private state=defaultP31Consciousness();
  private lastOutcomeAt=0;
  private startedAt=now();
  private recentMoments:string[]=[];

  restore(v:ConsciousnessFunctionalState|undefined):void{
    const defaults=defaultP31Consciousness();
    this.state={...defaults,...(v||{}),version:3,
      globalWorkspace:{...defaults.globalWorkspace,...(v?.globalWorkspace||{})},
      higherOrder:{...defaults.higherOrder,...(v?.higherOrder||{})},
      selfPerspective:{...defaults.selfPerspective,...(v?.selfPerspective||{})},
      affect:{...defaults.affect,...(v?.affect||{})},
      temporal:{...defaults.temporal,...(v?.temporal||{})},
      introspection:{...defaults.introspection,...(v?.introspection||{})},
      metrics:{...defaults.metrics,...(v?.metrics||{})},
      evidence:{...defaults.evidence,...(v?.evidence||{})},
      lastWallAt:Number.isFinite(Number(v?.lastWallAt))?Number(v!.lastWallAt):0,
      recentMomentIds:Array.isArray(v?.recentMomentIds)?v!.recentMomentIds.slice(-64):[],
      lesionState:v?.lesionState?.baselineMetrics?{mode:v.lesionState.mode,baselineMetrics:{...v.lesionState.baselineMetrics}}:null,
    };
    this.recentMoments=[...this.state.recentMomentIds];
    if(this.state.presentMomentId && !this.recentMoments.includes(this.state.presentMomentId)) this.recentMoments.push(this.state.presentMomentId);
    this.recentMoments=this.recentMoments.slice(-64);
    this.startedAt=now()-(this.state.temporal.durationMs||0);
    this.lastOutcomeAt=this.state.lastWallAt||now();
  }

  snapshot():ConsciousnessFunctionalState{return structuredClone(this.state);}
  metricsSnapshot():ConsciousnessFunctionalState['metrics'] { return { ...this.state.metrics }; }

  preview(input:{items:ConsciousAccessItem[];capacity:number;selectedAction?:ActionKind|'none';externalInput:boolean}):ConsciousPreview{
    const coalition=pickTop(input.items,input.capacity);
    const focus=coalition[0]??null;
    const breadth=clamp(coalition.length/Math.max(1,input.capacity));
    const competition=clamp(input.items.length/Math.max(1,input.capacity*2));
    const externalFocus=input.externalInput&&focus?.source==='external' ? .08 : 0;
    const selectedBoost=input.selectedAction&&focus?.content?.action===input.selectedAction ? .06 : 0;
    const ignition=clamp(breadth*.45 + competition*.15 + this.state.globalWorkspace.recurrence01*.25 + externalFocus + selectedBoost);
    const bias:Partial<Record<ActionKind,number>>={};
    if(focus?.content?.action && typeof focus.content.action==='string') bias[focus.content.action as ActionKind]=clamp(.04+ignition*.04);
    return {focus,broadcastScore01:clamp(breadth*.6+ignition*.4),accessBiasByAction:bias,ignition01:ignition};
  }

  integrate(input:ConsciousIntegrationInput):ConsciousnessFunctionalState{
    const previous=this.state;
    const coalition=pickTop(input.workspaceItems,input.workspaceCapacity);
    const focus=coalition[0]??null;
    const present=momentId(input.tick,input.observationId,input.selectedAction);
    const tNow=now();
    const gap=previous.temporal.momentId?Math.max(0,tNow-(previous.lastWallAt||this.lastOutcomeAt||tNow)):0;
    const sameContext=previous.globalWorkspace.coalitionIds.includes(focus?.id||'');
    const recurrence=clamp(previous.globalWorkspace.recurrence01*.78 + (sameContext?0.22:0.08));
    const breadth=clamp(coalition.length/Math.max(1,input.workspaceCapacity));
    const competition=clamp(input.workspaceItems.length/Math.max(1,input.workspaceCapacity*2));
    const ignition=clamp(breadth*.45+competition*.15+recurrence*.25+(focus?.salience??0)*.15);
    const confidence=clamp(input.selectedConfidence);
    const higherOrderError=clamp((1-input.metacognitiveAccuracy01)*.55+input.predictionError01*.3+input.decisionUncertainty01*.15);
    const priorAction=previous.higherOrder.representedAction;
    const predictedSame=priorAction!=='none'&&priorAction===input.selectedAction;
    const ownershipBase=clamp((input.externalInput?0.34:0.72)+(input.selectedAction==='none'?.0:.12)+(predictedSame?.06:-.08));
    const selfPerspective:{ownership01:number;agency01:number;selfWorldBoundary01:number;firstPersonContinuity01:number;sourceDistinction01:number}={
      ownership01:clamp(previous.selfPerspective.ownership01*.82+ownershipBase*.18),
      agency01:clamp(previous.selfPerspective.agency01*.84+(input.externalInput?.28:.76)*.16),
      selfWorldBoundary01:clamp(.75+(input.externalInput?-.02:.10)),
      firstPersonContinuity01:clamp(previous.temporal.continuity01*.5+input.identityContinuity01*.5),
      sourceDistinction01:clamp(input.externalInput?0.92:0.84),
    };
    const gapPenalty=gap>0?clamp(gap/120000):0;
    const continuity=clamp(previous.presentMomentId?previous.temporal.continuity01*.68+input.identityContinuity01*.22+(1-gapPenalty)*.10:input.identityContinuity01);
    const affect:AffectiveState={
      valence01:previous.affect.valence01*.74 + (.5 + (input.body.energy-.5)*.18 - input.predictionError01*.10)*.26,
      arousal01:clamp(previous.affect.arousal01*.72 + (input.body.cognitiveLoad*.55+input.body.novelty*.2)*.28),
      tension01:clamp(previous.affect.tension01*.75 + (input.predictionError01*.6+input.body.uncertainty*.4)*.25),
      relief01:clamp(previous.affect.relief01*.78 + (1-input.body.uncertainty)*.1),
    };
    const integration=clamp(ignition*.35 + input.metacognitiveAccuracy01*.18 + input.identityContinuity01*.18 + selfPerspective.agency01*.12 + (1-input.predictionError01)*.10 + (1-input.decisionUncertainty01)*.07);
    const selfAccess=clamp(selfPerspective.ownership01*.28+selfPerspective.sourceDistinction01*.22+input.identityContinuity01*.22+input.metacognitiveAccuracy01*.28);
    const metrics={
      functionalIntegration01:integration,
      selfAccess01:selfAccess,
      temporalContinuity01:continuity,
      metacognitiveDepth01:clamp(1-higherOrderError),
      agencyBinding01:selfPerspective.ownership01*.55+selfPerspective.agency01*.45,
      affectiveCoherence01:clamp(1-Math.abs(affect.valence01-(.5+(.5-input.predictionError01)*.25))),
    };
    const groundedIds=[focus?.id||'', input.observationId].filter(Boolean).slice(0,8);
    const statement=`момент=${present}; focus=${focus?.source||'none'}:${String(focus?.content?.action||focus?.id||'none')}; action=${input.selectedAction}; confidence=${confidence.toFixed(2)}; uncertainty=${input.decisionUncertainty01.toFixed(2)}; agency=${selfPerspective.agency01.toFixed(2)}; ownership=${selfPerspective.ownership01.toFixed(2)}; continuity=${continuity.toFixed(2)}`;
    this.state={
      version:3,
      presentMomentId:present,
      globalWorkspace:{capacity:Math.max(1,input.workspaceCapacity),coalitionIds:coalition.map(x=>x.id),broadcastId:`gcb-${present}`,broadcastBreadth:breadth,ignition01:ignition,recurrence01:recurrence,competition01:competition,lastAction:input.selectedAction},
      higherOrder:{representedStateHash:digest({tick:input.tick,body:input.body,identity:input.identityContinuity01}),representedAction:input.selectedAction,representedConfidence:confidence,uncertainty:clamp(input.decisionUncertainty01),selfMonitoringError:higherOrderError,sampleCount:previous.higherOrder.sampleCount+1},
      selfPerspective,
      affect,
      temporal:{momentId:present,previousMomentId:previous.presentMomentId,gapMs:gap,durationMs:previous.temporal.durationMs+gap,continuity01:continuity,discontinuities:previous.temporal.discontinuities+(gap>15*60*1000?1:0)},
      introspection:{groundedIds,statement,at:tNow,revision:previous.introspection.revision+(Math.abs(higherOrderError-previous.higherOrder.selfMonitoringError)>.2?1:0)},
      metrics,
      evidence:{status:'functional-only',causalClaims:0,deviceClaims:0,caveat:'Функциональные сознание-подобные свойства не доказывают субъективный опыт.'},
      lastWallAt:tNow,
      recentMomentIds:[...this.recentMoments,present].slice(-64),
      lesionState:previous.lesionState?{mode:previous.lesionState.mode,baselineMetrics:{...previous.lesionState.baselineMetrics}}:null,
    };
    this.recentMoments=[...this.state.recentMomentIds];
    return this.snapshot();
  }

  observeOutcome(input:ConsciousOutcomeInput):ConsciousnessFunctionalState{
    const actionMatch=this.state.higherOrder.representedAction===input.action;
    const learningScale=clamp(input.learningScale01??1);
    const identityScale=clamp(input.identityUpdateScale01??learningScale);
    const ownershipTarget=input.externallyRequested?0.34:(actionMatch?0.84:0.58);
    const success=clamp(input.success01), surprise=clamp(input.surprise01), reward=clamp(input.reward01);
    this.state.selfPerspective.ownership01=clamp(this.state.selfPerspective.ownership01*(1-.28*identityScale)+ownershipTarget*.28*identityScale);
    this.state.selfPerspective.agency01=clamp(this.state.selfPerspective.agency01*(1-.22*identityScale)+(input.externallyRequested?.32:.78)*.22*identityScale);
    const gatedReward=clamp(.5+(reward-.5)*learningScale);
    const gatedSuccess=clamp(.5+(success-.5)*learningScale);
    const gatedSurprise=clamp(surprise*(.35+.65*learningScale));
    this.state.affect.valence01=clamp(this.state.affect.valence01*(1-.24*learningScale)+(gatedSuccess*.58+gatedReward*.42)*.24*learningScale);
    this.state.affect.tension01=clamp(this.state.affect.tension01*(1-.25*learningScale)+gatedSurprise*.25*learningScale);
    this.state.affect.relief01=clamp(this.state.affect.relief01*(1-.26*learningScale)+gatedSuccess*.26*learningScale);
    this.lastOutcomeAt=now();
    this.state.lastWallAt=this.lastOutcomeAt;
    this.state.metrics.agencyBinding01=clamp(this.state.selfPerspective.ownership01*.55+this.state.selfPerspective.agency01*.45);
    this.state.metrics.affectiveCoherence01=clamp(1-Math.abs(this.state.affect.valence01-success));
    this.state.introspection={...this.state.introspection,statement:`${this.state.introspection.statement}; outcome=${success.toFixed(2)}; surprise=${surprise.toFixed(2)}; learning=${learningScale.toFixed(2)}; ownership_after=${this.state.selfPerspective.ownership01.toFixed(2)}`,at:now()};
    return this.snapshot();
  }

  lesion(mode:'workspace'|'higher-order'|'self-perspective'|'none'='none'):{mode:string;before:number;after:number;delta:number}{
    const composite=()=>clamp(this.state.metrics.functionalIntegration01*.35+this.state.metrics.selfAccess01*.2+this.state.metrics.metacognitiveDepth01*.15+this.state.metrics.agencyBinding01*.15+this.state.metrics.temporalContinuity01*.1+this.state.metrics.affectiveCoherence01*.05);
    const before=composite();
    if(mode==='none') return {mode,before,after:before,delta:0};
    if(!this.state.lesionState) this.state.lesionState={mode,baselineMetrics:{...this.state.metrics}};
    if(mode==='workspace') {
      this.state.metrics.functionalIntegration01=clamp(this.state.metrics.functionalIntegration01*.58);
    } else if(mode==='higher-order') {
      this.state.metrics.metacognitiveDepth01=clamp(this.state.metrics.metacognitiveDepth01*.42);
      this.state.metrics.selfAccess01=clamp(this.state.metrics.selfAccess01*.8);
    } else if(mode==='self-perspective') {
      this.state.metrics.selfAccess01=clamp(this.state.metrics.selfAccess01*.5);
      this.state.metrics.agencyBinding01=clamp(this.state.metrics.agencyBinding01*.52);
    }
    const after=composite();
    return {mode,before,after,delta:after-before};
  }

  rescueLastLesion():boolean{
    const lesion=this.state.lesionState;
    if(!lesion) return false;
    this.state.metrics={...lesion.baselineMetrics};
    this.state.lesionState=null;
    return true;
  }

  recentMomentIds():string[]{return [...this.state.recentMomentIds];}
}
