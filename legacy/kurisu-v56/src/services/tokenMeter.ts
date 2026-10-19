/**
 * Approximate token meter + cloud auto-switch.
 * Real provider quotas differ; we estimate ~4 chars/token and track per provider.
 */

import {
  loadProviders,
  saveProviders,
  getActiveCloudProvider,
  ProviderConfig
} from './providerConfig';

const KEY = 'kurisu_token_meter_v1';
const DAILY_SOFT = 120_000; // soft daily budget per provider (est. tokens)

interface MeterState {
  day: string;
  used: Record<string, number>; // providerId -> tokens
  lastSwitchNote: string;
}

function day() {
  return new Date().toDateString();
}

function load(): MeterState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.day === day()) return s;
  } catch { /* */ }
  return { day: day(), used: {}, lastSwitchNote: '' };
}

function save(s: MeterState) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil((text || '').length / 4));
}

export const tokenMeter = {
  record(providerId: string, prompt: string, completion: string) {
    const s = load();
    const add = estimateTokens(prompt) + estimateTokens(completion);
    s.used[providerId] = (s.used[providerId] || 0) + add;
    save(s);
    return s.used[providerId];
  },
  remaining(providerId: string): number {
    const s = load();
    return Math.max(0, DAILY_SOFT - (s.used[providerId] || 0));
  },
  snapshot() {
    const s = load();
    const active = getActiveCloudProvider();
    const id = active?.id || 'none';
    const used = s.used[id] || 0;
    return {
      providerId: id,
      providerName: active?.name || '—',
      model: active?.model || '—',
      used,
      limit: DAILY_SOFT,
      remaining: Math.max(0, DAILY_SOFT - used),
      lastSwitchNote: s.lastSwitchNote
    };
  },
  /** Pick next cloud with key+enabled and remaining budget; else null → local */
  pickNextCloud(excludeId?: string): ProviderConfig | null {
    const list = loadProviders().filter(
      p => p.id !== 'local' && p.enabled && p.apiKey.trim().length > 8 && p.id !== excludeId
    );
    // priority order
    const order = ['gemini', 'groq', 'openrouter', 'together'];
    list.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    for (const p of list) {
      if (this.remaining(p.id) > 800) return p;
    }
    return null;
  },
  noteSwitch(msg: string) {
    const s = load();
    s.lastSwitchNote = msg;
    save(s);
    try {
      window.dispatchEvent(new CustomEvent('kurisu-model-switch', { detail: { msg } }));
    } catch { /* */ }
  },
  softExhausted(providerId: string): boolean {
    return this.remaining(providerId) < 500;
  }
};
