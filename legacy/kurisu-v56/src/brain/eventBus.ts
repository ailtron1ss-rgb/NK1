/**
 * Tiny event bus — departments react without hard-wiring App.tsx forever.
 */

export type KurisuEventType =
  | 'user_message'
  | 'kurisu_reply'
  | 'night'
  | 'search_done'
  | 'promise_added'
  | 'low_attention'
  | 'contradiction'
  | 'gold_saved'
  | 'hub_tick'
  | 'modules_changed'
  | 'synergy_reflect';

export interface KurisuEvent {
  type: KurisuEventType;
  at: number;
  payload?: Record<string, unknown>;
}

type Handler = (e: KurisuEvent) => void;

const handlers = new Map<KurisuEventType | '*', Set<Handler>>();
const recent: KurisuEvent[] = [];

export const eventBus = {
  on(type: KurisuEventType | '*', fn: Handler) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type)!.add(fn);
    return () => handlers.get(type)!.delete(fn);
  },
  emit(type: KurisuEventType, payload?: Record<string, unknown>) {
    const e: KurisuEvent = { type, at: Date.now(), payload };
    recent.unshift(e);
    if (recent.length > 40) recent.pop();
    handlers.get(type)?.forEach(fn => {
      try { fn(e); } catch { /* */ }
    });
    handlers.get('*')?.forEach(fn => {
      try { fn(e); } catch { /* */ }
    });
  },
  recent(n = 10) {
    return recent.slice(0, n);
  }
};
