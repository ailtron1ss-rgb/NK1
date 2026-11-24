/**
 * UnifiedConsciousness — single workspace binding emotion, feeling, memory,
 * personality, stones, dialogue plan, drives, debt into one coherent "self" tick.
 *
 * Design: Global Workspace Theory lite for mobile — one snapshot, many readers.
 */

import { globalState } from '../synergy/GlobalState';
import { emotionAffect } from '../psyche/EmotionAffectSystem';
import { personalityCore } from '../psyche/PersonalityCore';
import { livingPersona } from '../psyche/LivingPersona';
import { kurisuStones } from '../brain/kurisuStones';
import { worldlineContract } from '../brain/worldlineContract';
import { planDialogue, DialoguePlan } from '../brain/dialogueReasoner';
import { thoughtDebt } from './thoughtDebt';
import { autonomyDrives } from './AutonomyDrives';
import { sessionEpisode } from '../brain/sessionEpisode';
import { replyMemory } from '../brain/replyMemory';
import { consciousnessCore } from './ConsciousnessCore';
import { relationshipModel } from './RelationshipModel';
import { embodimentBus } from '../services/embodimentBus';
import type { EmotionalState } from '../types';

export interface WorkspaceSnapshot {
  tick: number;
  at: number;
  dominantFeeling: string;
  affectLine: string;
  personalityLine: string;
  relationLine: string;
  memoryHints: string[];
  dialogue: DialoguePlan;
  goalsLine: string;
  stonesCount: number;
  debtLine: string;
  promptBlock: string;
}

const FEEL_KEY = 'kurisu_unified_feel_v1';

interface FeelingState {
  /** lingering mood 0..1 */
  warmth: number;
  tension: number;
  curiosity: number;
  fatigue: number;
  lastUserValence: number;
}

function loadFeel(): FeelingState {
  try {
    return {
      warmth: 0.4,
      tension: 0.25,
      curiosity: 0.55,
      fatigue: 0.2,
      lastUserValence: 0,
      ...JSON.parse(localStorage.getItem(FEEL_KEY) || '{}')
    };
  } catch {
    return { warmth: 0.4, tension: 0.25, curiosity: 0.55, fatigue: 0.2, lastUserValence: 0 };
  }
}

function saveFeel(f: FeelingState) {
  localStorage.setItem(FEEL_KEY, JSON.stringify(f));
}

function estimateValence(text: string): number {
  const t = text.toLowerCase();
  let v = 0;
  if (/спасибо|рад|любл|хорош|класс|мил/.test(t)) v += 0.35;
  if (/груст|плох|устал|один|зло|ненавиж|бесит/.test(t)) v -= 0.4;
  if (/\?/.test(t)) v += 0.05;
  return Math.max(-1, Math.min(1, v));
}

function dominantFromFeel(f: FeelingState, emotions: EmotionalState): string {
  const scores: Record<string, number> = {
    warmth: f.warmth + (emotions.affection || 0) / 200,
    tension: f.tension + (emotions.irritation || 0) / 150,
    curiosity: f.curiosity + (emotions.curiosity || 0) / 150,
    fatigue: f.fatigue,
    focus: (emotions.trust || 0) / 200
  };
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'focus';
}

class UnifiedConsciousness {
  private lastWorkspace: WorkspaceSnapshot | null = null;

  /** Perception → update feelings/drives/relation → build workspace */
  processInput(userMessage: string, emotions: EmotionalState, stm: string[] = []): WorkspaceSnapshot {
    const tick = globalState.bumpTick();
    const feel = loadFeel();
    const valence = estimateValence(userMessage);
    feel.lastUserValence = valence;

    // feeling dynamics
    feel.warmth = clamp01(feel.warmth + valence * 0.08 - 0.01);
    feel.tension = clamp01(feel.tension + (valence < -0.2 ? 0.1 : -0.03) + (emotions.irritation || 0) / 500);
    feel.curiosity = clamp01(feel.curiosity + (/\?|почему|как/.test(userMessage) ? 0.06 : -0.01));
    feel.fatigue = clamp01(feel.fatigue + 0.005);
    saveFeel(feel);

    try {
      emotionAffect.onUserMessage(userMessage);
      emotionAffect.tick();
    } catch { /* */ }

    try {
      autonomyDrives.onDialogue?.(userMessage, userMessage.length);
    } catch {
      /* */
    }

    try {
      const rm = relationshipModel as any;
      if (valence > 0.2) rm.applyInteraction?.('support');
      else if (valence < -0.25) rm.applyInteraction?.('insult');
      else if (/\?|почему|как|нейро|теори/i.test(userMessage)) rm.applyInteraction?.('science');
      else if (userMessage.length > 80) rm.applyInteraction?.('deep_talk');
      else rm.applyInteraction?.('honest');
    } catch { /* */ }

    const dialogue = planDialogue(userMessage, stm);
    const dominant = dominantFromFeel(feel, emotions);

    let affectLine = '';
    try {
      affectLine = emotionAffect.toPromptBlock?.() || '';
    } catch {
      affectLine = `[FEEL] warmth=${feel.warmth.toFixed(2)} tension=${feel.tension.toFixed(2)} curiosity=${feel.curiosity.toFixed(2)} dominant=${dominant}`;
    }

    let personalityLine = '';
    try {
      personalityLine = personalityCore.toPromptBlock?.() || livingPersona.toPromptBlock?.(userMessage) || '';
    } catch {
      personalityLine = livingPersona.toPromptBlock?.(userMessage) || '';
    }

    let relationLine = '';
    try {
      relationLine = relationshipModel.summaryForPrompt?.() || '';
    } catch {
      relationLine = '';
    }

    let goalsLine = '';
    try {
      goalsLine = consciousnessCore.buildCognitiveContextBlock?.() || '';
    } catch {
      goalsLine = '';
    }

    const memoryHints: string[] = [];
    try {
      memoryHints.push(...sessionEpisode.recent(2).map(e => e.summary.slice(0, 100)));
    } catch {
      /* */
    }

    const debtLine = thoughtDebt.toPromptBlock();
    const stonesCount = kurisuStones.list().length;

    const promptBlock = [
      '[UNIFIED CONSCIOUSNESS — единый субъект]',
      `tick=${tick} dominant=${dominant} stones=${stonesCount}`,
      `feel: warmth=${feel.warmth.toFixed(2)} tension=${feel.tension.toFixed(2)} curiosity=${feel.curiosity.toFixed(2)} fatigue=${feel.fatigue.toFixed(2)} valence_in=${valence.toFixed(2)}`,
      affectLine.slice(0, 400),
      personalityLine.slice(0, 350),
      relationLine ? `[RELATION] ${relationLine}` : '',
      `intent=${dialogue.intent} stance=${dialogue.stanceHint}`,
      dialogue.mustAddress.length
        ? 'must:\n' + dialogue.mustAddress.map(m => `- ${m}`).join('\n')
        : '',
      debtLine ? debtLine.slice(0, 220) : '',
      memoryHints.length ? `episodic: ${memoryHints[0]?.slice(0, 120)}` : '',
      'Сшейте эмоции, память, характер и must в ОДИН ответ Курису. Не перечисляйте модули. Длина по задаче.'
    ]
      .filter(Boolean)
      .join('\n\n');

    const snap: WorkspaceSnapshot = {
      tick,
      at: Date.now(),
      dominantFeeling: dominant,
      affectLine,
      personalityLine,
      relationLine,
      memoryHints,
      dialogue,
      goalsLine,
      stonesCount,
      debtLine,
      promptBlock
    };
    this.lastWorkspace = snap;
    try {
      (window as any).__kurisuWorkspace = snap;
      embodimentBus.emit({ emotion: dominant });
    } catch {
      /* */
    }
    globalState.pushAction(`perceive:${userMessage.slice(0, 60)}`);
    return snap;
  }

  afterReply(userMessage: string, reply: string) {
    const feel = loadFeel();
    feel.fatigue = clamp01(feel.fatigue + reply.length / 5000);
    if (reply.length > 120) feel.curiosity = clamp01(feel.curiosity - 0.03);
    saveFeel(feel);
    try {
      thoughtDebt.observeExchange(userMessage, reply);
    } catch {
      /* */
    }
    try {
      sessionEpisode.push('user', userMessage);
      sessionEpisode.push('kurisu', reply);
    } catch {
      /* */
    }
    try {
      replyMemory.push(reply);
    } catch {
      /* */
    }
    globalState.pushAction(`reply:${reply.slice(0, 60)}`);
  }

  getLast() {
    return this.lastWorkspace;
  }

  /** Compact HUD line */
  hudLine(): string {
    const f = loadFeel();
    const d = this.lastWorkspace?.dominantFeeling || '—';
    return `feel:${d} w${f.warmth.toFixed(1)} t${f.tension.toFixed(1)} c${f.curiosity.toFixed(1)}`;
  }
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export const unifiedConsciousness = new UnifiedConsciousness();
