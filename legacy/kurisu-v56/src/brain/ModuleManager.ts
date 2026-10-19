/**
 * Dynamic module registry — plugin-like enable/disable without restart.
 * Modules are in-process TS services, not separate WASM downloads (mobile-safe).
 */

import { readJson, writeJson } from '../cognitive/StateVault';
import { eventBus } from './eventBus';

export type ModuleId =
  | 'neuro'
  | 'ace_memory'
  | 'micro_experts'
  | 'self_improve'
  | 'power_governor'
  | 'token_meter'
  | 'live2d'
  | 'voice'
  | 'proactive'
  | 'core_enhancements'
  | 'emergent_behavior';

export interface BrainModule {
  id: ModuleId;
  name: string;
  description: string;
  enabled: boolean;
  core: boolean; // cannot disable
}

const KEY = 'kurisu_modules_v1';

const CATALOG: BrainModule[] = [
  {
    id: 'neuro',
    name: 'NeuroEngine',
    description: 'Traits, frames, emotions',
    enabled: true,
    core: true
  },
  {
    id: 'ace_memory',
    name: 'ACE Memory',
    description: 'Persona/Episodic/Working/Micro',
    enabled: true,
    core: false
  },
  {
    id: 'micro_experts',
    name: 'MiCRo Experts',
    description: 'language/logic/social/knowledge',
    enabled: true,
    core: false
  },
  {
    id: 'self_improve',
    name: 'Self-Improve',
    description: 'Proposals + rollback (user approve)',
    enabled: true,
    core: false
  },
  {
    id: 'power_governor',
    name: 'Power Governor',
    description: 'Battery-aware mode',
    enabled: true,
    core: false
  },
  {
    id: 'token_meter',
    name: 'Token Meter',
    description: 'Cloud token estimate + switch',
    enabled: true,
    core: false
  },
  {
    id: 'live2d',
    name: 'Live2D Avatar',
    description: 'Avatar runtime',
    enabled: true,
    core: false
  },
  {
    id: 'voice',
    name: 'Voice I/O',
    description: 'TTS + STT',
    enabled: true,
    core: false
  },
  {
    id: 'proactive',
    name: 'Proactive Loop',
    description: 'Idle initiative messages',
    enabled: true,
    core: false
  },
  {
    id: 'core_enhancements',
    name: 'Core Enhancements',
    description: 'Routines, déjà-vu, memory retention, emotional contagion',
    enabled: true,
    core: false
  },
  {
    id: 'emergent_behavior',
    name: 'Emergent Behavior',
    description: 'Rare creative/dream impulses without constant inference',
    enabled: true,
    core: false
  }
];

function load(): BrainModule[] {
  const saved = readJson<BrainModule[]>(KEY, []);
  return CATALOG.map(c => {
    const f = saved.find(x => x.id === c.id);
    return f ? { ...c, enabled: c.core ? true : !!f.enabled } : { ...c };
  });
}

function save(list: BrainModule[]) {
  writeJson(KEY, list);
}

export const moduleManager = {
  list(): BrainModule[] {
    return load();
  },
  isEnabled(id: ModuleId): boolean {
    const m = load().find(x => x.id === id);
    return m ? m.enabled : true;
  },
  setEnabled(id: ModuleId, enabled: boolean) {
    const list = load().map(m => {
      if (m.id !== id) return m;
      if (m.core) return m;
      return { ...m, enabled };
    });
    save(list);
    eventBus.emit('modules_changed' as any, { id, enabled });
  }
};
