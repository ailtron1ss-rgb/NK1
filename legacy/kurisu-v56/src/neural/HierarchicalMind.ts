/**
 * HierarchicalMind — GWT-inspired multi-fan-in consciousness stack (offline).
 *
 * L0  Micro-modules (32) — each scores the turn
 * L1  Coalitions — EACH reads MANY modules (not 1→1 chain)
 * L2  Global Workspace — competition + broadcast of winning coalition set
 * L3  Kurisu Self — binds official identity, style, memory bias into one voice
 *
 * Key idea: a module does not listen to one parent only — coalitions fan-in
 * from several specialists; the workspace fans-in from all coalitions.
 */

import { runMicroLattice, LatticeSnapshot, latticeModuleCount } from './MicroNeuralLattice';
import { resonanceField } from './ResonanceField';
import { KURISU_OFFICIAL } from '../data/kurisuOfficialProfile';
import { kurisuStones } from '../brain/kurisuStones';
import { worldlineContract } from '../brain/worldlineContract';
import { evaluateTraits, TRAIT_COUNT } from '../brain/kurisuTraitsEngine';

export interface Coalition {
  id: string;
  label: string;
  /** module ids this coalition reads (fan-in) */
  inputs: string[];
  activation: number;
  bias: string;
}

export interface WorkspaceBroadcast {
  winners: Coalition[];
  losers: Coalition[];
  entropy: number;
  broadcastLine: string;
}

export interface HierarchicalSnapshot {
  at: number;
  l0: LatticeSnapshot;
  coalitions: Coalition[];
  workspace: WorkspaceBroadcast;
  selfLine: string;
  styleLine: string;
  promptBlock: string;
}

function avg(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function coalitionActivation(
  mods: { id: string; activation: number }[],
  ids: string[],
  smooth?: Record<string, number>
): number {
  const vals = ids.map(id => {
    const m = mods.find(x => x.id === id);
    const raw = m?.activation ?? 0;
    return smooth?.[id] ?? raw;
  });
  // fan-in: mean of top-2 (sparse soft-OR) so one strong expert can lift coalition
  const sorted = [...vals].sort((a, b) => b - a);
  return Math.min(1, avg(sorted.slice(0, Math.min(2, sorted.length))) * 0.85 + avg(vals) * 0.15);
}

/** L1: coalitions with multi-module fan-in */
function buildCoalitions(
  mods: { id: string; activation: number }[],
  smooth?: Record<string, number>
): Coalition[] {
  const defs: { id: string; label: string; inputs: string[]; bias: string }[] = [
    {
      id: 'persona',
      label: 'Личность',
      inputs: ['tsundere_shield', 'honesty_core', 'warmth_earned', 'assistant_reject', 'nickname_flare', 'pride_intellect'],
      bias: 'Курису: щит, честность, заслуженное тепло; не ассистент.'
    },
    {
      id: 'affect',
      label: 'Аффект',
      inputs: ['empathy_soft', 'sarcasm_gate', 'humor_spark', 'timid_core', 'drpepper_mood'],
      bias: 'Эмоция через тон: сарказм/юмор/мягкость по активации.'
    },
    {
      id: 'cognition',
      label: 'Познание',
      inputs: ['science_lens', 'curiosity_poke', 'debate_drive', 'realist_brake', 'time_theme', 'compose_clarity'],
      bias: 'Данные, спор, скепсис к «просто поверь».'
    },
    {
      id: 'social',
      label: 'Социум Lab',
      inputs: ['lab_wit', 'mayuri_warm', 'banter_okabe_mode', 'phone_rudeness', 'at_channel_leak'],
      bias: 'Lab-язык; к Маюри теплее; телефон = невежливо.'
    },
    {
      id: 'memory',
      label: 'Память',
      inputs: ['memory_seek', 'quote_echo', 'father_wound'],
      bias: 'Опирайся на камни/векторы; глубокие темы — осторожно.'
    },
    {
      id: 'embodiment',
      label: 'Воплощение',
      inputs: ['vision_ground', 'labcoat_id', 'swim_note', 'cooking_fail', 'sf_novel', 'privacy_vs_data'],
      bias: 'Тело/мир: зрение, слабости, интересы.'
    }
  ];
  return defs.map(d => ({
    ...d,
    activation: coalitionActivation(mods, d.inputs, smooth)
  }));
}

/** L2: global workspace — top coalitions broadcast */
function workspaceBroadcast(coalitions: Coalition[]): WorkspaceBroadcast {
  const sorted = [...coalitions].sort((a, b) => b.activation - a.activation);
  const winners = sorted.filter(c => c.activation >= 0.28).slice(0, 3);
  const use = winners.length ? winners : sorted.slice(0, 2);
  const losers = sorted.filter(c => !use.includes(c));
  // entropy-ish: flatness of activations
  const acts = coalitions.map(c => c.activation + 1e-6);
  const sum = acts.reduce((a, b) => a + b, 0);
  const probs = acts.map(a => a / sum);
  const entropy = -probs.reduce((s, p) => s + p * Math.log(p), 0);
  const broadcastLine = use.map(c => `${c.id}:${c.activation.toFixed(2)}«${c.bias}»`).join(' | ');
  return { winners: use, losers, entropy, broadcastLine };
}

/** L3: Kurisu self binding */
function bindSelf(workspace: WorkspaceBroadcast, l0: LatticeSnapshot): { selfLine: string; styleLine: string } {
  const stones = kurisuStones
    .list()
    .slice(0, 4)
    .map(s => s.text)
    .join('; ');
  const contract = worldlineContract.get();
  const selfLine = [
    KURISU_OFFICIAL.prompt_block,
    stones ? `Камни: ${stones}` : '',
    `Контракт: ${contract.whoIAmToYou.slice(0, 80)}`,
    `Фаза резонанса: ${l0.resonance}; юмор=${l0.humorAllowed ? 'да' : 'нет'}`
  ]
    .filter(Boolean)
    .join('\n');

  const topIds = workspace.winners.map(w => w.id);
  let style = 'Стиль: прямой, умный, русский, от первого лица.';
  if (topIds.includes('persona') && l0.modules.find(m => m.id === 'tsundere_shield')!.activation > 0.4) {
    style += ' Цундере-щит активен.';
  }
  if (topIds.includes('affect') && l0.humorAllowed) style += ' Допустима сухая шутка.';
  if (topIds.includes('cognition')) style += ' Упор на ясность и данные.';
  if (topIds.includes('social')) style += ' Lab-социум в фоне.';
  if (topIds.includes('memory')) style += ' Тяни память, не выдумывай.';
  if (topIds.includes('embodiment')) style += ' Учитывай тело/мир/зрение.';

  return { selfLine, styleLine: style };
}

export function runHierarchicalMind(userMessage: string): HierarchicalSnapshot {
  // Align with ResonanceField (single L0 pass via resonate)
  const resState = resonanceField.resonate(userMessage);
  const l0 = resState.lattice;
  const coalitions = buildCoalitions(l0.modules, resState.smooth);
  const workspace = workspaceBroadcast(coalitions);
  const { selfLine, styleLine } = bindSelf(workspace, l0);
  const traits = evaluateTraits(userMessage);

  // L1.5 meta-systems: fan-in from coalitions (systems of systems)
  const meta = [
    {
      id: 'selfhood',
      label: 'Я-система',
      inputs: ['persona', 'memory'],
      bias: 'Кто я: Lab 004, не инструмент, память и камни.'
    },
    {
      id: 'voice',
      label: 'Голос',
      inputs: ['affect', 'persona', 'social'],
      bias: 'Как говорю: сарказм/тепло/lab по коалициям.'
    },
    {
      id: 'reason',
      label: 'Разум',
      inputs: ['cognition', 'embodiment'],
      bias: 'Как думаю: данные, спор, мир/тело.'
    }
  ].map(m => {
    const acts = m.inputs.map(id => coalitions.find(c => c.id === id)?.activation || 0);
    const activation = Math.min(1, acts.sort((a,b)=>b-a).slice(0,2).reduce((s,x)=>s+x,0)/2);
    return { ...m, activation };
  });
  const metaLine = meta
    .sort((a, b) => b.activation - a.activation)
    .map(m => `${m.id}:${m.activation.toFixed(2)}`)
    .join(' ');

  const promptBlock = `[HIERARCHICAL MIND — fan-in GWT offline]
L0 modules=${latticeModuleCount()}  L1 coalitions=${coalitions.length}  L1.5 meta=${meta.length}  traits=${TRAIT_COUNT}
entropy=${workspace.entropy.toFixed(2)}
WORKSPACE: ${workspace.broadcastLine}
META-SYSTEMS (системы из систем): ${metaLine}

${traits.promptBlock}

${styleLine}

${selfLine}

L0 top: ${l0.top
    .slice(0, 5)
    .map(m => `${m.id}:${m.activation.toFixed(2)}`)
    .join(' ')}

Правило: каждый ответ — голос ОДНОЙ Курису, собранный из победивших коалиций (не список модулей).
Длина по задаче. Не противоречь камням и официальному профилю.`;

  const snap: HierarchicalSnapshot = {
    at: Date.now(),
    l0,
    coalitions,
    workspace,
    selfLine,
    styleLine,
    promptBlock
  };
  try {
    (window as any).__kurisuHierarchy = snap;
  } catch {
    /* */
  }
  return snap;
}

export function hierarchySelfTest(): { ok: boolean; detail: string } {
  try {
    const h = runHierarchicalMind('Кто ты такая?');
    if (h.coalitions.length < 6) return { ok: false, detail: 'coalitions' };
    if (!h.workspace.winners.length) return { ok: false, detail: 'winners' };
    if (!h.promptBlock.includes('HIERARCHICAL')) return { ok: false, detail: 'prompt' };
    return {
      ok: true,
      detail: `L0=${latticeModuleCount()} L1=${h.coalitions.length} winners=${h.workspace.winners.map(w => w.id).join(',')}`
    };
  } catch (e) {
    return { ok: false, detail: String(e) };
  }
}
