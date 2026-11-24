import { resonanceField } from '../neural/ResonanceField';
import { emotionAffect } from '../psyche/EmotionAffectSystem';
/**
 * BrainOrchestrator v7 — plan + turn + monitor snapshot.
 */

import { EmotionalState, MemoryItem, AvatarExpression } from '../types';
import { classifyIntent, IntentResult } from './intentRouter';
import { buildContextPacket, critiqueAndFix } from '../services/contextPacket';
import { replyMemory } from './replyMemory';
import { memoryEngine } from '../services/memoryEngine';
import { personalityRewardSystem } from '../cognitive/PersonalityRewardSystem';
import { presenceAndIdle } from '../cognitive/PresenceAndIdle';
import { consciousnessCore } from '../cognitive/ConsciousnessCore';
import { isLocalNeuralEnabled } from './modelManager';
import { getActiveCloudProvider, isForceOffline } from '../services/providerConfig';
import { energyBudget } from './energyBudget';
import { runSleepCycle, SleepReport } from './sleepCycle';
import { cognitiveKernel } from '../cognitive/CognitiveKernel';
import { predictiveLoop } from '../cognitive/PredictiveLoop';
import { consciousLoop, Candidate } from '../cognitive/ConsciousLoop';
import { selfModel } from '../cognitive/SelfModel';
import { cognitiveOrganism } from '../cognitive/CognitiveOrganism';
import { livingPersona } from '../psyche/LivingPersona';
import { coreEnhancementHub } from '../cognitive/CoreEnhancementHub';
import { hybridBrain } from '../cognitive/HybridBrain';
import { continuumMemory } from '../cognitive/ContinuumMemory';
import { miruState } from '../cognitive/MiRUState';
import { alasLearning } from '../cognitive/ALASLearning';

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
  organism?: ReturnType<typeof cognitiveOrganism.snapshot>;
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
    cognitiveKernel.tick();
    livingPersona.observeUser(input.message, { deep: input.message.length > 220 });
    coreEnhancementHub.reviewDaily();
    const retrievedCount = input.ltm.length;
    const contradiction = /но раньше|ты говорил|это противоречит|не так/i.test(input.message);
    cognitiveKernel.observeUser(input.message, {
      memoryMatches: retrievedCount,
      contradiction,
      emotionalIntensity: Math.max(input.emotions.irritation, input.emotions.curiosity, input.emotions.affection)
    });
    const intent = classifyIntent(input.message);
    miruState.update(input.message, Math.max(input.emotions.happiness, input.emotions.curiosity) / 100, input.message.length > 180 ? 0.8 : 0.45);
    coreEnhancementHub.observeInput(input.message, { intent: intent.kind, emotionalEnergy: Math.max(input.emotions.happiness, input.emotions.curiosity, input.emotions.irritation), uncertainty: cognitiveKernel.getSnapshot().factors.uncertainty });
    const userEnergy = Math.min(100, Math.max(input.emotions.irritation, input.emotions.curiosity, input.emotions.happiness));
    const mirroredEnergy = coreEnhancementHub.emotionalContagion(userEnergy, input.emotions.happiness);
    const organismTurn = cognitiveOrganism.begin(input.message, input.emotions, retrievedCount);
    predictiveLoop.predict(
      input.message,
      intent.kind === 'greeting' ? 'user expects a social response' : `user likely wants a ${intent.kind} response`,
      intent.backend === 'template' ? 70 : 58
    );
    const packet = buildContextPacket(input.message, input.emotions, input.stm, input.ltm);
    let systemPrompt = packet.fullSystemPrompt;
    systemPrompt += `\n[STYLE] ${intent.styleHint} | intent=${intent.kind}`;
    const candidates: Candidate[] = [
      {
        id: 'user-current', source: 'user', label: input.message.slice(0, 160),
        salience: 72, urgency: intent.kind === 'boundary' ? 100 : 45,
        novelty: 58, goalRelevance: 55, uncertainty: 45,
        socialRelevance: 65, createdAt: Date.now()
      },
      {
        id: 'curiosity', source: 'curiosity', label: 'исследовать неизвестное',
        salience: cognitiveKernel.getSnapshot().factors.curiosity,
        urgency: 20, novelty: cognitiveKernel.getSnapshot().factors.novelty,
        goalRelevance: 35, uncertainty: cognitiveKernel.getSnapshot().factors.uncertainty,
        socialRelevance: 20, createdAt: Date.now()
      }
    ];
    const consciousFrame = consciousLoop.beginCycle({
      candidates,
      prediction: intent.kind === 'greeting' ? 'user wants social contact' : `user likely wants ${intent.kind}`,
      confidence: 58,
      predictionError: cognitiveKernel.getSnapshot().factors.predictionError
    });
    selfModel.observe('capability', 'Я могу сохранять структурированное состояние между запусками.', 90, 'system');
    systemPrompt += `\n${cognitiveKernel.buildPromptBlock()}`;
    systemPrompt += `\n${predictiveLoop.buildPromptHint()}`;
    systemPrompt += `\n${consciousLoop.buildPromptHint()}`;
    systemPrompt += `\n${selfModel.promptHint()}`;
    systemPrompt += `\n[FRAME] integration=${Math.round(consciousFrame.integration)}; выбранный источник=${consciousFrame.winner?.source || 'none'}`;
    systemPrompt += `\n${cognitiveOrganism.promptBlock()}`;
    systemPrompt += `\n[ORGANISM TURN] attention=${Math.round(organismTurn.attentionScore)} winner=${organismTurn.winner || 'none'} goal=${organismTurn.goal || 'none'} hypotheses=${organismTurn.hypothesisCount}`;
    systemPrompt += `\n[EMOTIONAL CONTAGION] mirroredEnergy=${mirroredEnergy}; match the user's energy gently, without parroting or escalating conflict.`;
    systemPrompt += `\n[HUMAN TEXTURE] Rarely use a natural self-correction or brief pause only when context supports it. Never add random typos just to seem human.`;
    systemPrompt += `\n${continuumMemory.promptHint()}`;
    systemPrompt += `\n${miruState.promptHint()}`;
    systemPrompt += `\n${alasLearning.promptHint()}`;
    systemPrompt += `\n[RESPONSE LENGTH] Do not enforce artificial sentence/character limits. Match the task: concise when simple, detailed when complexity warrants it.`;

    const offline = isForceOffline() || (typeof navigator !== 'undefined' && !navigator.onLine);
    const hasCloud = !!getActiveCloudProvider();
    const hasNeural = isLocalNeuralEnabled();

    let route: BrainTurnPlan['route'] = 'template';
    let reason = 'fallback templates';

    if (offline) {
      route = hasNeural ? 'neural' : 'template';
      reason = hasNeural ? 'offline + neural' : 'offline, neural off';
    } else if (hasCloud) {
      // Cloud is the high-quality path. Intent still influences provider/model
      // selection, but never forces a canned/template answer.
      route = 'cloud';
      reason = `cloud preferred for ${intent.kind}`;
    } else if (hasNeural) {
      route = 'neural';
      reason = 'no cloud key → local neural';
    } else {
      route = 'template';
      reason = 'no neural/cloud backend → emergency fallback';
    }

    const complexity = Math.min(100, 25 + input.message.length / 8 + retrievedCount * 5 + (intent.kind === 'science' || intent.kind === 'command' ? 25 : 0));
    const budget = energyBudget.get();
    const energyMode = budget.autonomousUsed >= Math.max(4, budget.maxAutonomousPerHour - 2) ? 'eco' : budget.autonomousUsed <= 1 ? 'full' : 'balanced';
    const hybrid = hybridBrain.choose({ offline, localReady: hasNeural, cloudReady: hasCloud, complexity, energy: energyMode });
    systemPrompt += `\n[HYBRID BRAIN] preferred=${hybrid.backend} confidence=${Math.round(hybrid.confidence * 100)} reasons=${hybrid.reasons.join(',')}`;

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
      lastLatencyMs: this.lastLatencyMs,
      organism: cognitiveOrganism.snapshot()
    };
  }

  afterReply(user: string, reply: string) {
    presenceAndIdle.noteUserActivity();
    const organismResult = cognitiveOrganism.end(reply);
    const prediction = organismResult.prediction;
    if (prediction) cognitiveKernel.recordPredictionSummary(prediction.prediction, prediction.confidence, prediction.error);
    livingPersona.observeReply(reply);
    try { alasLearning.capture(user, reply, reply.length > 120 ? 0.74 : 0.62); } catch { /* best effort */ }
    try { continuumMemory.push(`User: ${user.slice(0, 220)} | Kurisu: ${reply.slice(0, 260)}`, 'episodic', reply.length > 500 ? 0.78 : 0.55); } catch { /* best effort */ }
    cognitiveKernel.registerResponse({
      text: reply,
      latencyMs: this.lastLatencyMs,
      confidence: reply.length >= 40 ? 72 : 58,
      selfCorrection: /исправ|уточн|провер|не уверен|не уверена/i.test(reply)
    });
    const kinds = personalityRewardSystem.evaluateExchange(user, reply);
    kinds.forEach(k => personalityRewardSystem.apply(k));
    try {
      consciousnessCore.recordEvent({
        type: 'kurisu_reply',
        summary: reply.slice(0, 120),
        emotionalWeight: 0.3,
        importance: 0.3
      });
      if (user.trim().length > 140 || reply.length > 500) {
        memoryEngine.addStructuredMemory({
          category: 'episodic',
          fact: `Обмен: ${user.slice(0, 260)} → ${reply.slice(0, 320)}`,
          emotion: 5,
          meaning: 'Содержательный эпизод разговора; сохраняется для продолжения темы.',
          actions: ['учесть контекст в будущих ответах'],
          confidence: 0.62,
          topicName: 'содержательный разговор'
        });
      }
    } catch { /* */ }
  }

  finalizeText(user: string, draft: string, emotions: EmotionalState) {
    let text = critiqueAndFix(user, draft);
    try {
      if (replyMemory.isNearDuplicate(text)) {
        // nudge: still return cleaned text, but memory tracks it
        text = critiqueAndFix(user, text + ' ');
      }
      replyMemory.push(text);
    } catch { /* */ }
    let expression = pickExpression(text, emotions);
    try {
      const rh = resonanceField.expressionHint() as any;
      if (rh) expression = rh;
      else {
        const hint = emotionAffect.toExpressionHint() as any;
        if (hint) expression = hint;
      }
    } catch {
      try {
        const hint = emotionAffect.toExpressionHint() as any;
        if (hint) expression = hint;
      } catch { /* */ }
    }
    return { text, expression };
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
    const report = runSleepCycle();
    cognitiveKernel.tick();
    return report;
  }

  getCognitiveKernelSnapshot() {
    return cognitiveKernel.getSnapshot();
  }

  getCognitiveMetaSummary() {
    return cognitiveKernel.buildMetaSummary();
  }
}

export const brain = new BrainOrchestrator();
