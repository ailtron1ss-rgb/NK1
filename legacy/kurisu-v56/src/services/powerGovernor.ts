import { runtimeGovernor } from './runtimeGovernor';

/**
 * Battery / thermal graceful degradation for mid-range Android.
 * Uses Battery Status API + heuristics (no real thermal sensor in browser).
 */

export type PowerMode = 'normal' | 'saver' | 'critical';

interface PowerState {
  mode: PowerMode;
  battery: number | null;
  charging: boolean | null;
  note: string;
}

let state: PowerState = {
  mode: 'normal',
  battery: null,
  charging: null,
  note: ''
};

async function readBattery() {
  try {
    const nav = navigator as any;
    if (!nav.getBattery) return;
    const b = await nav.getBattery();
    state.battery = b.level;
    state.charging = b.charging;
    const update = () => {
      state.battery = b.level;
      state.charging = b.charging;
      recompute();
    };
    b.addEventListener('levelchange', update);
    b.addEventListener('chargingchange', update);
    recompute();
  } catch {
    /* */
  }
}

function recompute() {
  const level = state.battery;
  if (level != null && level < 0.12 && !state.charging) {
    state.mode = 'critical';
    state.note = 'Батарея низкая — берегу ресурсы, облако предпочтительнее.';
  } else if (level != null && level < 0.2 && !state.charging) {
    state.mode = 'saver';
    state.note = 'Экономный режим — локальная модель может быть отложена.';
  } else {
    state.mode = 'normal';
    state.note = '';
  }
  try {
    window.dispatchEvent(new CustomEvent('kurisu-power', { detail: { ...state } }));
  } catch {
    /* */
  }
}

readBattery();

export const powerGovernor = {
  get(): PowerState {
    return { ...state };
  },
  /** Prefer skip heavy local neural */
  preferCloudOnly(): boolean {
    return state.mode !== 'normal';
  },
  avatarFps(): number {
    return Math.min(runtimeGovernor.fps(), state.mode === 'critical' ? 15 : state.mode === 'saver' ? 20 : 30);
  }
};
