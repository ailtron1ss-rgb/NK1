/**
 * Single shared state container — unified self-perception across modules.
 */
import { neuroEngine, EmotionVector, PersonalityTraits } from '../cognitive/NeuroEngine';

export interface MetaTags {
  valence: number;
  importance: number;
  certainty: number;
  urgency: number;
  category: string;
}

export interface GlobalSnapshot {
  at: number;
  emotions: EmotionVector;
  traits: PersonalityTraits;
  goals: string[];
  recentActions: string[];
  activeMemories: string[];
  priorities: Record<string, number>;
  physical: {
    battery: number | null;
    charging: boolean | null;
    hour: number;
    online: boolean;
  };
  internalTick: number;
}

const GOALS_KEY = 'kurisu_global_goals_v1';
const ACTIONS_KEY = 'kurisu_global_actions_v1';
const TICK_KEY = 'kurisu_internal_tick_v1';

function loadGoals(): string[] {
  try {
    return JSON.parse(localStorage.getItem(GOALS_KEY) || '[]');
  } catch {
    return [];
  }
}

function loadActions(): string[] {
  try {
    return JSON.parse(localStorage.getItem(ACTIONS_KEY) || '[]');
  } catch {
    return [];
  }
}

export const globalState = {
  snapshot(): GlobalSnapshot {
    let battery: number | null = null;
    let charging: boolean | null = null;
    try {
      const p = (window as any).__kurisuPower;
      if (p) {
        battery = p.battery ?? null;
        charging = p.charging ?? null;
      }
    } catch {
      /* */
    }
    let tick = 0;
    try {
      tick = Number(localStorage.getItem(TICK_KEY) || '0');
    } catch {
      /* */
    }
    return {
      at: Date.now(),
      emotions: neuroEngine.getEmotions(),
      traits: neuroEngine.getTraits(),
      goals: loadGoals(),
      recentActions: loadActions().slice(0, 12),
      activeMemories: [],
      priorities: {},
      physical: {
        battery,
        charging,
        hour: new Date().getHours(),
        online: typeof navigator !== 'undefined' ? navigator.onLine : true
      },
      internalTick: tick
    };
  },

  pushAction(text: string) {
    const a = [text.slice(0, 120), ...loadActions()].slice(0, 30);
    localStorage.setItem(ACTIONS_KEY, JSON.stringify(a));
  },

  setGoals(goals: string[]) {
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals.slice(0, 12)));
  },

  bumpTick() {
    let tick = 0;
    try {
      tick = Number(localStorage.getItem(TICK_KEY) || '0') + 1;
      localStorage.setItem(TICK_KEY, String(tick));
    } catch {
      /* */
    }
    return tick;
  },

  tag(partial: Partial<MetaTags>): MetaTags {
    return {
      valence: partial.valence ?? 0,
      importance: partial.importance ?? 0.5,
      certainty: partial.certainty ?? 0.5,
      urgency: partial.urgency ?? 0.3,
      category: partial.category ?? 'general'
    };
  }
};
