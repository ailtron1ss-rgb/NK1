/**
 * Organism-owned composition boundary for the canonical motor controller.
 *
 * One controller owns the organism's joint state. Renderer profiles are immutable
 * calibrated projections of that same state; adding a 2D/2.5D/3D profile never
 * creates or reconfigures a second controller. No profile can create motor goals.
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
  type MotorRendererKind,
  type RendererMotorCommandBatch,
} from '../system/MotorRigProfile.ts';

export interface RegisteredMotorRendererProfile {
  profileId: string;
  modelId: string;
  renderer: MotorRendererKind;
  revision: number;
  calibrated: boolean;
}

export interface OrganismMotorRuntimeDiagnostics {
  configured: boolean;
  controllerTick: number;
  activeGoalId: string | null;
  /** Backward-compatible when exactly one renderer profile is registered. */
  activeRigProfileId: string | null;
  /** Backward-compatible when exactly one renderer profile is registered. */
  activeRenderer: MotorRendererKind | null;
  registeredProfiles: RegisteredMotorRendererProfile[];
  channel: MotorFrameChannelDiagnostics;
  continuousLoopRunning: boolean;
  continuousLoopErrors: number;
  lastContinuousLoopError: string | null;
}

function cloneDefinitions(definitions: readonly JointDefinition[]): JointDefinition[] {
  return definitions.map((joint) => ({ ...joint }));
}

function sameCanonicalSkeleton(a: readonly JointDefinition[], b: readonly JointDefinition[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(a.map((joint) => [joint.id, joint]));
  return b.every((joint) => {
    const current = byId.get(joint.id);
    return Boolean(current
      && current.parentId === joint.parentId
      && current.minAngleRad === joint.minAngleRad
      && current.maxAngleRad === joint.maxAngleRad
      && current.restAngleRad === joint.restAngleRad
      && current.maxSpeedRadPerSec === joint.maxSpeedRadPerSec
      && current.maxAccelerationRadPerSec2 === joint.maxAccelerationRadPerSec2
      && current.maxJerkRadPerSec3 === joint.maxJerkRadPerSec3);
  });
}

function profileSummary(profile: MotorRigProfileV1): RegisteredMotorRendererProfile {
  return {
    profileId: profile.profileId,
    modelId: profile.modelId,
    renderer: profile.renderer,
    revision: profile.revision,
    calibrated: profile.calibration.status === 'calibrated',
  };
}

export class OrganismMotorRuntime {
  private readonly controller = new EmbodiedMotorController();
  private readonly frames = new MotorFrameChannel();
  private configured = false;
  private canonicalDefinitions: JointDefinition[] | null = null;
  private readonly rendererProfiles = new Map<string, MotorRigProfileV1>();
  private continuousTimer: ReturnType<typeof setInterval> | null = null;
  private continuousLoopErrors = 0;
  private lastContinuousLoopError: string | null = null;

  /**
   * Explicit low-level configuration resets renderer profiles because their
   * joint contract may no longer describe the new controller skeleton.
   */
  configureSkeleton(definitions: readonly JointDefinition[]): void {
    const safeDefinitions = cloneDefinitions(definitions);
    this.stopContinuous();
    this.controller.configureSkeleton(safeDefinitions);
    this.canonicalDefinitions = safeDefinitions;
    this.configured = true;
    this.rendererProfiles.clear();
    this.frames.clear();
  }

  /**
   * Register a calibrated projection over the existing canonical skeleton.
   * The first profile may establish that skeleton; later profiles must match
   * its exact joint IDs, topology, limits and dynamics.
   */
  registerRendererRigProfile(profile: MotorRigProfileV1): void {
    this.registerRendererRigProfiles([profile]);
  }

  /**
   * Atomically register a renderer set after every profile has been compiled,
   * calibrated and checked against one canonical skeleton. A partially valid
   * Live2D/2.5D/3D set never leaves a half-configured organism.
   */
  registerRendererRigProfiles(profiles: readonly MotorRigProfileV1[]): void {
    if (!Array.isArray(profiles) || profiles.length < 1 || profiles.length > 16) {
      throw new Error('renderer-profile-batch-size-out-of-range');
    }
    const compiled = profiles.map((profile) => ({
      profile,
      definitions: compileMotorJointDefinitions(profile),
    }));
    const canonical = this.configured ? this.canonicalDefinitions : compiled[0]?.definitions;
    if (!canonical) throw new Error('renderer-profile-canonical-skeleton-missing');

    const ids = new Set<string>();
    const modelKeys = new Set<string>();
    const staged = new Map(this.rendererProfiles);
    for (const item of compiled) {
      const { profile, definitions } = item;
      if (!sameCanonicalSkeleton(canonical, definitions)) {
        throw new Error('renderer-profile-canonical-skeleton-mismatch');
      }
      if (ids.has(profile.profileId)) throw new Error('renderer-profile-id-duplicate-in-batch');
      ids.add(profile.profileId);
      const modelKey = profile.renderer + ':' + profile.modelId;
      if (modelKeys.has(modelKey)) throw new Error('renderer-model-profile-already-registered');
      modelKeys.add(modelKey);
      const previous = staged.get(profile.profileId);
      if (previous && (profile.revision <= previous.revision || previous.renderer !== profile.renderer)) {
        throw new Error('renderer-profile-revision-not-increasing-or-kind-changed');
      }
      const duplicateModelProfile = [...staged.values()].some((registered) =>
        registered.profileId !== profile.profileId
        && registered.renderer === profile.renderer
        && registered.modelId === profile.modelId);
      if (duplicateModelProfile) throw new Error('renderer-model-profile-already-registered');
      staged.set(profile.profileId, structuredClone(profile));
    }
    if (staged.size > 16) throw new Error('renderer-profile-registry-capacity-reached');

    if (!this.configured) this.configureSkeleton(compiled[0].definitions);
    this.rendererProfiles.clear();
    for (const [profileId, profile] of staged) this.rendererProfiles.set(profileId, profile);
  }

  /** Backward-compatible entry point; it now registers instead of replacing the controller. */
  configureRigProfile(profile: MotorRigProfileV1): void {
    this.registerRendererRigProfile(profile);
  }

  /** Defensive profile readback. Ambiguous renderer/model selections fail closed. */
  rendererProfileFor(renderer: MotorRendererKind, modelId?: string): MotorRigProfileV1 | null {
    const matches = [...this.rendererProfiles.values()].filter((profile) =>
      profile.renderer === renderer && (modelId === undefined || profile.modelId === modelId));
    return matches.length === 1 ? structuredClone(matches[0]) : null;
  }

  /**
   * Project one measured controller frame through the explicitly selected
   * renderer/model calibration. An omitted selector works only with one profile.
   */
  rendererCommandsForFrame(
    frame: MotorFrame,
    renderer?: MotorRendererKind,
    modelId?: string,
  ): { ok: boolean; reason: string; batch: RendererMotorCommandBatch | null } {
    const matches = [...this.rendererProfiles.values()].filter((profile) =>
      (renderer === undefined || profile.renderer === renderer)
      && (modelId === undefined || profile.modelId === modelId));
    if (!matches.length) return { ok: false, reason: 'renderer-profile-not-configured', batch: null };
    if (matches.length > 1) return { ok: false, reason: 'renderer-profile-selection-ambiguous', batch: null };
    return mapMotorFrameToRendererCommands(matches[0], frame);
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
    const profiles = [...this.rendererProfiles.values()].map(profileSummary);
    const onlyProfile = profiles.length === 1 ? profiles[0] : null;
    return {
      configured: this.configured,
      controllerTick: snapshot.tick,
      activeGoalId: snapshot.activeGoal?.id ?? null,
      activeRigProfileId: onlyProfile?.profileId ?? null,
      activeRenderer: onlyProfile?.renderer ?? null,
      registeredProfiles: profiles,
      channel: this.frames.diagnostics(),
      continuousLoopRunning: this.continuousTimer !== null,
      continuousLoopErrors: this.continuousLoopErrors,
      lastContinuousLoopError: this.lastContinuousLoopError,
    };
  }
}
