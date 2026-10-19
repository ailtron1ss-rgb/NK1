/**
 * Energy Budget — limits autonomous work on mid-range Android.
 * Prevents "turn the phone into a heater" failure mode.
 */

export interface BudgetState {
  maxAutonomousPerHour: number;
  maxNeuralLoadsPerDay: number;
  maxSearchPerHour: number;
  autonomousUsed: number;
  neuralLoads: number;
  searchUsed: number;
  hourKey: string;
  dayKey: string;
}

const KEY = 'kurisu_energy_budget_v1';

function hourKey() {
  const d = new Date();
  return `${d.toDateString()}-${d.getHours()}`;
}
function dayKey() {
  return new Date().toDateString();
}

function load(): BudgetState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as BudgetState;
      if (s.hourKey !== hourKey()) {
        s.hourKey = hourKey();
        s.autonomousUsed = 0;
        s.searchUsed = 0;
      }
      if (s.dayKey !== dayKey()) {
        s.dayKey = dayKey();
        s.neuralLoads = 0;
      }
      return s;
    }
  } catch { /* ignore */ }
  return {
    maxAutonomousPerHour: 6,
    maxNeuralLoadsPerDay: 8,
    maxSearchPerHour: 10,
    autonomousUsed: 0,
    neuralLoads: 0,
    searchUsed: 0,
    hourKey: hourKey(),
    dayKey: dayKey()
  };
}

function save(s: BudgetState) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export const energyBudget = {
  get(): BudgetState {
    return load();
  },
  canAutonomous(): boolean {
    const s = load();
    return s.autonomousUsed < s.maxAutonomousPerHour;
  },
  recordAutonomous() {
    const s = load();
    s.autonomousUsed += 1;
    save(s);
  },
  canSearch(): boolean {
    const s = load();
    return s.searchUsed < s.maxSearchPerHour;
  },
  recordSearch() {
    const s = load();
    s.searchUsed += 1;
    save(s);
  },
  canLoadNeural(): boolean {
    const s = load();
    return s.neuralLoads < s.maxNeuralLoadsPerDay;
  },
  recordNeuralLoad() {
    const s = load();
    s.neuralLoads += 1;
    save(s);
  }
};
