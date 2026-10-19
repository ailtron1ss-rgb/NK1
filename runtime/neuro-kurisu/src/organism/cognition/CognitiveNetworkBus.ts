import { randomUUID } from 'node:crypto';

export type SpecialistName = 'salience' | 'affect' | 'executive' | 'default' | 'sensorimotor' | 'memory' | 'social' | 'language';

export interface SpecialistSignal {
  specialist: SpecialistName;
  score: number;
  confidence: number;
  target: string;
  evidence: string[];
  energyCost: number;
}

export interface NetworkBroadcast {
  id: string;
  tick: number;
  winner: SpecialistName;
  selected: SpecialistSignal[];
  inhibited: SpecialistName[];
  broadcastGain: number;
  recurrentCycles: number;
  weights: Record<SpecialistName, number>;
  rationale: string[];
}

export interface CognitiveNetworkState {
  tick: number;
  capacity: number;
  lastBroadcast: NetworkBroadcast | null;
  history: NetworkBroadcast[];
  totalIgnitions: number;
}

const clamp = (v:number,min=0,max=1) => Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;
const names: SpecialistName[] = ['salience','affect','executive','default','sensorimotor','memory','social','language'];
const validNames = new Set<string>(names);
const defaultWeights:Record<SpecialistName,number> = { salience:1, affect:0.92, executive:1, default:0.9, sensorimotor:1, memory:0.95, social:0.8, language:0.75 };
const asRecord=(value:unknown):Record<string,unknown> => value && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
const finiteInt=(value:unknown,fallback=0)=>Number.isFinite(Number(value))?Math.floor(Number(value)):fallback;
function normalizeSignal(value:unknown):SpecialistSignal|null {
  const raw=asRecord(value);
  const specialist=String(raw.specialist??'');
  if(!validNames.has(specialist)) return null;
  const evidence=Array.isArray(raw.evidence)?raw.evidence.filter((item):item is string=>typeof item==='string').slice(0,12).map(item=>item.slice(0,240)):[];
  return { specialist:specialist as SpecialistName, score:clamp(Number(raw.score)), confidence:clamp(raw.confidence == null ? 0.5 : Number(raw.confidence)), target:typeof raw.target==='string'?raw.target.trim().slice(0,180):'', evidence, energyCost:clamp(Number(raw.energyCost)) };
}
function signalUtility(signal:SpecialistSignal):number {
  // Confidence should influence attention without becoming a hard veto; energy is a modest homeostatic cost.
  return clamp(signal.score) * (0.70 + 0.30 * clamp(signal.confidence)) * (1 - 0.15 * clamp(signal.energyCost));
}

/** Convert a globally selected affect signal into a small, bounded action prior.
 * Continuous appraisal remains the baseline; the workspace term only applies when
 * affect actually wins a broadcast slot, so emotion is neither decorative nor an
 * unconditional override of P69/canonical action arbitration.
 */
export function affectWorkspaceActionBias(
  broadcast: Pick<NetworkBroadcast, 'selected'|'broadcastGain'> | null | undefined,
  tendency: string,
  action: string,
): number {
  if (!broadcast) return 0;
  const signal = broadcast.selected.find(item => item.specialist === 'affect');
  if (!signal) return 0;
  const actionByTendency: Record<string, readonly string[]> = {
    explore: ['explore'], engage: ['respond'], verify: ['verify'], reflect: ['reflect'],
    rest: ['rest'], protect: ['rest','verify'], withdraw: ['wait','defer','rest'], approach: ['respond','explore'],
  };
  if (!(actionByTendency[tendency] ?? []).includes(action)) return 0;
  return Math.min(0.035, clamp(signal.score) * (0.012 + clamp(broadcast.broadcastGain) * 0.025));
}
function normalizeWeights(value:unknown):Record<SpecialistName,number> {
  const raw=asRecord(value);
  return Object.fromEntries(names.map(name=>[name,clamp(Number(raw[name]??defaultWeights[name]))])) as Record<SpecialistName,number>;
}
function normalizeBroadcast(value:unknown):NetworkBroadcast|null {
  if(!value || typeof value!=='object' || Array.isArray(value)) return null;
  const raw=asRecord(value);
  const selectedRaw=Array.isArray(raw.selected)?raw.selected:[];
  // Old persisted snapshots may contain duplicate specialists. Restore the same
  // invariant as a live broadcast and retain the highest-utility legacy signal.
  const selectedBySpecialist=new Map<SpecialistName,SpecialistSignal>();
  for(const item of selectedRaw) {
    const signal=normalizeSignal(item);
    if(!signal) continue;
    const prior=selectedBySpecialist.get(signal.specialist);
    if(!prior || signalUtility(signal)>signalUtility(prior)) selectedBySpecialist.set(signal.specialist,signal);
  }
  const selected=[...selectedBySpecialist.values()].slice(0,5);
  const persistedWinner=String(raw.winner);
  const winner=validNames.has(persistedWinner)&&selected.some(signal=>signal.specialist===persistedWinner)?persistedWinner as SpecialistName:(selected[0]?.specialist??'default');
  const inhibited=Array.isArray(raw.inhibited)?[...new Set(raw.inhibited.map(String).filter(name=>validNames.has(name)))].slice(0,names.length) as SpecialistName[]:names.filter(name=>!selected.some(signal=>signal.specialist===name));
  const rationale=Array.isArray(raw.rationale)?raw.rationale.filter((item):item is string=>typeof item==='string').slice(0,16).map(item=>item.slice(0,240)):[];
  return { id:typeof raw.id==='string'?raw.id.slice(0,120):'restored-broadcast', tick:Math.max(0,finiteInt(raw.tick)), winner, selected, inhibited, broadcastGain:clamp(Number(raw.broadcastGain)), recurrentCycles:Math.max(1,Math.min(4,Math.floor(Number(raw.recurrentCycles)||1))), weights:normalizeWeights(raw.weights), rationale };
}

export class CognitiveNetworkBus {
  private state: CognitiveNetworkState = { tick:0, capacity:3, lastBroadcast:null, history:[], totalIgnitions:0 };
  private weights: Record<SpecialistName, number> = { ...defaultWeights };

  restore(state: CognitiveNetworkState | undefined): void {
    if (!state) return;
    const raw=state as CognitiveNetworkState & Record<string,unknown>;
    const lastBroadcast=normalizeBroadcast(raw.lastBroadcast);
    const history=Array.isArray(raw.history)?raw.history.map(normalizeBroadcast).filter((entry):entry is NetworkBroadcast=>entry!==null).slice(0,64):[];
    this.state = { tick:Math.max(0,finiteInt(raw.tick)), capacity:Math.max(1,Math.min(5,finiteInt(raw.capacity,3))), lastBroadcast, history, totalIgnitions:Math.max(0,finiteInt(raw.totalIgnitions)) };
    this.weights = normalizeWeights(lastBroadcast?.weights);
  }

  stimulate(signals: SpecialistSignal[], tick:number, attentionBudget:number): NetworkBroadcast {
    this.state.tick = Math.max(0,Math.floor(Number.isFinite(tick)?tick:0));
    // A specialist contributes at most once to a broadcast. Invalid/unknown
    // plugin signals are rejected and all numeric fields are bounded before
    // they reach ranking, persisted weights or diagnostics.
    const unique=new Map<SpecialistName,SpecialistSignal>();
    for(const raw of Array.isArray(signals)?signals:[]) {
      const signal=normalizeSignal(raw);
      if(!signal) continue;
      const prior=unique.get(signal.specialist);
      if(!prior || signalUtility(signal)>signalUtility(prior)) unique.set(signal.specialist,signal);
    }
    const attention=clamp(attentionBudget);
    const ranked = [...unique.values()].map(s => ({ ...s, score: signalUtility(s) * (0.55 + 0.45 * clamp(this.weights[s.specialist])) * (0.65 + 0.35 * attention) }))
      .sort((a,b)=>b.score-a.score);
    const selected = ranked.slice(0, this.state.capacity);
    const winner = selected[0]?.specialist ?? 'default';
    const selectedNames = new Set(selected.map(s=>s.specialist));
    const inhibited = names.filter(n=>!selectedNames.has(n));
    const winnerScore = selected[0]?.score ?? 0;
    const runnerScore = selected[1]?.score ?? 0;
    const ignition = clamp((winnerScore - runnerScore + 0.35) * (0.65 + 0.35 * attention));
    const recurrentCycles = Math.max(1, Math.min(4, Math.round(1 + ignition * 3)));
    const broadcast: NetworkBroadcast = {
      id: randomUUID(), tick:this.state.tick, winner, selected, inhibited, broadcastGain: ignition,
      recurrentCycles, weights:{...this.weights},
      rationale:[`winner=${winner}`,`capacity=${this.state.capacity}`,`ranking=score×confidence×energy`, `ignition=${ignition.toFixed(3)}`,`recurrent=${recurrentCycles}`],
    };
    this.state.lastBroadcast = broadcast;
    this.state.history = [broadcast, ...this.state.history].slice(0,64);
    if (ignition >= 0.45) this.state.totalIgnitions += 1;
    for (const item of selected) {
      this.weights[item.specialist] = clamp(this.weights[item.specialist] + (item.specialist===winner ? 0.012 : -0.003));
    }
    return structuredClone(broadcast);
  }

  broadcast(): NetworkBroadcast | null { return this.state.lastBroadcast ? structuredClone(this.state.lastBroadcast) : null; }
  updateCapacity(capacity:number): void { this.state.capacity = Math.max(1, Math.min(5, Math.round(capacity))); }
  snapshot(): CognitiveNetworkState { return structuredClone(this.state); }
}
