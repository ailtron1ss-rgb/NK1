/**
 * Lower-level motor-goal arbitration.
 *
 * OrganismCore remains the canonical owner of cognitive/action selection.
 * This circuit only arbitrates among renderer-neutral motor subgoals after an
 * organism action/intent has been authorized. Learning is accepted only from
 * the exact process-local receipt minted by OutcomeVerificationService.
 */
import { BasalGangliaSelectionCircuit } from "./BasalGangliaSelectionCircuit.ts";
import { CerebellarPredictiveController } from "./CerebellarPredictiveController.ts";
import {
  isTrustedDecisionLinkedExternalPostcondition,
  type ExpectedDecisionOutcomeBinding,
  type OutcomeVerification,
} from "./OutcomeVerificationService.ts";
import {
  EmbodiedMotorController,
  type MotorGoal,
  type MotorFrame,
  type MotorControllerSnapshot,
  validateMotorGoal,
} from "./EmbodiedMotorController.ts";

export interface MotorGoalCandidate {
  id: string;
  goal: MotorGoal;
  corticalValue01: number;
  predictedUtility01: number;
  confidence01: number;
  effort01: number;
  conflict01?: number;
  goalFit01?: number;
  novelty01?: number;
}

export interface MotorArbitrationContext {
  tick: number;
  nowMs: number;
  dopamine01: number;
  predictionError01: number;
  uncertainty01: number;
  novelty01: number;
  energy01: number;
  thermal01: number;
  cognitiveCapacity01: number;
  conflict01: number;
  goalPressure01: number;
  minimumGate01?: number;
}

export interface MotorArbitrationResult {
  version: 1;
  tick: number;
  selectedCandidateId: string | null;
  selectedAction: string | null;
  selectedGate01: number;
  selectionMargin01: number;
  accepted: boolean;
  reason: string;
  motorFrame: MotorFrame | null;
  ranked: Array<{ id: string; action: string; gate01: number; utility01: number; confidence01: number }>;
}

/** Legacy caller-asserted shape. It is intentionally no longer accepted for learning. */
export interface VerifiedMotorOutcome {
  evidenceId: string;
  action: string;
  predictedUtility01: number;
  actualUtility01: number;
  surprise01: number;
  dopamine01: number;
  tick: number;
  verified: boolean;
  independent: boolean;
  goalId: string;
}

interface PendingMotorGoal {
  action: string;
  verificationToolId: string | null;
  predictedUtility01: number;
  proposedTick: number;
}

export interface MotorArbitrationSnapshot {
  version: 1;
  basalGanglia: ReturnType<BasalGangliaSelectionCircuit["snapshot"]>;
  cerebellar: ReturnType<CerebellarPredictiveController["snapshot"]>;
  controller: MotorControllerSnapshot;
  creditedEvidenceIds: string[];
  pendingGoalIds: string[];
  pendingGoalMetadata?: Record<string, PendingMotorGoal>;
  lastResult: MotorArbitrationResult | null;
}

const clamp = (n: number): number => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export class MotorGoalArbiter {
  private readonly controller: EmbodiedMotorController;
  private basalGanglia = new BasalGangliaSelectionCircuit();
  private cerebellar = new CerebellarPredictiveController();
  private creditedEvidenceIds = new Set<string>();
  private pendingGoalIds = new Set<string>();
  private pendingGoalMetadata = new Map<string, PendingMotorGoal>();
  private lastResult: MotorArbitrationResult | null = null;

  constructor(controller: EmbodiedMotorController) { this.controller = controller; }

  propose(candidates: readonly MotorGoalCandidate[], context: MotorArbitrationContext): MotorArbitrationResult {
    if (!context || !Number.isSafeInteger(context.tick) || context.tick < 0 || !Number.isFinite(context.nowMs) || context.nowMs < 0) {
      const invalid: MotorArbitrationResult = {
        version: 1, tick: 0, selectedCandidateId: null, selectedAction: null,
        selectedGate01: 0, selectionMargin01: 0, accepted: false,
        reason: "invalid-motor-arbitration-context", motorFrame: null, ranked: [],
      };
      this.lastResult = invalid;
      return invalid;
    }
    const safe = (candidates ?? []).filter((candidate) =>
      candidate && typeof candidate.id === "string" && candidate.id.length > 0 &&
      candidate.goal && validateMotorGoal(candidate.goal).ok &&
      [candidate.corticalValue01, candidate.predictedUtility01, candidate.confidence01, candidate.effort01]
        .every(Number.isFinite),
    ).slice(0, 16);
    const ids = new Set<string>();
    const actions = new Set<string>();
    const unique = safe.filter((candidate) => {
      if (ids.has(candidate.id) || actions.has(candidate.goal.action)) return false;
      ids.add(candidate.id);
      actions.add(candidate.goal.action);
      return true;
    });
    if (!unique.length) {
      const empty: MotorArbitrationResult = {
        version: 1, tick: Math.max(0, Math.floor(context.tick)), selectedCandidateId: null,
        selectedAction: null, selectedGate01: 0, selectionMargin01: 0, accepted: false,
        reason: "no-valid-motor-candidates", motorFrame: null, ranked: [],
      };
      this.lastResult = empty;
      return empty;
    }

    const predicted = this.cerebellar.calibrate(unique.map((candidate) => ({
      action: candidate.goal.action,
      score: clamp(candidate.corticalValue01),
      predictedUtility: clamp(candidate.predictedUtility01),
      confidence01: clamp(candidate.confidence01),
    })), {
      predictionError01: clamp(context.predictionError01),
      uncertainty01: clamp(context.uncertainty01),
      novelty01: clamp(context.novelty01),
      bodyEnergy01: clamp(context.energy01),
      thermal01: clamp(context.thermal01),
      cognitiveCapacity01: clamp(context.cognitiveCapacity01),
      tick: context.tick,
    });
    const predictedByAction = new Map(predicted.rows.map((row) => [row.action, row]));
    const route = this.basalGanglia.route({
      candidates: unique.map((candidate) => {
        const row = predictedByAction.get(candidate.goal.action);
        return {
          action: candidate.goal.action,
          corticalValue01: row?.calibratedScore01 ?? clamp(candidate.corticalValue01),
          predictedUtility01: row?.calibratedUtility01 ?? clamp(candidate.predictedUtility01),
          confidence01: row?.confidence01 ?? clamp(candidate.confidence01),
          effort01: clamp(candidate.effort01),
          conflict01: clamp(candidate.conflict01 ?? context.conflict01),
          goalFit01: clamp(candidate.goalFit01 ?? context.goalPressure01),
          novelty01: clamp(candidate.novelty01 ?? context.novelty01),
        };
      }),
      dopamine01: clamp(context.dopamine01),
      uncertainty01: clamp(context.uncertainty01),
      conflict01: clamp(context.conflict01),
      goalPressure01: clamp(context.goalPressure01),
      cognitiveCapacity01: clamp(context.cognitiveCapacity01),
      novelty01: clamp(context.novelty01),
      tick: context.tick,
    });
    const selected = unique.find((candidate) => candidate.goal.action === route.selectedAction);
    const selectedRow = route.actions.find((row) => row.action === route.selectedAction);
    const gate = selectedRow?.gate01 ?? 0;
    const minimum = clamp(context.minimumGate01 ?? 0.38);
    let accepted = false;
    let reason = "motor-selection-below-commitment-threshold";
    let motorFrame: MotorFrame | null = null;
    if (selected && gate >= minimum) {
      const result = this.controller.setGoal(selected.goal, context.nowMs);
      accepted = result.accepted;
      reason = result.reason;
      if (accepted) {
        motorFrame = this.controller.step(context.nowMs);
        this.pendingGoalIds.add(selected.goal.id);
        this.pendingGoalMetadata.set(selected.goal.id, {
          action: selected.goal.action,
          verificationToolId: selected.goal.verificationToolId ?? null,
          predictedUtility01: clamp(selected.predictedUtility01),
          proposedTick: context.tick,
        });
        if (this.pendingGoalIds.size > 2048) {
          const oldest = this.pendingGoalIds.values().next().value;
          if (oldest) {
            this.pendingGoalIds.delete(oldest);
            this.pendingGoalMetadata.delete(oldest);
          }
        }
      }
    } else if (!selected) {
      reason = "basal-ganglia-selected-no-candidate";
    }
    const result: MotorArbitrationResult = {
      version: 1, tick: Math.max(0, Math.floor(context.tick)),
      selectedCandidateId: accepted ? selected!.id : null,
      selectedAction: accepted ? selected!.goal.action : null,
      selectedGate01: gate, selectionMargin01: route.selectionMargin01,
      accepted, reason, motorFrame,
      ranked: route.actions.map((row) => ({
        id: unique.find((candidate) => candidate.goal.action === row.action)!.id,
        action: row.action, gate01: row.gate01,
        utility01: predictedByAction.get(row.action)?.calibratedUtility01 ?? 0,
        confidence01: row.confidence01,
      })),
    };
    this.lastResult = structuredClone(result);
    return result;
  }

  /**
   * Only an exact OutcomeVerificationService receipt, still present in its
   * process-local WeakMap and bound to the matching gateway ticket, may train
   * motor policies. A serialized/reconstructed receipt deliberately fails.
   */
  recordTrustedOutcome(input: {
    goalId: string;
    receipt: OutcomeVerification;
    binding: ExpectedDecisionOutcomeBinding;
    tick: number;
    dopamine01: number;
  }): { accepted: boolean; reason: string } {
    if (!input || typeof input.goalId !== "string" || !input.goalId.trim()) {
      return { accepted: false, reason: "invalid-motor-outcome-goal-id" };
    }
    const pending = this.pendingGoalMetadata.get(input.goalId);
    if (!pending || !this.pendingGoalIds.has(input.goalId)) {
      return { accepted: false, reason: "no-matching-executed-goal" };
    }
    if (!pending.verificationToolId || input.binding?.toolId !== pending.verificationToolId) {
      return { accepted: false, reason: "motor-goal-verification-tool-mismatch" };
    }
    if (!isTrustedDecisionLinkedExternalPostcondition(input.receipt, input.binding)) {
      return { accepted: false, reason: "trusted-external-postcondition-receipt-required" };
    }
    const evidenceId = input.receipt.observationId;
    if (!evidenceId || !/^[a-z0-9][a-z0-9._:-]{2,179}$/i.test(evidenceId)) {
      return { accepted: false, reason: "invalid-trusted-observation-id" };
    }
    if (this.creditedEvidenceIds.has(evidenceId)) {
      return { accepted: false, reason: "duplicate-evidence-credit" };
    }
    if (input.receipt.confidence01 < 0.6) {
      return { accepted: false, reason: "trusted-receipt-confidence-below-learning-threshold" };
    }
    if (!Number.isSafeInteger(input.tick) || input.tick < pending.proposedTick ||
        !Number.isFinite(input.dopamine01) || input.dopamine01 < 0 || input.dopamine01 > 1) {
      return { accepted: false, reason: "invalid-motor-outcome-context" };
    }

    const predictedUtility01 = pending.predictedUtility01;
    const actualUtility01 = clamp(input.receipt.confidence01);
    const surprise01 = Math.abs(actualUtility01 - predictedUtility01);
    this.creditedEvidenceIds.add(evidenceId);
    this.pendingGoalIds.delete(input.goalId);
    this.pendingGoalMetadata.delete(input.goalId);
    if (this.creditedEvidenceIds.size > 2048) {
      const oldest = this.creditedEvidenceIds.values().next().value;
      if (oldest) this.creditedEvidenceIds.delete(oldest);
    }
    this.cerebellar.recordOutcome(pending.action, predictedUtility01, actualUtility01, surprise01, input.tick);
    this.basalGanglia.recordOutcome(pending.action, actualUtility01, surprise01, input.tick, input.dopamine01);
    return { accepted: true, reason: "trusted-external-postcondition-credited" };
  }

  /** Caller-provided booleans are not evidence and can never authorize learning. */
  recordVerifiedOutcome(_outcome: VerifiedMotorOutcome): { accepted: boolean; reason: string } {
    return { accepted: false, reason: "trusted-external-postcondition-receipt-required" };
  }

  snapshot(): MotorArbitrationSnapshot {
    return {
      version: 1,
      basalGanglia: this.basalGanglia.snapshot(),
      cerebellar: this.cerebellar.snapshot(),
      controller: this.controller.snapshot(),
      creditedEvidenceIds: [...this.creditedEvidenceIds].slice(-2048),
      pendingGoalIds: [...this.pendingGoalIds].slice(-2048),
      pendingGoalMetadata: Object.fromEntries(this.pendingGoalMetadata.entries()),
      lastResult: this.lastResult ? structuredClone(this.lastResult) : null,
    };
  }

  restore(snapshot: Partial<MotorArbitrationSnapshot> | null | undefined): void {
    this.basalGanglia.restore(snapshot?.basalGanglia);
    this.cerebellar.restore(snapshot?.cerebellar);
    this.controller.restore(snapshot?.controller);
    this.creditedEvidenceIds = new Set((snapshot?.creditedEvidenceIds ?? []).filter((id) => typeof id === "string").slice(-2048));
    this.pendingGoalIds = new Set((snapshot?.pendingGoalIds ?? []).filter((id) => typeof id === "string").slice(-2048));
    const metadata = snapshot?.pendingGoalMetadata ?? {};
    this.pendingGoalMetadata = new Map([...this.pendingGoalIds].flatMap((id) => {
      const item = metadata[id];
      return item && typeof item.action === "string" && Number.isFinite(item.predictedUtility01) &&
        Number.isSafeInteger(item.proposedTick) ? [[id, {
          action: item.action,
          verificationToolId: typeof item.verificationToolId === "string" ? item.verificationToolId : null,
          predictedUtility01: clamp(item.predictedUtility01),
          proposedTick: item.proposedTick,
        }] as const] : [];
    }));
    this.lastResult = snapshot?.lastResult ? structuredClone(snapshot.lastResult) : null;
  }

  diagnostics() {
    return {
      basalGanglia: this.basalGanglia.diagnostics(),
      cerebellar: this.cerebellar.diagnostics(),
      creditedEvidenceCount: this.creditedEvidenceIds.size,
      pendingGoalCount: this.pendingGoalIds.size,
      lastSelectedAction: this.lastResult?.selectedAction ?? null,
    };
  }
}
