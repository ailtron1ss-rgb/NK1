/**
 * Workspace ignition metrics — bounded summary of the working workspace.
 *
 * WorkPass-A03: `competitionIntensity` clamped the raw `lastCompetition` count
 * into [0,1], so any non-empty workspace reported maximum competition and the
 * ignition score could not distinguish one competitor from eight. The metric is
 * now normalised by capacity, `limitedCapacity` means "interference pressure"
 * (it is near zero for an under-filled workspace) and `updatedAt` is an optional
 * logical tick so persisted metrics stay replay-deterministic.
 */
import type { WorkspaceStateV2 } from './RecurrentWorkspaceV2.ts';

export interface WorkspaceIgnitionState {
  version: 1;
  ignitionStrength: number;
  broadcastBreadth: number;
  recurrenceDepth: number;
  competitionIntensity: number;
  perturbability: number;
  limitedCapacity: number;
  samples: number;
  updatedAt: number;
}

export function defaultWorkspaceIgnition(): WorkspaceIgnitionState {
  return { version: 1, ignitionStrength: 0, broadcastBreadth: 0, recurrenceDepth: 0, competitionIntensity: 0, perturbability: 0, limitedCapacity: 0, samples: 0, updatedAt: 0 };
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function updateWorkspaceIgnition(prev: WorkspaceIgnitionState, w: WorkspaceStateV2, perturbation = 0, at = prev.updatedAt): WorkspaceIgnitionState {
  const capacity = Number.isFinite(w.capacity) && w.capacity > 0 ? w.capacity : 1;
  const breadth = clamp(w.items.length / Math.max(1, capacity));
  const recurrence = clamp(w.recurrence / 8);
  // Competition is a fill ratio against capacity, never a raw count.
  const competitors = Number.isFinite(w.lastCompetition) && w.lastCompetition >= 0 ? w.lastCompetition : 0;
  const competition = clamp(competitors / Math.max(1, capacity * 2));
  // Capacity pressure: a lone item in a five-slot workspace is not capacity
  // limited; pressure only rises as the coalition approaches capacity.
  const interference = clamp(Math.pow(breadth, 3));
  const ignition = clamp(breadth * 0.35 + recurrence * 0.35 + competition * 0.15 + clamp(perturbation) * 0.15);
  return {
    version: 1,
    ignitionStrength: ignition,
    broadcastBreadth: breadth,
    recurrenceDepth: recurrence,
    competitionIntensity: competition,
    perturbability: clamp(perturbation),
    limitedCapacity: interference,
    samples: Number.isSafeInteger(prev.samples) && prev.samples >= 0 ? Math.min(Number.MAX_SAFE_INTEGER - 1, prev.samples) + 1 : 1,
    updatedAt: Number.isFinite(at) && at >= 0 ? at : 0,
  };
}
