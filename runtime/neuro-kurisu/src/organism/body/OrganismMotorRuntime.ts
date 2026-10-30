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

export interface OrganismMotorRuntimeDiagnostics {
  configured: boolean;
  controllerTick: number;
  activeGoalId: string | null;
  channel: MotorFrameChannelDiagnostics;
}

export class OrganismMotorRuntime {
  private readonly controller = new EmbodiedMotorController();
  private readonly frames = new MotorFrameChannel();
  private configured = false;

  configureSkeleton(definitions: readonly JointDefinition[]): void {
    this.controller.configureSkeleton(definitions);
    this.configured = true;
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
      channel: this.frames.diagnostics(),
    };
  }
}
