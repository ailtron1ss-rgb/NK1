export type AvatarFrameBudgetTier = "low" | "balanced" | "high";

export type AvatarFrameBudgetReason =
  | "reduced-motion"
  | "data-saver"
  | "memory-limited"
  | "cpu-limited"
  | "high-capability"
  | "balanced-default"
  | "runtime-pressure"
  | "runtime-recovery";

export interface AvatarFrameBudget {
  tier: AvatarFrameBudgetTier;
  targetFps: 24 | 40 | 60;
  maxPixelRatio: 1 | 1.5 | 2;
  reason: AvatarFrameBudgetReason;
}

export interface AvatarFrameBudgetHints {
  reducedMotion?: boolean;
  saveData?: boolean;
  deviceMemoryGiB?: number;
  hardwareConcurrency?: number;
}

const TIER_ORDER: readonly AvatarFrameBudgetTier[] = ["low", "balanced", "high"];

const TIER_SETTINGS: Record<AvatarFrameBudgetTier, Pick<AvatarFrameBudget, "targetFps" | "maxPixelRatio">> = {
  low: { targetFps: 24, maxPixelRatio: 1 },
  balanced: { targetFps: 40, maxPixelRatio: 1.5 },
  high: { targetFps: 60, maxPixelRatio: 2 },
};

function profile(tier: AvatarFrameBudgetTier, reason: AvatarFrameBudgetReason): AvatarFrameBudget {
  return { tier, ...TIER_SETTINGS[tier], reason };
}

function positiveFinite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Resolve a conservative rendering budget from browser-exposed device hints.
 * Unknown hints never opt a device into the highest-cost profile.
 */
export function resolveAvatarFrameBudget(hints: AvatarFrameBudgetHints = {}): AvatarFrameBudget {
  if (hints.reducedMotion === true) return profile("low", "reduced-motion");
  if (hints.saveData === true) return profile("low", "data-saver");

  const memory = positiveFinite(hints.deviceMemoryGiB);
  const cores = positiveFinite(hints.hardwareConcurrency);

  if (memory !== undefined && memory <= 4) return profile("low", "memory-limited");
  if (cores !== undefined && cores <= 4) return profile("low", "cpu-limited");
  if (memory !== undefined && memory >= 8 && cores !== undefined && cores >= 8) {
    return profile("high", "high-capability");
  }
  return profile("balanced", "balanced-default");
}

/**
 * Adapt FPS and resolution from measured render cost. A device can recover
 * only toward its original profile; runtime adaptation never exceeds its
 * initial resource grant.
 */
export function createAvatarFrameBudgetController(initial: AvatarFrameBudget): {
  snapshot: () => AvatarFrameBudget;
  recordFrameCost: (costMs: number) => AvatarFrameBudget | null;
} {
  const initialTier = initial.tier;
  const initialIndex = TIER_ORDER.indexOf(initialTier);
  let currentIndex = initialIndex >= 0 ? initialIndex : 1;
  let current = profile(TIER_ORDER[currentIndex], initial.reason);
  let samples: number[] = [];
  let healthyWindows = 0;

  const snapshot = (): AvatarFrameBudget => ({ ...current });

  const recordFrameCost = (costMs: number): AvatarFrameBudget | null => {
    if (typeof costMs !== "number" || !Number.isFinite(costMs) || costMs < 0) return null;

    samples.push(costMs);
    if (samples.length < 24) return null;

    const ordered = samples.sort((a, b) => a - b);
    const p95 = ordered[Math.ceil(ordered.length * 0.95) - 1];
    samples = [];

    const frameIntervalMs = 1000 / current.targetFps;
    if (p95 > frameIntervalMs * 0.65) {
      healthyWindows = 0;
      if (currentIndex === 0) return null;
      currentIndex -= 1;
      current = profile(TIER_ORDER[currentIndex], "runtime-pressure");
      return snapshot();
    }

    if (p95 < frameIntervalMs * 0.25) {
      healthyWindows += 1;
      if (healthyWindows >= 3 && currentIndex < initialIndex) {
        currentIndex += 1;
        healthyWindows = 0;
        current = profile(TIER_ORDER[currentIndex], "runtime-recovery");
        return snapshot();
      }
      return null;
    }

    healthyWindows = 0;
    return null;
  };

  return { snapshot, recordFrameCost };
}

/**
 * Decide whether a frame is due according to the current FPS budget.
 */
export function shouldRunAvatarRenderLoop(pageVisible: boolean, intersectsViewport: boolean): boolean {
  return pageVisible && intersectsViewport;
}

export function shouldRenderAvatarFrame(
  now: number,
  lastRenderedAt: number | null,
  budget: Pick<AvatarFrameBudget, "targetFps">,
): boolean {
  if (!Number.isFinite(now) || now < 0) return false;
  if (!Number.isFinite(budget.targetFps) || budget.targetFps <= 0 || budget.targetFps > 120) return false;
  if (lastRenderedAt === null) return true;
  if (!Number.isFinite(lastRenderedAt) || lastRenderedAt < 0 || now < lastRenderedAt) return false;

  const frameIntervalMs = 1000 / budget.targetFps;
  return now - lastRenderedAt + 0.5 >= frameIntervalMs;
}
