/** Canonical six-dimensional context bucketing shared by live P23 and Synaptic native policy materialization. */
export interface P23PolicyContextNeeds {
  energy: number;
  cognitiveLoad: number;
  uncertainty: number;
  novelty: number;
  goalPressure: number;
  socialNeed: number;
}
const clampUnit = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
function bucket(value: number, size = 4): number {
  return Math.max(0, Math.min(size - 1, Math.round(clampUnit(value) * (size - 1))));
}
export function p23PolicyContextKeyFromNeeds(needs: P23PolicyContextNeeds): string {
  return `e${bucket(needs.energy)}|c${bucket(needs.cognitiveLoad)}|u${bucket(needs.uncertainty)}|n${bucket(needs.novelty)}|g${bucket(needs.goalPressure)}|s${bucket(needs.socialNeed)}`;
}
