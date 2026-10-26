import type { RealityOutcomeSource } from './RealityGroundingController.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface RealityLearningDecision {
  source:RealityOutcomeSource;
  evidence01:number;
  verified01:number;
  independent01:number;
  consequence01:number;
  learningScale01:number;
  neuralUpdateScale01:number;
  worldModelUpdateScale01:number;
  memoryPromotionScale01:number;
  identityUpdateScale01:number;
  reward01:number;
  surprise01:number;
  success01:number;
  reason:string;
}

export interface RealityLearningGateState {
  version:1;
  decisions:number;
  externalDecisions:number;
  simulationDecisions:number;
  attenuatedDecisions:number;
  strongDecisions:number;
  meanLearningScale01:number;
  meanNeuralUpdateScale01:number;
  meanWorldModelUpdateScale01:number;
  meanMemoryPromotionScale01:number;
  meanIdentityUpdateScale01:number;
  last:RealityLearningDecision|null;
  history:RealityLearningDecision[];
}


const nonNegativeSafeInteger=(value:unknown,fallback:number):number=>
  typeof value==='number' && Number.isSafeInteger(value) && value>=0 ? value : fallback;
const finiteScoreOr=(value:unknown,fallback:number):number=>
  typeof value==='number' && Number.isFinite(value) ? clamp(value) : fallback;

const DECISION_SCORE_FIELDS=[
  'evidence01','verified01','independent01','consequence01','learningScale01',
  'neuralUpdateScale01','worldModelUpdateScale01','memoryPromotionScale01',
  'identityUpdateScale01','reward01','surprise01','success01',
] as const;

function normalizeDecision(value:unknown):RealityLearningDecision|null {
  if(!value || typeof value!=='object' || Array.isArray(value)) return null;
  const row=value as Record<string,unknown>;
  if(row.source!=='external' && row.source!=='simulation') return null;
  if(typeof row.reason!=='string') return null;
  const normalized:Record<string,number>={};
  for(const key of DECISION_SCORE_FIELDS){
    const score=row[key];
    if(typeof score!=='number' || !Number.isFinite(score)) return null;
    normalized[key]=clamp(score);
  }
  return {
    source:row.source,
    evidence01:normalized.evidence01!,
    verified01:normalized.verified01!,
    independent01:normalized.independent01!,
    consequence01:normalized.consequence01!,
    learningScale01:normalized.learningScale01!,
    neuralUpdateScale01:normalized.neuralUpdateScale01!,
    worldModelUpdateScale01:normalized.worldModelUpdateScale01!,
    memoryPromotionScale01:normalized.memoryPromotionScale01!,
    identityUpdateScale01:normalized.identityUpdateScale01!,
    reward01:normalized.reward01!,
    surprise01:normalized.surprise01!,
    success01:normalized.success01!,
    reason:row.reason.slice(0,400),
  };
}
function sameDecision(a:RealityLearningDecision,b:RealityLearningDecision):boolean {
  return a.source===b.source && a.reason===b.reason &&
    DECISION_SCORE_FIELDS.every(key=>a[key]===b[key]);
}

export const defaultRealityLearningGateState=():RealityLearningGateState=>({
  version:1,decisions:0,externalDecisions:0,simulationDecisions:0,attenuatedDecisions:0,strongDecisions:0,
  meanLearningScale01:.42,meanNeuralUpdateScale01:.42,meanWorldModelUpdateScale01:.35,
  meanMemoryPromotionScale01:.30,meanIdentityUpdateScale01:.20,last:null,history:[],
});

/**
 * P2840: evidence-weighted learning gate.
 *
 * The organism may observe a real device action without having independently
 * verified its downstream effect. This gate prevents low-evidence receipts from
 * changing long-lived world/identity state as strongly as verified observations.
 * Simulation can still teach the simulator and keep the predictive substrate warm,
 * but it is deliberately weaker for cross-reality learning and identity updates.
 */
export class RealityLearningGate {
  private state=defaultRealityLearningGateState();
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<RealityLearningGateState>|null){
    const d=defaultRealityLearningGateState();
    const r:any=raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const externalDecisions=nonNegativeSafeInteger(r.externalDecisions,d.externalDecisions);
    const simulationDecisions=nonNegativeSafeInteger(r.simulationDecisions,d.simulationDecisions);
    const minimumDecisionTotal=Math.min(Number.MAX_SAFE_INTEGER,externalDecisions+simulationDecisions);
    const decisions=Math.max(nonNegativeSafeInteger(r.decisions,d.decisions),minimumDecisionTotal);
    const validHistory=Array.isArray(r.history)
      ? r.history.map(normalizeDecision).filter((row):row is RealityLearningDecision=>row!==null).slice(0,256)
      : [];
    const normalizedLast=normalizeDecision(r.last);
    const last=normalizedLast??validHistory[0]??null;
    const history=last
      ? validHistory.length && sameDecision(validHistory[0]!,last)
        ? validHistory
        : [last,...validHistory.filter(row=>!sameDecision(row,last))].slice(0,256)
      : validHistory;
    this.state={
      version:1,
      decisions,
      externalDecisions,
      simulationDecisions,
      attenuatedDecisions:Math.min(decisions,nonNegativeSafeInteger(r.attenuatedDecisions,d.attenuatedDecisions)),
      strongDecisions:Math.min(decisions,nonNegativeSafeInteger(r.strongDecisions,d.strongDecisions)),
      meanLearningScale01:finiteScoreOr(r.meanLearningScale01,d.meanLearningScale01),
      meanNeuralUpdateScale01:finiteScoreOr(r.meanNeuralUpdateScale01,d.meanNeuralUpdateScale01),
      meanWorldModelUpdateScale01:finiteScoreOr(r.meanWorldModelUpdateScale01,d.meanWorldModelUpdateScale01),
      meanMemoryPromotionScale01:finiteScoreOr(r.meanMemoryPromotionScale01,d.meanMemoryPromotionScale01),
      meanIdentityUpdateScale01:finiteScoreOr(r.meanIdentityUpdateScale01,d.meanIdentityUpdateScale01),
      last,
      history,
    };
  }
  refineLatest(patch:{memoryPromotionScale01?:number;identityUpdateScale01?:number;learningScale01?:number;reason?:string}){
    const last=this.state.last;
    if(!last) return null;
    const memory=patch.memoryPromotionScale01==null?last.memoryPromotionScale01:clamp(patch.memoryPromotionScale01);
    const identity=patch.identityUpdateScale01==null?last.identityUpdateScale01:clamp(patch.identityUpdateScale01);
    const learning=patch.learningScale01==null?last.learningScale01:clamp(patch.learningScale01);
    const next={...last,memoryPromotionScale01:memory,identityUpdateScale01:identity,learningScale01:learning,reason:patch.reason??last.reason};
    this.state.last=next;
    if(this.state.history.length)this.state.history=[next,...this.state.history.slice(1)];
    return structuredClone(next);
  }

  decide(input:{
    source:RealityOutcomeSource;
    evidence01:number;
    verified01:number;
    independent01:number;
    consequence01:number;
    predictionError01:number;
    surprise01:number;
    reward01:number;
    success01:number;
    actuation:boolean;
    resource01:number;
  }):RealityLearningDecision{
    const evidence=clamp(input.evidence01);
    const verified=clamp(input.verified01);
    const independent=clamp(input.independent01);
    const consequence=clamp(input.consequence01);
    const predictionError=clamp(input.predictionError01);
    const surprise=clamp(input.surprise01);
    const resource=clamp(input.resource01);
    const external=input.source==='external';

    const evidenceStrength=clamp(.46*evidence+.26*verified+.18*independent+.10*consequence);
    const surpriseValue=clamp(.65*surprise+.35*predictionError);
    const computePenalty=resource<.20 ? .16 : resource<.35 ? .08 : 0;

    let neural=.34+.46*evidenceStrength+.12*surpriseValue-computePenalty;
    let world=.26+.50*evidenceStrength+.12*surpriseValue-computePenalty;
    let memory=.16+.54*evidenceStrength+.16*surpriseValue-computePenalty;
    let identity=.06+.56*evidenceStrength+.18*(verified*independent)-computePenalty*.8;

    if(!external){
      neural*=.72;
      world*=.58;
      memory*=.46;
      identity*=.28;
      // A simulated outcome is never external ground truth. Even a highly
      // internally consistent simulation must remain capped as a source of
      // long-lived autobiographical/identity change until reality supplies
      // independent evidence through the external path.
      memory=Math.min(memory,.40);
      identity=Math.min(identity,.08);
    }
    if(input.actuation && verified<.5){
      // A device command receipt is evidence that a command executed, not evidence
      // that its intended external effect happened.
      neural*=.82;
      world*=.72;
      memory*=.58;
      identity*=.35;
    }

    neural=clamp(neural); world=clamp(world); memory=clamp(memory); identity=clamp(identity);
    const learning=clamp(.44*neural+.30*world+.18*memory+.08*identity);
    const reward=clamp(.5+(clamp(input.reward01)-.5)*learning);
    const gatedSurprise=clamp(surprise*(.45+.55*learning));
    const success=clamp(.5+(clamp(input.success01)-.5)*learning);
    const reason=!external
      ? 'simulation-teaches-predictive-substrate-with-reduced-cross-reality-promotion'
      : input.actuation&&verified<.5
        ? 'external-actuation-receipt-without-independent-effect-proof;identity-and-memory-updates-attenuated'
        : verified>.5&&independent>.5
          ? 'externally-grounded-and-independently-verified-learning-path'
          : 'external-grounding-present-but-verification-strength-is-partial';
    const row:RealityLearningDecision={source:input.source,evidence01:evidence,verified01:verified,independent01:independent,consequence01:consequence,learningScale01:learning,neuralUpdateScale01:neural,worldModelUpdateScale01:world,memoryPromotionScale01:memory,identityUpdateScale01:identity,reward01:reward, surprise01:gatedSurprise, success01:success, reason};
    this.state.decisions++;
    if(external)this.state.externalDecisions++;else this.state.simulationDecisions++;
    if(learning<.48)this.state.attenuatedDecisions++; else if(learning>.72)this.state.strongDecisions++;
    const a=.08;
    this.state.meanLearningScale01=clamp(this.state.meanLearningScale01*(1-a)+learning*a);
    this.state.meanNeuralUpdateScale01=clamp(this.state.meanNeuralUpdateScale01*(1-a)+neural*a);
    this.state.meanWorldModelUpdateScale01=clamp(this.state.meanWorldModelUpdateScale01*(1-a)+world*a);
    this.state.meanMemoryPromotionScale01=clamp(this.state.meanMemoryPromotionScale01*(1-a)+memory*a);
    this.state.meanIdentityUpdateScale01=clamp(this.state.meanIdentityUpdateScale01*(1-a)+identity*a);
    this.state.last=row; this.state.history=[row,...this.state.history].slice(0,256);
    return structuredClone(row);
  }
  diagnostics(){
    return {decisions:this.state.decisions,externalDecisions:this.state.externalDecisions,simulationDecisions:this.state.simulationDecisions,attenuatedDecisions:this.state.attenuatedDecisions,strongDecisions:this.state.strongDecisions,meanLearningScale01:this.state.meanLearningScale01,meanNeuralUpdateScale01:this.state.meanNeuralUpdateScale01,meanWorldModelUpdateScale01:this.state.meanWorldModelUpdateScale01,meanMemoryPromotionScale01:this.state.meanMemoryPromotionScale01,meanIdentityUpdateScale01:this.state.meanIdentityUpdateScale01};
  }
}
