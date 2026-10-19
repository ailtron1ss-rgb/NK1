import type { ActionKind } from './types.ts';
import { P61IntegratedMindKernel, type P61Input, type P61Frame } from '../cognition/P61IntegratedMindKernel.ts';
import { P64IntegratedOrganismDynamics, type P64Signals, type P64Candidate, type P64Frame } from '../cognition/P64IntegratedOrganismDynamics.ts';
import { ThalamocorticalGate } from '../system/ThalamocorticalGate.ts';
import { BasalGangliaSelectionCircuit } from '../system/BasalGangliaSelectionCircuit.ts';
import { CerebellarPredictiveController } from '../system/CerebellarPredictiveController.ts';
import { AdaptiveComputeGovernor } from '../system/AdaptiveComputeGovernor.ts';
import { CorticalHierarchyEngine } from '../system/CorticalHierarchyEngine.ts';
import { CerebellarBasalGangliaMotorLoop } from '../system/CerebellarBasalGangliaMotorLoop.ts';
import { BrainstemArousalSleepScheduler } from '../system/BrainstemArousalSleepScheduler.ts';
import { HypothalamicHomeostasisController } from '../system/HypothalamicHomeostasisController.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface CognitiveKernelArbitrationResult {
  p61: P61Frame;
  p64: P64Frame;
  candidates: P64Candidate[];
  basalGanglia: ReturnType<BasalGangliaSelectionCircuit['route']>;
  cerebellar: ReturnType<CerebellarPredictiveController['calibrate']>;
  computePlan: ReturnType<AdaptiveComputeGovernor['plan']>;
  corticalHierarchy: ReturnType<CorticalHierarchyEngine['route']>;
  thalamus: ReturnType<ThalamocorticalGate['gate']>;
  motorLoop: ReturnType<CerebellarBasalGangliaMotorLoop['observe']>;
  brainstem: ReturnType<BrainstemArousalSleepScheduler['tick']>;
  homeostasis: ReturnType<HypothalamicHomeostasisController['tick']>;
}

/**
 * BIG PASS 44: stable integration boundary for the moment-to-moment cognitive kernel.
 * Owns only the two central integration membranes (P61 + P64). Specialist organs
 * continue to live in OrganismCore, but new code can consume this coordinator without
 * reaching into either kernel implementation directly.
 */
export class CognitiveKernelCoordinator {
  private readonly p61: P61IntegratedMindKernel;
  private readonly p64: P64IntegratedOrganismDynamics;
  private readonly thalamus: ThalamocorticalGate;
  private readonly basalGanglia: BasalGangliaSelectionCircuit;
  private readonly cerebellum: CerebellarPredictiveController;
  private readonly computeGovernor: AdaptiveComputeGovernor;
  private readonly corticalHierarchy: CorticalHierarchyEngine;
  private readonly motorLoop: CerebellarBasalGangliaMotorLoop;
  private readonly brainstem: BrainstemArousalSleepScheduler;
  private readonly homeostasis: HypothalamicHomeostasisController;
  constructor(p61: P61IntegratedMindKernel, p64: P64IntegratedOrganismDynamics) {
    this.p61 = p61;
    this.p64 = p64;
    this.thalamus = new ThalamocorticalGate();
    this.basalGanglia = new BasalGangliaSelectionCircuit();
    this.cerebellum = new CerebellarPredictiveController();
    this.computeGovernor = new AdaptiveComputeGovernor();
    this.corticalHierarchy = new CorticalHierarchyEngine();
    this.motorLoop = new CerebellarBasalGangliaMotorLoop();
    this.brainstem = new BrainstemArousalSleepScheduler();
    this.homeostasis = new HypothalamicHomeostasisController();
  }

  integrateAndArbitrate(
    p61Input: P61Input,
    p64Signals: P64Signals,
    candidates: P64Candidate[],
    userRequestedAction?: ActionKind | null,
  ): CognitiveKernelArbitrationResult {
    const homeostasisFrame=this.homeostasis.tick({tick:p61Input.tick,energy01:p64Signals.bodyEnergy01,thermal01:p64Signals.thermal01,cognitiveLoad01:p64Signals.memoryPressure01,sleepPressure01:p64Signals.homeostaticPressure01 ?? p64Signals.memoryPressure01 ?? .2,goalPressure01:p64Signals.goalPressure01,uncertainty01:p64Signals.uncertainty01,novelty01:p64Signals.novelty01,externalInput:p64Signals.externalInput,safetyPressure01:p64Signals.conflictPressure01 ?? 0});
    const brainstemFrame=this.brainstem.tick({tick:p61Input.tick,sleepPressure01:clamp(Math.max(p64Signals.homeostaticPressure01 ?? p64Signals.memoryPressure01 ?? .2,homeostasisFrame.recoveryDrive01*.82)),arousalDemand01:clamp(Math.max(p64Signals.goalPressure01,p64Signals.predictionError01,p64Signals.externalInput ? .65 : 0,homeostasisFrame.motivationDrive01*.72)),energy01:p64Signals.bodyEnergy01,thermal01:p64Signals.thermal01,cognitiveLoad01:p64Signals.memoryPressure01,uncertainty01:p64Signals.uncertainty01,memoryPressure01:p64Signals.memoryPressure01,circadianWakeDrive01:.68,safetyPressure01:clamp(Math.max(p64Signals.conflictPressure01 ?? 0,p64Signals.homeostaticPressure01 ?? 0,homeostasisFrame.allostaticLoad01*.55))});
    const computePlan = this.computeGovernor.plan({
      surprise01:p64Signals.predictionError01, predictionError01:p64Signals.predictionError01,
      uncertainty01:p64Signals.uncertainty01, novelty01:p64Signals.novelty01,
      salience01:Math.max(p61Input.workspace01, p64Signals.goalPressure01),
      bodyEnergy01:p64Signals.bodyEnergy01, thermal01:p64Signals.thermal01,
      cognitiveCapacity01:p64Signals.cognitiveCapacity01, memoryPressure01:p64Signals.memoryPressure01,
      phoneMode:p64Signals.cognitiveCapacity01 < .78 || p64Signals.thermal01 > .45, tick:p61Input.tick,
    });
    const gate = this.thalamus.gate({
      bodyEnergy01:p64Signals.bodyEnergy01, thermal01:p64Signals.thermal01,
      cognitiveCapacity01:p64Signals.cognitiveCapacity01, memoryPressure01:p64Signals.memoryPressure01,
      uncertainty01:p64Signals.uncertainty01, predictionError01:p64Signals.predictionError01,
      grounding01:p64Signals.grounding01, causal01:p64Signals.causal01, metacognitive01:p64Signals.metacognitive01,
      memoryHealth01:p64Signals.memoryHealth01, goalPressure01:p64Signals.goalPressure01, socialNeed01:p64Signals.socialNeed01,
      novelty01:p64Signals.novelty01, externalInput:p64Signals.externalInput, identityDecision:p64Signals.identityDecision,
    });
    const cerebellarFrame = this.cerebellum.calibrate(candidates.map(c => ({action:c.action,score:c.score,predictedUtility:c.predictedUtility,confidence01:c.confidence01})), {
      predictionError01:p64Signals.predictionError01, uncertainty01:p64Signals.uncertainty01, novelty01:p64Signals.novelty01,
      bodyEnergy01:p64Signals.bodyEnergy01, thermal01:p64Signals.thermal01, cognitiveCapacity01:p64Signals.cognitiveCapacity01, tick:p61Input.tick,
    });
    const corticalFrame = this.corticalHierarchy.route(candidates.map(c => ({
      id:c.action,
      evidence01:c.score,
      prediction01:c.predictedUtility ?? c.score,
      confidence01:c.confidence01,
      salience01:clamp(Math.max(p64Signals.goalPressure01, p61Input.workspace01)),
      novelty01:p64Signals.novelty01,
      abstraction01:c.action==='explore'?.34:c.action==='verify'?.58:c.action==='rest'?.18:c.action==='wait'?.46:.5,
    })), {
      uncertainty01:p64Signals.uncertainty01, predictionError01:p64Signals.predictionError01, novelty01:p64Signals.novelty01,
      goalPressure01:p64Signals.goalPressure01, bodyEnergy01:p64Signals.bodyEnergy01, thermal01:p64Signals.thermal01,
      cognitiveCapacity01:p64Signals.cognitiveCapacity01, memoryPressure01:p64Signals.memoryPressure01,
      externalInput:p64Signals.externalInput, tick:p61Input.tick,
    });
    const closedGate=this.thalamus.closeLoop(gate,corticalFrame.rows.map(row=>({id:row.id,precision01:row.precision01,contradiction01:row.contradiction01,informationGain01:row.informationGain01,predictivePosterior01:row.predictivePosterior01,predictionError01:row.predictionError01})),p61Input.tick);
    const cerebellarByAction=new Map(cerebellarFrame.rows.map(row=>[row.action,row]));
    const corticalByAction=new Map(corticalFrame.rows.map(row=>[row.id,row]));
    const bgFrame = this.basalGanglia.route({
      candidates: candidates.map(candidate => ({
        action:candidate.action, corticalValue01:candidate.score, predictedUtility01:candidate.predictedUtility,
        confidence01:candidate.confidence01, effort01:candidate.action==='rest'?.08:candidate.action==='explore'?.46:.28,
        conflict01:p64Signals.conflictPressure01 ?? p64Signals.uncertainty01, goalFit01:p64Signals.goalPressure01, novelty01:p64Signals.novelty01,
      })),
      dopamine01:p64Signals.dopamine01 ?? .5, uncertainty01:p64Signals.uncertainty01, conflict01:p64Signals.conflictPressure01 ?? p64Signals.uncertainty01,
      goalPressure01:p64Signals.goalPressure01, cognitiveCapacity01:p64Signals.cognitiveCapacity01, novelty01:p64Signals.novelty01, tick:p61Input.tick,
    });
    const bgByAction = new Map(bgFrame.actions.map(row=>[row.action,row]));
    const cerebellumScale=(action:string)=>cerebellarByAction.get(action)?.correction01 ?? 0;
    const motorGain=(action:string)=>this.motorLoop.modulate(action,1);
    const candidateRank=(c:{action:string;score:number})=>c.score + cerebellumScale(c.action)*.03;
    const effectiveMaxCandidates=Math.max(2,Math.round(computePlan.maxCandidates*brainstemFrame.computeScale01*homeostasisFrame.computeCap01));
    const reducedCandidates=[...candidates].sort((a,b)=>candidateRank(b)-candidateRank(a)).slice(0,effectiveMaxCandidates);
    const reducedActions=new Set(reducedCandidates.map(c=>c.action));
    const gatedP61Input = { ...p61Input, workspace01: p61Input.workspace01 * closedGate.broadcast01 * computePlan.workspaceScale01 * brainstemFrame.computeScale01 * homeostasisFrame.computeCap01, candidates: p61Input.candidates.filter(c=>reducedActions.has(c.action)).map(c => ({
      ...c, score: clamp(c.score * (closedGate.actionGain[c.action] ?? .78) * (.82 + (bgByAction.get(c.action)?.gate01 ?? .5)*.18))
    })) };
    const gatedCandidates = candidates.map(candidate => {
      const bg=bgByAction.get(candidate.action);
      const cereb=cerebellarByAction.get(candidate.action);
      const sparsePenalty=reducedActions.has(candidate.action)?0:computePlan.sparsity01*.035;
      const cortical=corticalByAction.get(candidate.action);
      return {
        ...candidate,
        score: clamp(candidate.score * (closedGate.actionGain[candidate.action] ?? .78) * (.82 + (bg?.gate01 ?? .5)*.18) * (cortical?.hierarchyGain01 ?? .92) * motorGain(candidate.action) + this.basalGanglia.actionBias(candidate.action) + (cereb?.correction01 ?? 0)*.03 - sparsePenalty),
        predictedUtility: clamp((candidate.predictedUtility ?? candidate.score) + (cereb?.correction01 ?? 0)*.04 - (cortical?.contradiction01 ?? 0)*.025),
        confidence01: clamp(candidate.confidence01 * (.72 + closedGate.precision01*.28) * (.86 + (bg?.confidence01 ?? .5)*.14) * (.92 + (cereb?.confidence01 ?? .5)*.08) * (.92 + (cortical?.precision01 ?? .5)*.08)),
      };
    });
    const p61Frame = this.p61.integrate(gatedP61Input);
    const p64Frame = this.p64.arbitrate({
      tick: p61Input.tick,
      at: p61Input.at,
      signals: { ...p64Signals, p61Mode: p61Frame.mode, p61Integration01: p61Frame.integration01,
        homeostaticPressure01: Math.max(p64Signals.homeostaticPressure01 ?? 0, (1-closedGate.channelGain.interoception)*.08),
      },
      candidates:gatedCandidates,
    });
    for (const candidate of candidates) {
      const b = p64Frame.actionBias[candidate.action] ?? 0;
      const bounded = p64Frame.candidateScores[candidate.action] ?? candidate.score;
      candidate.score = clamp(candidate.score + b + (bounded - candidate.score) * 0.22);
      candidate.predictedUtility = clamp((candidate.predictedUtility ?? candidate.score) + b * 0.58);
      candidate.confidence01 = clamp(candidate.confidence01 * 0.9 + p64Frame.confidence01 * 0.1);
    }
    const previewAction = bgFrame.selectedAction ?? gatedCandidates[0]?.action ?? 'wait';
    const previewCereb = cerebellarByAction.get(previewAction);
    const previewBg = bgByAction.get(previewAction);
    const motorFrame = this.motorLoop.observe({action:previewAction,predictedUtility01:clamp(gatedCandidates.find(c=>c.action===previewAction)?.predictedUtility??.5),cerebellarForwardError01:clamp(previewCereb?.forwardError01??p64Signals.predictionError01),cerebellarCorrection01:previewCereb?.correction01??0,basalGangliaGate01:clamp(previewBg?.gate01??.5),reward01:.5,surprise01:p64Signals.predictionError01,energy01:p64Signals.bodyEnergy01,cognitiveCapacity01:p64Signals.cognitiveCapacity01,tick:p61Input.tick});
    return { p61: p61Frame, p64: p64Frame, candidates:gatedCandidates, basalGanglia:bgFrame, cerebellar:cerebellarFrame, computePlan, corticalHierarchy:corticalFrame, thalamus:closedGate, motorLoop:motorFrame, brainstem:brainstemFrame, homeostasis:homeostasisFrame };
  }

  finalize<T extends { action: ActionKind; score: number }>(candidates: T[], userRequestedAction: ActionKind | null | undefined, p64Frame: P64Frame) {
    return this.p64.finalize(candidates, userRequestedAction ?? null, p64Frame);
  }

  restore(input?: {
    thalamus?: ReturnType<ThalamocorticalGate['snapshot']>;
    basalGanglia?: ReturnType<BasalGangliaSelectionCircuit['snapshot']>;
    cerebellar?: ReturnType<CerebellarPredictiveController['snapshot']>;
    computeGovernor?: ReturnType<AdaptiveComputeGovernor['snapshot']>;
    corticalHierarchy?: ReturnType<CorticalHierarchyEngine['snapshot']>;
    motorLoop?: ReturnType<CerebellarBasalGangliaMotorLoop['snapshot']>;
    brainstem?: ReturnType<BrainstemArousalSleepScheduler['snapshot']>;
    homeostasis?: ReturnType<HypothalamicHomeostasisController['snapshot']>;
  } | null) {
    this.thalamus.restore(input?.thalamus);
    this.basalGanglia.restore(input?.basalGanglia);
    this.cerebellum.restore(input?.cerebellar);
    this.computeGovernor.restore(input?.computeGovernor);
    this.corticalHierarchy.restore(input?.corticalHierarchy);
    this.motorLoop.restore(input?.motorLoop);
    this.brainstem.restore(input?.brainstem);
    this.homeostasis.restore(input?.homeostasis);
  }

  recordOutcome(action:string,predicted01:number,actual01:number,surprise01:number,tick:number){ const thalamus=this.thalamus.recordOutcome(action,predicted01,actual01,surprise01,tick); const cerebellar=this.cerebellum.recordOutcome(action,predicted01,actual01,surprise01,tick); const cortical=this.corticalHierarchy.recordOutcome(action,predicted01,actual01,surprise01,tick); const bg=this.basalGanglia.snapshot().actionValues[action] ?? 0; const motor=this.motorLoop.observe({action,predictedUtility01:predicted01,cerebellarForwardError01:cerebellar.targetError01,cerebellarCorrection01:cerebellar.bias01,basalGangliaGate01:clamp(.5+bg*.5),reward01:actual01,surprise01,energy01:.8,cognitiveCapacity01:.8,tick}); return {thalamus,cerebellar,cortical,motor}; }

  snapshot() {
    return { p61: this.p61.snapshot(), p64: this.p64.snapshot(), thalamus:this.thalamus.snapshot(), basalGanglia:this.basalGanglia.snapshot(), cerebellar:this.cerebellum.snapshot(), computeGovernor:this.computeGovernor.snapshot(), corticalHierarchy:this.corticalHierarchy.snapshot(), motorLoop:this.motorLoop.snapshot(), brainstem:this.brainstem.snapshot(), homeostasis:this.homeostasis.snapshot() };
  }
}
