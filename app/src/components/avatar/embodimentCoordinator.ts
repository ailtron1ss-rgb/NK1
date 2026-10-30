import { validateSemanticBodyState, type SemanticBodyState } from "./embodimentSwitch.ts";

export type EmbodimentSwitchPhase =
  | "idle" | "preparing" | "applying" | "verifying" | "rolling-back" | "committed" | "failed";

export interface AdapterApplyReceipt {
  adapterId: string;
  stateRevision: number;
  appliedAtMonotonicMs: number;
  acceptedChannels: readonly string[];
  rejectedChannels: readonly string[];
  executionId: string;
}

export interface AdapterVerification {
  verified: boolean;
  stateRevision: number;
  observedAtMonotonicMs: number;
  observedChannels: readonly string[];
  mismatches: readonly string[];
  reason?: string;
}

export interface EmbodimentAdapter {
  readonly id: string;
  readonly mode: "live2d" | "depth2d" | "vrm3d";
  prepare(state: SemanticBodyState, signal: AbortSignal): Promise<void>;
  apply(state: SemanticBodyState, signal: AbortSignal): Promise<AdapterApplyReceipt>;
  verify(receipt: AdapterApplyReceipt, signal: AbortSignal): Promise<AdapterVerification>;
  dispose(): Promise<void>;
}

export interface EmbodimentSwitchEvent {
  phase: EmbodimentSwitchPhase;
  fromAdapterId: string;
  toAdapterId: string;
  revision: number;
  detail?: string;
}

export type EmbodimentSwitchOutcome =
  | { status: "unchanged"; activeAdapterId: string; revision: number }
  | { status: "committed"; activeAdapterId: string; revision: number; receipt: AdapterApplyReceipt; verification: AdapterVerification }
  | { status: "rolled-back"; activeAdapterId: string; revision: number; reason: string }
  | { status: "failed"; activeAdapterId: string; revision: number; reason: string };

const isStringList = (value: readonly string[]): boolean =>
  Array.isArray(value) && value.every(item => typeof item === "string" && item.length > 0);

const isValidReceipt = (receipt: AdapterApplyReceipt, adapterId: string, revision: number): boolean =>
  Boolean(receipt && receipt.adapterId === adapterId && receipt.stateRevision === revision
    && Number.isFinite(receipt.appliedAtMonotonicMs) && receipt.appliedAtMonotonicMs >= 0
    && typeof receipt.executionId === "string" && receipt.executionId.length > 0
    && isStringList(receipt.acceptedChannels) && receipt.acceptedChannels.length > 0
    && new Set(receipt.acceptedChannels).size === receipt.acceptedChannels.length
    && isStringList(receipt.rejectedChannels));

/**
 * Verification must cover every channel the adapter claimed to apply, for the same
 * revision, and must be observed no earlier than the apply receipt. A bare verified
 * flag or a partial observation is never sufficient to commit a renderer handoff.
 */
const isValidVerification = (
  result: AdapterVerification,
  receipt: AdapterApplyReceipt,
): boolean => {
  if (!result || result.stateRevision !== receipt.stateRevision
    || !Number.isFinite(result.observedAtMonotonicMs)
    || result.observedAtMonotonicMs < receipt.appliedAtMonotonicMs
    || !isStringList(result.observedChannels)
    || !Array.isArray(result.mismatches)
    || !result.mismatches.every(item => typeof item === "string")
    || typeof result.verified !== "boolean") return false;
  const observed = new Set(result.observedChannels);
  return receipt.acceptedChannels.every(channel => observed.has(channel));
};

/**
 * Transactional renderer handoff. The source remains authoritative until the
 * destination prepares, applies and independently verifies the same semantic revision.
 * Failed destinations are disposed and the source is asked to restore the snapshot.
 */
export class EmbodimentSwitchCoordinator {
  private active: EmbodimentAdapter;
  private busy = false;
  private lastRevision = -1;
  private readonly onEvent: (event: EmbodimentSwitchEvent) => void;

  constructor(
    initialAdapter: EmbodimentAdapter,
    onEvent: (event: EmbodimentSwitchEvent) => void = () => undefined,
  ) {
    if (!initialAdapter.id.trim()) throw new TypeError("invalid-initial-adapter-id");
    this.active = initialAdapter;
    this.onEvent = onEvent;
  }

  get activeAdapterId(): string { return this.active.id; }
  get isSwitching(): boolean { return this.busy; }

  async switchTo(
    destination: EmbodimentAdapter,
    snapshot: SemanticBodyState,
    signal?: AbortSignal,
  ): Promise<EmbodimentSwitchOutcome> {
    const source = this.active;
    const revision = snapshot?.revision;
    if (this.busy) return { status: "failed", activeAdapterId: source.id, revision: Number.isSafeInteger(revision) ? revision : -1, reason: "switch-in-progress" };
    if (!validateSemanticBodyState(snapshot) || !Number.isSafeInteger(revision) || revision < this.lastRevision) {
      return { status: "failed", activeAdapterId: source.id, revision: Number.isSafeInteger(revision) ? revision : -1, reason: "stale-or-invalid-state-revision" };
    }
    if (destination === source || destination.id === source.id) {
      return { status: "unchanged", activeAdapterId: source.id, revision };
    }
    if (!destination.id.trim()) return { status: "failed", activeAdapterId: source.id, revision, reason: "invalid-destination-adapter-id" };

    this.busy = true;
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) controller.abort(signal.reason);
    else signal?.addEventListener("abort", abortFromCaller, { once: true });
    const emit = (phase: EmbodimentSwitchPhase, detail?: string) => this.onEvent({
      phase, fromAdapterId: source.id, toAdapterId: destination.id, revision, detail,
    });
    let prepared = false;
    try {
      if (controller.signal.aborted) throw new Error("switch-aborted");
      emit("preparing");
      prepared = true;
      await destination.prepare(snapshot, controller.signal);
      if (controller.signal.aborted) throw new Error("switch-aborted");

      emit("applying");
      const receipt = await destination.apply(snapshot, controller.signal);
      if (!isValidReceipt(receipt, destination.id, revision)) throw new Error("invalid-apply-receipt");
      if (controller.signal.aborted) throw new Error("switch-aborted");

      emit("verifying");
      const verification = await destination.verify(receipt, controller.signal);
      if (!isValidVerification(verification, receipt) || !verification.verified || verification.mismatches.length) {
        throw new Error(verification?.reason || "destination-verification-failed");
      }
      if (controller.signal.aborted) throw new Error("switch-aborted");

      this.active = destination;
      this.lastRevision = revision;
      emit("committed");
      try { await source.dispose(); } catch { /* destination is already authoritative */ }
      return { status: "committed", activeAdapterId: destination.id, revision, receipt, verification };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown-switch-failure";
      if (prepared) {
        try { await destination.dispose(); } catch { /* preserve the primary failure */ }
      }
      emit("rolling-back", reason);
      try {
        const rollbackReceipt = await source.apply(snapshot, new AbortController().signal);
        if (!isValidReceipt(rollbackReceipt, source.id, revision)) throw new Error("invalid-source-rollback-receipt");
        const rollbackVerification = await source.verify(rollbackReceipt, new AbortController().signal);
        if (!isValidVerification(rollbackVerification, rollbackReceipt)
          || !rollbackVerification.verified || rollbackVerification.mismatches.length) {
          throw new Error("source-rollback-verification-failed");
        }
        this.lastRevision = Math.max(this.lastRevision, revision);
        emit("failed", reason);
        return { status: "rolled-back", activeAdapterId: source.id, revision, reason };
      } catch (rollbackError) {
        const rollbackReason = rollbackError instanceof Error ? rollbackError.message : "unknown-rollback-failure";
        emit("failed", `${reason}; rollback: ${rollbackReason}`);
        return { status: "failed", activeAdapterId: source.id, revision, reason: `${reason}; rollback: ${rollbackReason}` };
      }
    } finally {
      signal?.removeEventListener("abort", abortFromCaller);
      this.busy = false;
    }
  }
}
