/**
 * RuntimeGovernor v1
 * Mobile-first resource policy for browser/Termux deployments.
 *
 * Important: a browser cannot reliably read Android CPU temperature or total
 * RAM. Those signals are therefore optional and may be supplied by a native
 * wrapper later. The governor never pretends unavailable telemetry exists.
 */

export type PerformanceProfile = 'performance' | 'balanced' | 'powersave';

export interface RuntimeSnapshot {
  profile: PerformanceProfile;
  battery: number | null;
  charging: boolean | null;
  memoryMb: number | null;
  cpuTemperatureC: number | null;
  fpsTarget: 15 | 20 | 25 | 30;
  backgroundTasks: boolean;
  localNeuralAllowed: boolean;
  reason: string;
  updatedAt: number;
}

const KEY = 'kurisu_runtime_governor_v1';
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function readManualProfile(): PerformanceProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.manualProfile === 'performance' || parsed.manualProfile === 'balanced' || parsed.manualProfile === 'powersave'
      ? parsed.manualProfile
      : null;
  } catch { return null; }
}

function saveManualProfile(profile: PerformanceProfile | null) {
  try {
    const current = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (profile) current.manualProfile = profile;
    else delete current.manualProfile;
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch { /* best effort */ }
}

let snapshot: RuntimeSnapshot = {
  profile: readManualProfile() || 'balanced',
  battery: null,
  charging: null,
  memoryMb: null,
  cpuTemperatureC: null,
  fpsTarget: 25,
  backgroundTasks: true,
  localNeuralAllowed: false,
  reason: 'Ожидаю телеметрию устройства.',
  updatedAt: Date.now()
};

function publish() {
  try { window.dispatchEvent(new CustomEvent('kurisu-runtime', { detail: { ...snapshot } })); } catch { /* */ }
}

function recompute() {
  const manual = readManualProfile();
  let profile: PerformanceProfile = manual || 'performance';
  let reason = manual ? 'Профиль выбран пользователем.' : 'Автоматический режим.';

  if (!manual) {
    if (snapshot.cpuTemperatureC != null && snapshot.cpuTemperatureC >= 45) {
      profile = 'powersave'; reason = 'Температура CPU выше 45°C.';
    } else if (snapshot.battery != null && snapshot.battery < 0.15 && !snapshot.charging) {
      profile = 'powersave'; reason = 'Низкий заряд батареи.';
    } else if (snapshot.memoryMb != null && snapshot.memoryMb > 1536) {
      profile = 'balanced'; reason = 'Использование памяти выше 1.5 ГБ.';
    } else if (snapshot.battery != null && snapshot.battery < 0.25 && !snapshot.charging) {
      profile = 'balanced'; reason = 'Заряд батареи снижается.';
    }
  }

  snapshot = {
    ...snapshot,
    profile,
    fpsTarget: profile === 'performance' ? 30 : profile === 'balanced' ? 25 : 15,
    backgroundTasks: profile !== 'powersave',
    localNeuralAllowed: profile === 'performance' || (profile === 'balanced' && !!snapshot.charging),
    reason,
    updatedAt: Date.now()
  };
  publish();
}

async function attachBattery() {
  try {
    const nav = navigator as any;
    if (!nav.getBattery) return;
    const battery = await nav.getBattery();
    const update = () => {
      snapshot = { ...snapshot, battery: clamp01(Number(battery.level)), charging: !!battery.charging };
      recompute();
    };
    battery.addEventListener('levelchange', update);
    battery.addEventListener('chargingchange', update);
    update();
  } catch { /* optional API */ }
}

function sampleMemory() {
  try {
    const memory = (performance as any).memory;
    if (memory?.usedJSHeapSize) {
      snapshot = { ...snapshot, memoryMb: Math.round(memory.usedJSHeapSize / 1048576) };
      recompute();
    }
  } catch { /* optional */ }
}

export const runtimeGovernor = {
  get(): RuntimeSnapshot { return { ...snapshot }; },
  setProfile(profile: PerformanceProfile | null) {
    saveManualProfile(profile);
    recompute();
  },
  setNativeTelemetry(input: { cpuTemperatureC?: number | null; memoryMb?: number | null }) {
    snapshot = {
      ...snapshot,
      cpuTemperatureC: input.cpuTemperatureC ?? snapshot.cpuTemperatureC,
      memoryMb: input.memoryMb ?? snapshot.memoryMb
    };
    recompute();
  },
  shouldRunBackgroundWork(): boolean { return snapshot.backgroundTasks; },
  canLoadLocalNeural(): boolean { return snapshot.localNeuralAllowed; },
  fps(): number { return snapshot.fpsTarget; }
};

if (typeof window !== 'undefined') {
  attachBattery();
  sampleMemory();
  setInterval(sampleMemory, 15000);
}
