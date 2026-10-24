/**
 * Bounded initiative policy for the organism's internal drive loop.
 *
 * This module is deliberately pure: callers provide the current internal state
 * and persist the returned decision through the canonical runtime state store.
 * It never executes tools or performs side effects itself.
 */
export const INITIATIVE_DEFAULTS = Object.freeze({
  minimumEnergy: 0.2,
  maximumThreat: 0.8,
  minimumCuriosity: 0.35,
  cooldownMs: 60 * 60 * 1000,
  maxReasonLength: 240,
});

const finiteUnit = (value, fallback = 0) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

const finiteTime = (value, fallback = 0) =>
  Number.isFinite(value) && value >= 0 ? value : fallback;

/**
 * Decide whether an unsolicited initiative cycle is justified.
 *
 * @param {object} state
 * @param {number} nowMs wall-clock timestamp in milliseconds
 * @returns {{allowed:boolean, reason:string, nextEligibleAt:number|null, priority:number}}
 */
export function evaluateInitiative(state = {}, nowMs = Date.now()) {
  const now = finiteTime(nowMs, Date.now());
  const energy = finiteUnit(state.energy);
  const threat = finiteUnit(state.threat);
  const curiosity = finiteUnit(state.curiosity);
  const confidence = finiteUnit(state.confidence, 0.5);
  const lastInitiativeAt = finiteTime(state.lastInitiativeAt);
  const cooldownMs = Number.isFinite(state.cooldownMs) && state.cooldownMs >= 0
    ? state.cooldownMs
    : INITIATIVE_DEFAULTS.cooldownMs;
  const nextEligibleAt = lastInitiativeAt + cooldownMs;

  if (energy < INITIATIVE_DEFAULTS.minimumEnergy) {
    return { allowed: false, reason: "energy-below-threshold", nextEligibleAt: null, priority: 0 };
  }
  if (threat > INITIATIVE_DEFAULTS.maximumThreat) {
    return { allowed: false, reason: "threat-priority", nextEligibleAt: null, priority: 0 };
  }
  if (curiosity < INITIATIVE_DEFAULTS.minimumCuriosity) {
    return { allowed: false, reason: "insufficient-curiosity", nextEligibleAt: null, priority: 0 };
  }
  if (lastInitiativeAt > 0 && now < nextEligibleAt) {
    return { allowed: false, reason: "cooldown", nextEligibleAt, priority: 0 };
  }

  // Curiosity drives initiative, while confidence and energy keep it bounded.
  const priority = Number((curiosity * 0.55 + confidence * 0.2 + energy * 0.25).toFixed(4));
  return {
    allowed: true,
    reason: "curiosity-drive-ready",
    nextEligibleAt: now + cooldownMs,
    priority,
  };
}

/** Produce a short, inspectable rationale for an accepted initiative. */
export function explainInitiative(decision, topic = "current interests") {
  if (!decision || decision.allowed !== true) {
    return String(decision?.reason ?? "initiative-not-approved");
  }
  const cleanTopic = String(topic).replace(/[\r\n\t]+/g, " ").trim()
    .slice(0, INITIATIVE_DEFAULTS.maxReasonLength);
  return `Internal curiosity is high enough to initiate a check-in about ${cleanTopic || "a relevant topic"}.`;
}
