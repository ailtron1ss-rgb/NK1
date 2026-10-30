/**
 * Organism-owned composition boundary for the canonical motor controller.
 *
 * This wrapper deliberately does not invent motor goals from emotion, gaze,
 * speech, UI state, or world actions. A caller must provide an already-approved
 * MotorGoal from the organism's action/ethical gate. The runtime then advances
 * the one canonical controller and publishes immutable latest-value frames.
 */
import {
  EmbodiedMotorController,
  type JointDefinition,
  type MotorControllerSnapshot,
  type MotorGoal,
  type MotorFrame,
} from '../system/EmbodiedMotorController.ts';
import {
  MotorFrameChannel,
  type MotorFrameChannelDiagnostics,
} from '../system/MotorFrameChannel.ts';
import {
  compileMotorJointDefinitions,
  mapMotorFrameToRendererCommands,
  type MotorRigProfileV1,
  type RendererMotorCommandBatch,
} from '../system/MotorRigProfile.ts';

export interface OrganismMotorRuntimeDiagnostics {
  configured: boolean;
  controllerTick: number;
  activeGoalId: string | null;
  activeRigProfileId: string | null;
  activeRenderer: MotorRigProfileV1['renderer'] | null;
  channel: MotorFrameChannelDiagnostics;
  continuousLoopRunning: boolean;
  continuousLoopErrors: number;
  lastContinuousLoopError: string | null;
}

export class OrganismMotorRuntime {
  private readonly controller = new EmbodiedMotorController();
  private readonly frames = new MotorFrameChannel();
  private configured = false;
  private activeRigProfile: MotorRigProfileV1 | null = null;
  private continuousTimer: ReturnType<typeof setInterval> | null = null;
  private continuousLoopErrors = 0;
  private lastContinuousLoopError: string | null = null;

  configureSkeleton(definitions: readonly JointDefinition[]): void {
    this.stopContinuous();
    this.controller.configureSkeleton(definitions);
    this.configured = true;
    this.activeRigProfile = null;
  }

  /** Configure the one canonical controller from a production-calibrated renderer profile. */
  configureRigProfile(profile: MotorRigProfileV1): void {
    const definitions = compileMotorJointDefinitions(profile);
    this.configureSkeleton(definitions);
    this.activeRigProfile = structuredClone(profile);
  }

  /** Project a controller-produced frame; this does not claim renderer application. */
  rendererCommandsForFrame(frame: MotorFrame): { ok: boolean; reason: string; batch: RendererMotorCommandBatch | null } {
    if (!this.activeRigProfile) return { ok: false, reason: 'motor-rig-profile-not-configured', batch: null };
    return mapMotorFrameToRendererCommands(this.activeRigProfile, frame);
  }

  /**
   * Advance independently of the much slower cognitive-cycle cadence. The
   * loop publishes only controller-produced frames and never creates goals.
   * A caller may inject a monotonic clock for deterministic tests.
   */
  startContinuous(intervalMs = 50, clock: () => number = () => performance.now()): void {
    if (!this.configured) throw new Error("organism-motor-skeleton-not-configured");
    if (!Number.isSafeInteger(intervalMs) || intervalMs < 16 || intervalMs > 1000) {
      throw new Error("organism-motor-loop-interval-out-of-range");
    }
    if (typeof clock !== "function") throw new TypeError("organism-motor-loop-clock-must-be-function");
    if (this.continuousTimer) return;
    this.continuousTimer = setInterval(() => {
      try {
        this.advance(clock());
        this.lastContinuousLoopError = null;
      } catch (error) {
        this.continuousLoopErrors++;
        this.lastContinuousLoopError = error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240);
      }
    }, intervalMs);
  }

  stopContinuous(): void {
    if (!this.continuousTimer) return;
    clearInterval(this.continuousTimer);
    this.continuousTimer = null;
  }

  /** Accept only a fully formed goal supplied by an upstream authorized owner. */
  submitApprovedGoal(goal: MotorGoal, nowMs: number): { accepted: boolean; reason: string } {
    if (!this.configured) return { accepted: false, reason: 'motor-skeleton-not-configured' };
    return this.controller.setGoal(goal, nowMs);
  }

  cancelGoal(reason = 'organism-motor-goal-cancelled'): void {
    this.controller.cancelGoal(reason);
  }

  /** Advance with a caller-supplied monotonic clock; never uses wall-clock time. */
  advance(nowMs: number): MotorFrame {
    if (!this.configured) throw new Error('organism-motor-skeleton-not-configured');
    const frame = this.controller.step(nowMs);
    const publication = this.frames.publish(frame);
    if (!publication.accepted) {
      throw new Error(`organism-motor-frame-publication-rejected:${publication.reason}`);
    }
    return frame;
  }

  subscribe(listener: (frame: MotorFrame) => void, replayLatest = true): () => void {
    return this.frames.subscribe(listener, replayLatest);
  }

  latestFrame(): MotorFrame | null {
    return this.frames.readLatest();
  }

  snapshot(): MotorControllerSnapshot {
    return this.controller.snapshot();
  }

  restore(snapshot: Partial<MotorControllerSnapshot> | null | undefined): void {
    if (!this.configured) throw new Error('organism-motor-skeleton-not-configured');
    this.controller.restore(snapshot);
    this.frames.clear();
  }

  diagnostics(): OrganismMotorRuntimeDiagnostics {
    const snapshot = this.controller.snapshot();
    return {
      configured: this.configured,
      controllerTick: snapshot.tick,
      activeGoalId: snapshot.activeGoal?.id ?? null,
      activeRigProfileId: this.activeRigProfile?.profileId ?? null,
      activeRenderer: this.activeRigProfile?.renderer ?? null,
      channel: this.frames.diagnostics(),
      continuousLoopRunning: this.continuousTimer !== null,
      continuousLoopErrors: this.continuousLoopErrors,
      lastContinuousLoopError: this.lastContinuousLoopError,
    };
  }
}
