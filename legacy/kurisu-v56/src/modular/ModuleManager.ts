/**
 * Dynamic module registry — enable/disable "brain departments" without full reload.
 */
import { BrainModule, ModuleId, ModuleStatus } from './types';

const STATUS_KEY = 'kurisu_module_status_v1';

function loadStatus(): Partial<Record<ModuleId, ModuleStatus>> {
  try {
    return JSON.parse(localStorage.getItem(STATUS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStatus(s: Partial<Record<ModuleId, ModuleStatus>>) {
  localStorage.setItem(STATUS_KEY, JSON.stringify(s));
}

class ModuleManager {
  private modules = new Map<ModuleId, BrainModule>();

  register(mod: BrainModule) {
    const saved = loadStatus()[mod.id];
    if (saved === 'disabled') {
      mod.status = 'disabled';
    } else {
      mod.status = mod.status === 'error' ? 'error' : 'active';
      mod.activate();
    }
    this.modules.set(mod.id, mod);
  }

  get(id: ModuleId) {
    return this.modules.get(id);
  }

  list(): BrainModule[] {
    return [...this.modules.values()];
  }

  setEnabled(id: ModuleId, enabled: boolean) {
    const m = this.modules.get(id);
    if (!m) return;
    if (enabled) {
      m.status = 'active';
      m.activate();
    } else {
      m.deactivate();
      m.status = 'disabled';
    }
    const st = loadStatus();
    st[id] = m.status;
    saveStatus(st);
  }

  activeContributors() {
    return this.list().filter(m => m.status === 'active' && m.contribute);
  }
}

export const moduleManager = new ModuleManager();
