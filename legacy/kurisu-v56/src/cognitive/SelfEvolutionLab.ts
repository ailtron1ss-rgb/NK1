/**
 * SelfEvolutionLab v1 — safe self-programming boundary.
 * It can generate structured change proposals and benchmark plans, but never
 * executes arbitrary source code. Applying a proposal remains a user action.
 */
import { clamp, readJson, uid, writeJson } from './StateVault';

export type EvolutionLayer = 'behavior' | 'prompt' | 'memory' | 'routing' | 'ui' | 'code';
export interface EvolutionProposal {
  id: string;
  createdAt: number;
  title: string;
  layer: EvolutionLayer;
  reason: string;
  expectedGain: number;
  cost: number;
  risk: number;
  benchmark: string[];
  patch: Record<string, unknown>;
  status: 'proposed' | 'approved' | 'rejected' | 'sandboxed' | 'deployed' | 'rolled_back';
}

const KEY = 'kurisu_self_evolution_lab_v1';

export interface ModuleScaffold {
  id: string;
  title: string;
  purpose: string;
  source: string;
  tests: string[];
  status: 'draft' | 'approved' | 'rejected';
  createdAt: number;
}

const MODULE_KEY = 'kurisu_module_scaffolds_v1';

function loadModules(): ModuleScaffold[] {
  return readJson<ModuleScaffold[]>(MODULE_KEY, []);
}
function saveModules(v: ModuleScaffold[]) { writeJson(MODULE_KEY, v.slice(0, 12)); }

const MAX = 24;

class SelfEvolutionLab {
  private proposals = readJson<EvolutionProposal[]>(KEY, []);
  private save() { this.proposals = this.proposals.slice(0, MAX); writeJson(KEY, this.proposals); }
  list() { return [...this.proposals]; }
  propose(input: Omit<EvolutionProposal, 'id' | 'createdAt' | 'status'>) {
    const p: EvolutionProposal = { ...input, id: uid('evo'), createdAt: Date.now(), status: 'proposed', expectedGain: clamp(input.expectedGain), risk: clamp(input.risk), cost: clamp(input.cost) };
    this.proposals.unshift(p); this.save(); return p;
  }
  setStatus(id: string, status: EvolutionProposal['status']) {
    const p = this.proposals.find(x => x.id === id); if (!p) return false;
    p.status = status; this.save(); return true;
  }
  rank(p: EvolutionProposal) { return p.expectedGain * 0.45 - p.cost * 0.2 - p.risk * 0.35; }
  best() { return [...this.proposals].filter(p => p.status === 'proposed' || p.status === 'sandboxed').sort((a, b) => this.rank(b) - this.rank(a))[0]; }
  generateModuleScaffold(input: { id: string; title: string; purpose: string; interfaces?: string[] }) {
    const safeId = input.id.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 48) || uid('module');
    const interfaces = (input.interfaces || []).slice(0, 8);
    const source = `/** Generated scaffold — not executable until reviewed and wired into ModuleManager. */\nexport interface ${safeId.replace(/[-_](\w)/g, (_, c) => c.toUpperCase())}Context {\n  now: number;\n  signals: Record<string, number>;\n}\n\nexport function create${safeId.replace(/[-_](\w)/g, (_, c) => c.toUpperCase())}() {\n  return {\n    id: '${safeId}',\n    title: ${JSON.stringify(input.title)},\n    purpose: ${JSON.stringify(input.purpose)},\n    interfaces: ${JSON.stringify(interfaces)},\n    evaluate(ctx: ${safeId.replace(/[-_](\w)/g, (_, c) => c.toUpperCase())}Context) {\n      return { score: 0, reason: 'TODO: implement and test' };\n    }\n  };\n}\n`;
    const item: ModuleScaffold = { id: uid('module'), title: input.title.slice(0, 120), purpose: input.purpose.slice(0, 240), source, tests: ['tsc --noEmit', 'unit: deterministic input/output', 'mobile: memory < budget'], status: 'draft', createdAt: Date.now() };
    saveModules([item, ...loadModules()]);
    return item;
  }

  moduleScaffolds() { return loadModules(); }

  promptHint(max = 900) {
    const p = this.best();
    return ['[SELF-EVOLUTION LAB]', p ? `best_proposal=${p.title} layer=${p.layer} gain=${Math.round(p.expectedGain)} risk=${Math.round(p.risk)} status=${p.status}` : 'best_proposal=none', 'Never execute arbitrary downloaded code. Source-code changes require sandbox + tests + explicit user approval + rollback.'].join('\n').slice(0, max);
  }
}
export const selfEvolutionLab = new SelfEvolutionLab();
