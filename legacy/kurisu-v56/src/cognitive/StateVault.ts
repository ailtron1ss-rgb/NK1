/**
 * StateVault v1 — resilient browser storage for the cognitive stack.
 * Android rule: never crash cognition because localStorage is unavailable/full.
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string) {
  try { localStorage.removeItem(key); } catch { /* best effort */ }
}

export function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
}

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
