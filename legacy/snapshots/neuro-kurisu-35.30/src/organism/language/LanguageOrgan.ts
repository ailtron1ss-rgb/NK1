import { kurisuCanonPrompt } from './KurisuCanonProfile.ts';

import type { OrganismDecisionTrace, OrganismCycleResult, CognitiveProposal } from '../core/types.ts';

export interface LanguageRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LanguageResponse {
  text: string;
  backend: string;
  latencyMs: number;
}

export type LanguageInvoker = (request: LanguageRequest) => Promise<LanguageResponse>;

export function buildCognitivePrompt(cycle: OrganismCycleResult, worldFacts: string[] = []): LanguageRequest {
  const selected = cycle.decision.selected;
  const candidates = cycle.decision.candidates.slice(0, 5)
    .map(c => `${c.action} score=${c.score.toFixed(2)} confidence=${c.confidence.toFixed(2)}`).join('\n');
  const at = Date.now();
  const date = new Date(at);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const calendar = `${date.toISOString()} local=${date.toLocaleString()} timezone=${timezone}`;
  return {
    system: [
      kurisuCanonPrompt(),
      'You are the language organ of a persistent artificial organism.',
      'Do not invent internal state. Treat the supplied workspace and decision trace as authoritative.',
      'The organism may have autonomous goals. Language generation is downstream of the decision process, not the source of the decision.',
      `[TIME] now=${calendar}`,
      `current_goal=${cycle.goals.find(g => g.id === selected?.goalId)?.title ?? 'none'}`,
      `selected_action=${selected?.action ?? 'none'}`,
      `prediction_error=${cycle.state.predictionError.toFixed(3)}`,
      `self_prediction_error=${cycle.state.selfPredictionError.toFixed(3)}`,
      `energy=${cycle.state.needs.energy.toFixed(3)} load=${cycle.state.needs.cognitiveLoad.toFixed(3)} uncertainty=${cycle.state.needs.uncertainty.toFixed(3)}`,
      `[NETWORK] ${String((cycle.workspace.content as any).p7Network?.winner ?? 'none')} ignition=${Number((cycle.workspace.content as any).p7Network?.broadcastGain ?? 0).toFixed(3)} recurrent=${String((cycle.workspace.content as any).p7Network?.recurrentCycles ?? 0)}`,
      `[NEUROMOD] exploration=${Number((cycle.workspace.content as any).p7Neuromodulation?.explorationBias01 ?? 0.5).toFixed(3)} attentionGain=${Number((cycle.workspace.content as any).p7Neuromodulation?.attentionGain01 ?? 0.5).toFixed(3)}`,
      `[MEMORY] retrieved=${cycle.memories.slice(-4).map(m=>m.summary).join(' | ') || 'none'}`,
      `[ADVANCED] cognitiveField=${JSON.stringify((cycle as any).advanced?.cognitiveField ?? {})}`,
      `[WORLD_MODEL] worldModel=${JSON.stringify((cycle as any).advanced?.worldModel2 ?? {})}`,
      `[P9] regret=${JSON.stringify((cycle as any).advanced?.regret ?? {})}`,
    ].join('\n'),
    user: [
      '[CANDIDATE ACTIONS]', candidates || 'none',
      '[WORLD FACTS]', worldFacts.slice(-12).join('\n') || 'none',
      '[TASK]', 'Produce language appropriate to the already-selected action. Do not change the selected action.',
    ].join('\n'),
    maxTokens: 512,
    temperature: 0.7,
  };
}

export function postHocExplanation(trace: OrganismDecisionTrace): string {
  const s = trace.selected;
  if (!s) return 'No action was selected.';
  const ranked = [...trace.candidates].sort((a, b) => b.score - a.score).slice(0, 3).map(c => `${c.action}:${c.score.toFixed(2)}`).join(', ');
  return `Selected ${s.action}; alternatives=${ranked}; autonomousOverride=${trace.autonomousOverride}; userRequested=${trace.userRequestedAction ?? 'none'}.`;
}


export function buildCognitiveProposalPrompt(cycle: OrganismCycleResult, fusedObservation: string): LanguageRequest {
  const at = Date.now();
  const date = new Date(at);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return {
    system: [
      kurisuCanonPrompt(),
      `[TIME] now=${date.toISOString()} local=${date.toLocaleString()} timezone=${timezone}`,
      'You are a bounded reasoning organ inside a persistent artificial organism.',
      'Return a concise JSON object only. Your proposal is advisory: the organism core retains action authority.',
      'Do not claim to see or know evidence that is not supplied.',
      'Schema: {"summary":string,"hypotheses":string[],"uncertainty":number,"suggestedAction":string|null,"evidenceNeeded":string[]}',
      'suggestedAction must be one of respond,explore,verify,rest,reflect,wait,defer or null.',
      `selected_action=${cycle.decision.selected?.action ?? 'none'}`,
      `prediction_error=${cycle.state.predictionError.toFixed(3)}`,
      `world_context_version=${cycle.state.worldContextVersion}`,
    ].join('\n'),
    user: `[FUSED MULTIMODAL OBSERVATION]\n${fusedObservation.slice(0,5000)}\n[WORKSPACE]\n${JSON.stringify(cycle.workspace.content).slice(0,6000)}`,
    maxTokens: 380,
    temperature: 0.2,
  };
}

export function parseCognitiveProposal(text: string, source: CognitiveProposal['source']='llm'): CognitiveProposal {
  const now=Date.now();
  try {
    const raw = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
    const allowed=new Set(['respond','explore','verify','rest','reflect','wait','defer']);
    const suggestedAction=allowed.has(raw?.suggestedAction)?raw.suggestedAction:null;
    return { summary:String(raw?.summary??'').slice(0,500), hypotheses:Array.isArray(raw?.hypotheses)?raw.hypotheses.map((x:any)=>String(x).slice(0,300)).slice(0,6):[], uncertainty:Math.max(0,Math.min(1,Number(raw?.uncertainty??.6))), suggestedAction, evidenceNeeded:Array.isArray(raw?.evidenceNeeded)?raw.evidenceNeeded.map((x:any)=>String(x).slice(0,240)).slice(0,8):[], source, at:now };
  } catch { return {summary:text.trim().slice(0,500),hypotheses:[],uncertainty:.8,suggestedAction:null,evidenceNeeded:['structured-reasoning-output'],source,at:now}; }
}
