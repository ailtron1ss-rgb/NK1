export type MotorRendererKind = "live2d" | "depth2d" | "vrm3d";
export type MotorBindingComponent = "value" | "x" | "y" | "z" | "rotation";
export type MotorRendererValueUnit = "parameter" | "radians" | "degrees" | "normalized" | "meters";

export interface RendererMotorCommand {
  jointId: string;
  role: string;
  targetId: string;
  targetKind: "cubism-parameter" | "depth-rig-node" | "humanoid-bone";
  component: MotorBindingComponent;
  value: number;
  valueUnit: MotorRendererValueUnit;
  fidelity: "direct" | "approximate";
  clamped: boolean;
}

export interface RendererMotorCommandBatch {
  version: 1;
  profileId: string;
  modelId: string;
  renderer: MotorRendererKind;
  frameTick: number;
  frameAtMs: number;
  goalId: string | null;
  commands: RendererMotorCommand[];
  unmappedFrameJointIds: string[];
  clampedJointIds: string[];
}

export type MotorFrameProjectionState = "ready" | "unconfigured" | "waiting" | "unmapped" | "invalid";
export interface MotorFrameProjection {
  state: MotorFrameProjectionState;
  configured: boolean;
  renderer: MotorRendererKind;
  modelId: string;
  frameTick: number | null;
  batch: RendererMotorCommandBatch | null;
  reason: string;
}
export type MotorFrameConnectionStatus = "connecting" | "connected" | "reconnecting" | "unavailable";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isId = (value: unknown, max = 96): value is string =>
  typeof value === "string" && value.length >= 2 && value.length <= max
    && /^[a-z0-9][a-z0-9._:-]*$/i.test(value);
const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length <= 128 && value.every((item) => typeof item === "string" && item.length <= 64);

function expectedTargetKind(renderer: MotorRendererKind): RendererMotorCommand["targetKind"] {
  return renderer === "live2d" ? "cubism-parameter" : renderer === "depth2d" ? "depth-rig-node" : "humanoid-bone";
}
function expectedUnit(renderer: MotorRendererKind, component: MotorBindingComponent): MotorRendererValueUnit | null {
  if (renderer === "live2d") return component === "value" ? "parameter" : null;
  if (renderer === "depth2d") return component === "rotation" ? "degrees"
    : ["x", "y", "z"].includes(component) ? "normalized" : null;
  return ["x", "y", "z"].includes(component) ? "radians" : null;
}

function validateBatch(
  raw: unknown,
  renderer: MotorRendererKind,
  modelId: string,
  frameTick: number,
  frameAtMs: number,
): RendererMotorCommandBatch | null {
  if (!isRecord(raw) || raw.version !== 1 || raw.renderer !== renderer
    || raw.modelId !== modelId || !isId(raw.profileId)
    || raw.frameTick !== frameTick || raw.frameAtMs !== frameAtMs
    || !(raw.goalId === null || (typeof raw.goalId === "string" && raw.goalId.length <= 128))
    || !Array.isArray(raw.commands) || raw.commands.length === 0 || raw.commands.length > 128
    || !isStringList(raw.unmappedFrameJointIds) || !isStringList(raw.clampedJointIds)) return null;

  const jointIds = new Set<string>();
  const targetChannels = new Set<string>();
  const commands: RendererMotorCommand[] = [];
  for (const rawCommand of raw.commands) {
    if (!isRecord(rawCommand) || !isId(rawCommand.jointId, 64) || !isId(rawCommand.targetId, 64)
      || rawCommand.targetKind !== expectedTargetKind(renderer)
      || !["value", "x", "y", "z", "rotation"].includes(String(rawCommand.component))
      || typeof rawCommand.value !== "number" || !Number.isFinite(rawCommand.value)
      || typeof rawCommand.clamped !== "boolean"
      || !["direct", "approximate"].includes(String(rawCommand.fidelity))) return null;
    const component = rawCommand.component as MotorBindingComponent;
    const unit = expectedUnit(renderer, component);
    if (!unit || rawCommand.valueUnit !== unit) return null;
    if (jointIds.has(rawCommand.jointId as string)) return null;
    const key = String(rawCommand.targetId) + ":" + component;
    if (targetChannels.has(key)) return null;
    jointIds.add(rawCommand.jointId as string);
    targetChannels.add(key);
    commands.push({
      jointId: rawCommand.jointId as string,
      role: typeof rawCommand.role === "string" ? rawCommand.role.slice(0, 64) : "",
      targetId: rawCommand.targetId as string,
      targetKind: rawCommand.targetKind as RendererMotorCommand["targetKind"],
      component,
      value: rawCommand.value,
      valueUnit: unit,
      fidelity: rawCommand.fidelity as RendererMotorCommand["fidelity"],
      clamped: rawCommand.clamped,
    });
  }
  return {
    version: 1,
    profileId: raw.profileId,
    modelId,
    renderer,
    frameTick,
    frameAtMs,
    goalId: raw.goalId as string | null,
    commands,
    unmappedFrameJointIds: [...raw.unmappedFrameJointIds],
    clampedJointIds: [...raw.clampedJointIds],
  };
}

/** Parse and strictly bind one SSE frame to its requested renderer and uploaded model. */
export function parseMotorFrameEnvelope(
  data: string,
  renderer: MotorRendererKind,
  modelId: string,
): MotorFrameProjection {
  const invalid = (reason: string, configured = false, frameTick: number | null = null): MotorFrameProjection =>
    ({ state: "invalid", configured, renderer, modelId, frameTick, batch: null, reason });
  if (!isId(modelId)) return invalid("invalid-requested-model-id");
  let raw: unknown;
  try { raw = JSON.parse(data); } catch { return invalid("invalid-sse-json"); }
  if (!isRecord(raw) || raw.ok !== true || raw.readOnly !== true || typeof raw.configured !== "boolean") {
    return invalid("invalid-motor-frame-envelope");
  }
  if (!raw.configured) {
    return { state: "unconfigured", configured: false, renderer, modelId, frameTick: null, batch: null, reason: "motor-controller-not-configured" };
  }
  if (!isRecord(raw.frame) || !Number.isSafeInteger(raw.frame.tick) || (raw.frame.tick as number) < 0
    || typeof raw.frame.atMs !== "number" || !Number.isFinite(raw.frame.atMs) || raw.frame.atMs < 0) {
    return invalid("invalid-motor-frame-snapshot", true);
  }
  const frameTick = raw.frame.tick as number;
  const commands = raw.rendererCommands;
  if (!isRecord(commands) || typeof commands.ok !== "boolean" || typeof commands.reason !== "string") {
    return invalid("renderer-command-envelope-missing", true, frameTick);
  }
  if (!commands.ok || commands.batch === null) {
    return { state: "unmapped", configured: true, renderer, modelId, frameTick, batch: null,
      reason: commands.reason.slice(0, 160) || "renderer-profile-unavailable" };
  }
  const batch = validateBatch(commands.batch, renderer, modelId, frameTick, raw.frame.atMs);
  if (!batch) return invalid("renderer-command-batch-invalid-or-model-mismatch", true, frameTick);
  return { state: "ready", configured: true, renderer, modelId, frameTick, batch, reason: "calibrated-renderer-batch-ready" };
}

/** Status event is intentionally advisory; it never fabricates a frame or apply receipt. */
export function parseMotorFrameStatusEnvelope(
  data: string,
  renderer: MotorRendererKind,
  modelId: string,
): MotorFrameProjection {
  const invalid = (reason: string): MotorFrameProjection =>
    ({ state: "invalid", configured: false, renderer, modelId, frameTick: null, batch: null, reason });
  let raw: unknown;
  try { raw = JSON.parse(data); } catch { return invalid("invalid-motor-frame-status-json"); }
  if (!isRecord(raw) || typeof raw.configured !== "boolean" || typeof raw.hasFrame !== "boolean"
    || !Array.isArray(raw.registeredProfiles)) return invalid("invalid-motor-frame-status");
  if (!raw.configured) {
    return { state: "unconfigured", configured: false, renderer, modelId, frameTick: null, batch: null, reason: "motor-controller-not-configured" };
  }
  const profileFound = raw.registeredProfiles.some((profile) =>
    isRecord(profile) && profile.renderer === renderer && profile.modelId === modelId && profile.calibrated === true);
  return {
    state: profileFound ? "waiting" : "unmapped",
    configured: true,
    renderer,
    modelId,
    frameTick: null,
    batch: null,
    reason: profileFound ? "waiting-for-first-motor-frame" : "calibrated-model-profile-not-registered",
  };
}

export function connectMotorFrameStream(options: {
  url: string;
  renderer: MotorRendererKind;
  modelId: string;
  onProjection: (projection: MotorFrameProjection) => void;
  onConnection?: (status: MotorFrameConnectionStatus) => void;
}): () => void {
  if (typeof EventSource === "undefined") {
    options.onConnection?.("unavailable");
    options.onProjection({
      state: "unmapped", configured: false, renderer: options.renderer, modelId: options.modelId,
      frameTick: null, batch: null, reason: "event-source-unavailable",
    });
    return () => undefined;
  }
  const separator = options.url.includes("?") ? "&" : "?";
  const target = options.url + separator + "renderer=" + encodeURIComponent(options.renderer)
    + "&modelId=" + encodeURIComponent(options.modelId);
  const source = new EventSource(target);
  let closed = false;
  let lastTick = -1;
  const deliverFrame = (event: Event) => {
    if (closed) return;
    const data = (event as MessageEvent<string>).data;
    if (typeof data !== "string" || data.length > 262144) {
      options.onProjection({ state: "invalid", configured: true, renderer: options.renderer, modelId: options.modelId,
        frameTick: null, batch: null, reason: "motor-frame-sse-payload-out-of-range" });
      return;
    }
    const projection = parseMotorFrameEnvelope(data, options.renderer, options.modelId);
    if (projection.state === "ready" && projection.frameTick !== null) {
      if (projection.frameTick <= lastTick) {
        options.onProjection({ ...projection, state: "invalid", batch: null, reason: "motor-frame-tick-not-increasing" });
        return;
      }
      lastTick = projection.frameTick;
    }
    options.onProjection(projection);
  };
  const deliverStatus = (event: Event) => {
    if (closed) return;
    const data = (event as MessageEvent<string>).data;
    if (typeof data === "string" && data.length <= 16384) {
      options.onProjection(parseMotorFrameStatusEnvelope(data, options.renderer, options.modelId));
    }
  };
  source.addEventListener("motor-frame", deliverFrame);
  source.addEventListener("motor-frame-status", deliverStatus);
  source.onopen = () => options.onConnection?.("connected");
  source.onerror = () => options.onConnection?.("reconnecting");
  options.onConnection?.("connecting");
  return () => {
    if (closed) return;
    closed = true;
    source.removeEventListener("motor-frame", deliverFrame);
    source.removeEventListener("motor-frame-status", deliverStatus);
    source.close();
  };
}
