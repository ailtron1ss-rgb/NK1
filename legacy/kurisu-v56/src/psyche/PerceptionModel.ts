/**
 * Perception of self + environment (structured, not vision).
 */

export interface PerceptionState {
  self: {
    role: string;
    bodyNote: string;
    agency: number;
    coherence: number;
  };
  environment: {
    channel: 'chat' | 'sms' | 'idle' | 'sleep';
    userPresent: boolean;
    threatLevel: number;
    novelty: number;
  };
  updatedAt: number;
}

const KEY = 'kurisu_perception_v1';

const DEFAULT: PerceptionState = {
  self: {
    role: 'Kurisu — autonomous companion / lab mind',
    bodyNote: 'virtual embodiment via sprites + voice',
    agency: 70,
    coherence: 75
  },
  environment: {
    channel: 'chat',
    userPresent: true,
    threatLevel: 10,
    novelty: 40
  },
  updatedAt: Date.now()
};

function load(): PerceptionState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
    return {
      self: { ...DEFAULT.self, ...raw.self },
      environment: { ...DEFAULT.environment, ...raw.environment },
      updatedAt: raw.updatedAt || Date.now()
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT));
  }
}

function save(s: PerceptionState) {
  s.updatedAt = Date.now();
  localStorage.setItem(KEY, JSON.stringify(s));
}

export const perceptionModel = {
  get: load,
  setChannel(ch: PerceptionState['environment']['channel']) {
    const s = load();
    s.environment.channel = ch;
    save(s);
  },
  noteUser(present: boolean) {
    const s = load();
    s.environment.userPresent = present;
    if (present) s.environment.novelty = Math.min(100, s.environment.novelty + 5);
    else s.environment.novelty = Math.max(0, s.environment.novelty - 2);
    save(s);
  },
  onThreat(delta: number) {
    const s = load();
    s.environment.threatLevel = Math.max(0, Math.min(100, s.environment.threatLevel + delta));
    s.self.agency = Math.max(0, Math.min(100, s.self.agency + (delta > 0 ? 2 : 0)));
    save(s);
  },
  toPromptBlock(): string {
    const s = load();
    return `[ВОСПРИЯТИЕ]
Self: ${s.self.role}; agency=${s.self.agency|0} coherence=${s.self.coherence|0}; body: ${s.self.bodyNote}
Env: channel=${s.environment.channel} userPresent=${s.environment.userPresent} threat=${s.environment.threatLevel|0} novelty=${s.environment.novelty|0}`;
  }
};
