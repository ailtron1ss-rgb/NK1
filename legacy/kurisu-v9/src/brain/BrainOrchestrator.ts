/**
 * BrainOrchestrator v7 — plan + turn + monitor snapshot.
 */

import { EmotionalState, MemoryItem, AvatarExpression } from '../types';
import { classifyIntent, IntentResult } from './intentRouter';
import { buildContextPacket, critiqueAndFix } from '../services/contextPacket';
import { memoryEngine } from '../services/memoryEngine';
import { personalityRewardSystem } from '../cognitive/PersonalityRewardSystem';
import { presenceAndIdle } from '../cognitive/PresenceAndIdle';
import { consciousnessCore } from '../cognitive/ConsciousnessCore';
import { isLocalNeuralEnabled } from './modelManager';
import { getActiveCloudProvider, isForceOffline } from '../services/providerConfig';
import { energyBudget } from './energyBudget';
import { runSleepCycle, SleepReport } from './sleepCycle';

export interface BrainTurnInput {
  message: string;
  emotions: EmotionalState;
  stm: string[];
  ltm: MemoryItem[];
}

export interface BrainTurnPlan {
  intent: IntentResult;
  systemPrompt: string;
  route: 'cloud' | 'neural' | 'template';
  reason: string;
  memoryIds: string[];
  memoryPreview: string[];
}

export interface MonitorSnapshot {
  at: number;
  intent: string;
  route: string;
  reason: string;
  backendHint: string;
  memoryTop: string[];
  budget: ReturnType<typeof energyBudget.get>;
  lastLatencyMs?: number;
}

export interface BrainTurnResult {
  text: string;
  expression: AvatarExpression;
  plan: BrainTurnPlan;
  trustDelta: number;
  affectionDelta: number;
  irritationDelta: number;
  curiosityDelta: number;
  newTopic: string | null;
}

function pickExpression(text: string, emotions: EmotionalState): AvatarExpression {
  const t = text.toLowerCase();
  if (/бака|идиот|хватит/i.test(t)) return 'tsundere_denial';
  if (/смущ|красне/i.test(t)) return 'embarrassed';
  if (/доктор пеппер|dr\.?\s*pepper/i.test(t)) return 'dr_pepper_break';
  if (/доска|схема|объясн/i.test(t)) return 'whiteboard_explain';
  if (/время|аттрактор/i.test(t)) return 'focused';
  if (/груст|тяжел/i.test(t) || emotions.irritation > 60) return 'sad';
  if (/рад|приятно/i.test(t)) return 'happy';
  if (emotions.curiosity > 70) return 'thinking';
  return 'neutral';
}

export class BrainOrchestrator {
  private lastPlan: BrainTurnPlan | null = null;
  private lastLatencyMs = 0;
  private lastBackend = '';

  plan(input: BrainTurnInput): BrainTurnPlan {
    const intent = classifyIntent(input.message);
    const packet = buildContextPacket(input.message, input.emotions, input.stm, input.ltm);
    let systemPrompt = packet.fullSystemPrompt;
    systemPrompt += `\n[STYLE] ${intent.styleHint} | intent=${intent.kind}`;

    const offline = isForceOffline() || (typeof navigator !== 'undefined' && !navigator.onLine);
    const hasCloud = !!getActiveCloudProvider();
    const hasNeural = isLocalNeuralEnabled();

    let route: BrainTurnPlan['route'] = 'template';
    let reason = 'fallback templates';

    if (offline) {
      route = hasNeural ? 'neural' : 'template';
      reason = hasNeural ? 'offline + neural' : 'offline, neural off';
    } else if (intent.backend === 'template') {
      route = 'template';
      reason = 'intent prefers template';
    } else if (hasCloud && (intent.backend === 'cloud_strong' || intent.backend === 'cloud_fast')) {
      route = 'cloud';
      reason = `intent ${intent.kind} → ${intent.backend}`;
    } else if (hasNeural) {
      route = 'neural';
      reason = hasCloud ? 'neural available' : 'no cloud key';
    } else if (hasCloud) {
      route = 'cloud';
      reason = 'cloud available';
    }

    const plan: BrainTurnPlan = {
      intent,
      systemPrompt,
      route,
      reason,
      memoryIds: packet.retrieved.map(m => m.id),
      memoryPreview: packet.retrieved.map(m => m.content.slice(0, 80))
    };
    this.lastPlan = plan;
    return plan;
  }

  /** Thin API for UI: plan only (generation stays in chatService for provider calls) */
  getLastPlan() {
    return this.lastPlan;
  }

  noteGenerationMeta(backend: string, latencyMs: number) {
    this.lastBackend = backend;
    this.lastLatencyMs = latencyMs;
  }

  getMonitorSnapshot(): MonitorSnapshot {
    const p = this.lastPlan;
    return {
      at: Date.now(),
      intent: p?.intent.kind || '—',
      route: p?.route || '—',
      reason: p?.reason || '—',
      backendHint: this.lastBackend || '—',
      memoryTop: p?.memoryPreview || [],
      budget: energyBudget.get(),
      lastLatencyMs: this.lastLatencyMs
    };
  }

  afterReply(user: string, reply: string) {
    presenceAndIdle.noteUserActivity();
    const kinds = personalityRewardSystem.evaluateExchange(user, reply);
    kinds.forEach(k => personalityRewardSystem.apply(k));
    try {
      consciousnessCore.recordEvent({
        type: 'kurisu_reply',
        summary: reply.slice(0, 120),
        emotionalWeight: 0.3,
        importance: 0.3
      });
    } catch { /* */ }
  }

  finalizeText(user: string, draft: string, emotions: EmotionalState) {
    const text = critiqueAndFix(user, draft);
    return { text, expression: pickExpression(text, emotions) };
  }

  consolidateMemory() {
    try {
      const r = memoryEngine.consolidateMemories();
      return { ok: true, detail: `Консолидация: ${r.consolidatedCount} записей, pathways: ${r.neuralPathwaysCreated}` };
    } catch (e) {
      return { ok: false, detail: String(e) };
    }
  }

  sleep(): SleepReport {
    return runSleepCycle();
  }
}

export const brain = new BrainOrchestrator();
