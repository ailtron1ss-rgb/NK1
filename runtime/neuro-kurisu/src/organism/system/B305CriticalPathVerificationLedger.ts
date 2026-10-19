import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finite=(x:unknown,d=0)=>Number.isFinite(Number(x))?Number(x):d;

export interface B305CriticalPathRecord{
  tick:number;
  action:ActionKind;
  neuralUpdate:boolean;
  causalBridge:boolean;
  personalityUpdate:boolean;
  policyShift:boolean;
  verifiedOutcome:boolean;
  autonomousOutcome:boolean;
  persisted:boolean;
  holdoutNovel:boolean;
  neuralLearningUpdates:number;
  synapticUpdates:number;
  personalityLearningUpdates:number;
  verifiedUpdates:number;
  actionBiasMagnitude01:number;
}

export interface B305CriticalPathState{
  version:1;
  cycles:number;
  neuralUpdateCycles:number;
  causalBridgeCycles:number;
  personalityUpdateCycles:number;
  policyShiftCycles:number;
  verifiedOutcomeCycles:number;
  autonomousOutcomeCycles:number;
  persistenceChecks:number;
  holdoutNovelCycles:number;
  firstNeuralLearningUpdates:number;
  firstSynapticUpdates:number;
  firstPersonalityLearningUpdates:number;
  firstVerifiedUpdates:number;
  lastActionBiasMagnitude01:number;
  edgeIntegrity01:number;
  neuralToCausal01:number;
  causalToPersonality01:number;
  personalityToPolicy01:number;
  policyToOutcome01:number;
  outcomeToPersistence01:number;
  independentHoldoutCoverage01:number;
  records:B305CriticalPathRecord[];
}

export const defaultB305CriticalPathState=():B305CriticalPathState=>({
  version:1,cycles:0,neuralUpdateCycles:0,causalBridgeCycles:0,personalityUpdateCycles:0,policyShiftCycles:0,
  verifiedOutcomeCycles:0,autonomousOutcomeCycles:0,persistenceChecks:0,holdoutNovelCycles:0,
  firstNeuralLearningUpdates:0,firstSynapticUpdates:0,firstPersonalityLearningUpdates:0,firstVerifiedUpdates:0,
  lastActionBiasMagnitude01:0,edgeIntegrity01:0,neuralToCausal01:0,causalToPersonality01:0,
  personalityToPolicy01:0,policyToOutcome01:0,outcomeToPersistence01:0,independentHoldoutCoverage01:0,records:[]
});

/**
 * B305 is evaluation-only. It does not learn, select actions, or create a second
 * personality. It records whether the existing neural -> causal -> personality ->
 * policy -> outcome -> persistence chain actually propagates measurable state change.
 */
export class B305CriticalPathVerificationLedger{
  private state=defaultB305CriticalPathState();
  restore(raw?:Partial<B305CriticalPathState>|null){
    const d=defaultB305CriticalPathState(),r:any=raw??{};
    this.state={...d,...r,version:1,
      cycles:Math.max(0,Math.floor(finite(r.cycles))),
      neuralUpdateCycles:Math.max(0,Math.floor(finite(r.neuralUpdateCycles))),
      causalBridgeCycles:Math.max(0,Math.floor(finite(r.causalBridgeCycles))),
      personalityUpdateCycles:Math.max(0,Math.floor(finite(r.personalityUpdateCycles))),
      policyShiftCycles:Math.max(0,Math.floor(finite(r.policyShiftCycles))),
      verifiedOutcomeCycles:Math.max(0,Math.floor(finite(r.verifiedOutcomeCycles))),
      autonomousOutcomeCycles:Math.max(0,Math.floor(finite(r.autonomousOutcomeCycles))),
      persistenceChecks:Math.max(0,Math.floor(finite(r.persistenceChecks))),
      holdoutNovelCycles:Math.max(0,Math.floor(finite(r.holdoutNovelCycles))),
      firstNeuralLearningUpdates:Math.max(0,Math.floor(finite(r.firstNeuralLearningUpdates))),
      firstSynapticUpdates:Math.max(0,Math.floor(finite(r.firstSynapticUpdates))),
      firstPersonalityLearningUpdates:Math.max(0,Math.floor(finite(r.firstPersonalityLearningUpdates))),
      firstVerifiedUpdates:Math.max(0,Math.floor(finite(r.firstVerifiedUpdates))),
      lastActionBiasMagnitude01:clamp01(finite(r.lastActionBiasMagnitude01)),
      edgeIntegrity01:clamp01(finite(r.edgeIntegrity01)),
      neuralToCausal01:clamp01(finite(r.neuralToCausal01)),
      causalToPersonality01:clamp01(finite(r.causalToPersonality01)),
      personalityToPolicy01:clamp01(finite(r.personalityToPolicy01)),
      policyToOutcome01:clamp01(finite(r.policyToOutcome01)),
      outcomeToPersistence01:clamp01(finite(r.outcomeToPersistence01)),
      independentHoldoutCoverage01:clamp01(finite(r.independentHoldoutCoverage01)),
      records:Array.isArray(r.records)?r.records.slice(-96):[]};
  }
  snapshot(){ return structuredClone(this.state); }
  record(input:{tick:number;action:ActionKind;neuralUpdate:boolean;causalBridge:boolean;personalityUpdate:boolean;policyShift:boolean;verifiedOutcome:boolean;autonomousOutcome:boolean;persisted:boolean;holdoutNovel:boolean;neuralLearningUpdates:number;synapticUpdates:number;personalityLearningUpdates:number;verifiedUpdates:number;actionBiasMagnitude01:number}){
    const s=this.state;
    s.cycles++;
    if(input.neuralUpdate)s.neuralUpdateCycles++;
    if(input.causalBridge)s.causalBridgeCycles++;
    if(input.personalityUpdate)s.personalityUpdateCycles++;
    if(input.policyShift)s.policyShiftCycles++;
    if(input.verifiedOutcome)s.verifiedOutcomeCycles++;
    if(input.autonomousOutcome)s.autonomousOutcomeCycles++;
    if(input.persisted)s.persistenceChecks++;
    if(input.holdoutNovel)s.holdoutNovelCycles++;
    if(s.firstNeuralLearningUpdates===0)s.firstNeuralLearningUpdates=Math.max(0,Math.floor(input.neuralLearningUpdates));
    if(s.firstSynapticUpdates===0)s.firstSynapticUpdates=Math.max(0,Math.floor(input.synapticUpdates));
    if(s.firstPersonalityLearningUpdates===0)s.firstPersonalityLearningUpdates=Math.max(0,Math.floor(input.personalityLearningUpdates));
    if(s.firstVerifiedUpdates===0)s.firstVerifiedUpdates=Math.max(0,Math.floor(input.verifiedUpdates));
    s.lastActionBiasMagnitude01=clamp01(input.actionBiasMagnitude01);
    const rate=(n:number)=>n/Math.max(1,s.cycles);
    s.neuralToCausal01=clamp01(rate(Math.min(s.neuralUpdateCycles,s.causalBridgeCycles)));
    s.causalToPersonality01=clamp01(rate(Math.min(s.causalBridgeCycles,s.personalityUpdateCycles)));
    s.personalityToPolicy01=clamp01(rate(Math.min(s.personalityUpdateCycles,s.policyShiftCycles)));
    s.policyToOutcome01=clamp01(rate(Math.min(s.policyShiftCycles,s.verifiedOutcomeCycles+s.autonomousOutcomeCycles)));
    s.outcomeToPersistence01=clamp01(rate(Math.min(s.verifiedOutcomeCycles+s.autonomousOutcomeCycles,s.persistenceChecks)));
    s.independentHoldoutCoverage01=clamp01(rate(s.holdoutNovelCycles));
    const edges=[s.neuralToCausal01,s.causalToPersonality01,s.personalityToPolicy01,s.policyToOutcome01].reduce((a,b)=>a+b,0)/4;
    s.edgeIntegrity01=clamp01(edges);
    const rec:B305CriticalPathRecord={
      tick:Math.max(0,Math.floor(input.tick)),action:input.action,neuralUpdate:input.neuralUpdate,causalBridge:input.causalBridge,
      personalityUpdate:input.personalityUpdate,policyShift:input.policyShift,verifiedOutcome:input.verifiedOutcome,autonomousOutcome:input.autonomousOutcome,
      persisted:input.persisted,holdoutNovel:input.holdoutNovel,neuralLearningUpdates:Math.max(0,Math.floor(input.neuralLearningUpdates)),
      synapticUpdates:Math.max(0,Math.floor(input.synapticUpdates)),personalityLearningUpdates:Math.max(0,Math.floor(input.personalityLearningUpdates)),
      verifiedUpdates:Math.max(0,Math.floor(input.verifiedUpdates)),actionBiasMagnitude01:clamp01(input.actionBiasMagnitude01)
    };
    s.records=[...s.records,rec].slice(-96);
  }
  diagnostics(){
    const s=this.state;
    return {
      ...s,
      verifiedEdgeCount:[s.neuralToCausal01,s.causalToPersonality01,s.personalityToPolicy01,s.policyToOutcome01,s.outcomeToPersistence01].filter(v=>v>.05).length,
      fullCriticalPath01:clamp01((s.neuralToCausal01+s.causalToPersonality01+s.personalityToPolicy01+s.policyToOutcome01+s.outcomeToPersistence01)/5),
      actionCoverage01:clamp01(new Set(s.records.map(r=>r.action)).size/ACTIONS.length),
      recentRecords:s.records.slice(-12),
    };
  }
  clear(){this.state=defaultB305CriticalPathState();}
}
