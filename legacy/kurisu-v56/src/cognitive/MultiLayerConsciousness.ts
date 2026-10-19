/**
 * MultiLayerConsciousness — multi-factor, multi-layer "core" for Kurisu.
 *
 * Layers (bottom → top):
 * 0 Sensorium   — channel, presence, novelty, threat
 * 1 Affect      — fast emotions + slow feelings
 * 2 Memory      — ranked retrieval pressure + pathway density
 * 3 Attention   — competition / workspace winner
 * 4 Motivation  — goals, desires, promises, daily plan
 * 5 Narrative   — self-story continuity
 * 6 Metacog     — confidence, prediction error, calibration
 * 7 Expression  — what leaks into speech / avatar
 *
 * Not phenomenal consciousness — a structured control stack that makes
 * behavior continuous, bounded, and inspectable.
 */

import { emotionAffect } from '../psyche/EmotionAffectSystem';
import { perceptionModel } from '../psyche/PerceptionModel';
import { neuralPathways } from '../psyche/NeuralPathwayGraph';
import { personalityCore } from '../psyche/PersonalityCore';
import { attentionEconomy } from '../brain/attentionEconomy';
import { narrativeLog } from '../brain/narrativeLog';
import { dailyPlan } from '../brain/dailyPlan';
import { cognitiveOrganism } from './CognitiveOrganism';
import { cognitiveKernel } from './CognitiveKernel';
import { metaCognition } from './MetaCognition';
import { selfModel } from './SelfModel';
import { EmotionalState } from '../types';

export interface LayerSnapshot {
  id: number;
  name: string;
  score: number; // 0..100 activity/pressure
  summary: string;
}

export interface ConsciousnessFrame {
  at: number;
  layers: LayerSnapshot[];
  globalWorkspace: string;
  coherence: number;
  readiness: 'silent' | 'short' | 'normal' | 'rich';
  funHooks: string[];
}

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n));
}

class MultiLayerConsciousness {
  private lastFrame: ConsciousnessFrame | null = null;

  /** Build a full multi-layer frame before generation */
  frame(message: string, emotions: EmotionalState, memoryCount: number): ConsciousnessFrame {
    const affect = emotionAffect.get();
    const perc = perceptionModel.get();
    const paths = neuralPathways.get();
    const attn = attentionEconomy.get();
    const org = cognitiveOrganism.begin(message, emotions, memoryCount);
    const k = cognitiveKernel.getSnapshot();
    const meta = metaCognition.snapshot();
    const self = selfModel.snapshot();
    const plan = dailyPlan.get();

    const layers: LayerSnapshot[] = [
      {
        id: 0,
        name: 'Sensorium',
        score: clamp(
          (perc.environment.userPresent ? 70 : 20) +
            perc.environment.novelty * 0.2 -
            perc.environment.threatLevel * 0.15
        ),
        summary: `ch=${perc.environment.channel} present=${perc.environment.userPresent} novelty=${perc.environment.novelty|0}`
      },
      {
        id: 1,
        name: 'Affect',
        score: clamp(
          Math.max(
            affect.emotions.joy,
            affect.emotions.anger,
            affect.emotions.anticipation,
            affect.feelings.attachment
          )
        ),
        summary: `dom=${emotionAffect.dominantEmotion()} attach=${affect.feelings.attachment|0} lonely=${affect.feelings.loneliness|0}`
      },
      {
        id: 2,
        name: 'Memory',
        score: clamp(memoryCount * 3 + paths.edges.length * 0.5),
        summary: `mem≈${memoryCount} edges=${paths.edges.length} top=${neuralPathways.topLinks(1)[0] || '—'}`
      },
      {
        id: 3,
        name: 'Attention',
        score: clamp(org.attentionScore),
        summary: `winner=${(org.winner || '—').slice(0, 40)} tokens=${attn.tokens}/${attn.maxTokens}`
      },
      {
        id: 4,
        name: 'Motivation',
        score: clamp((plan.items.filter(i => !i.done).length / 3) * 80 + (org.goal ? 20 : 0)),
        summary: `goal=${org.goal || '—'} plan_open=${plan.items.filter(i => !i.done).length}`
      },
      {
        id: 5,
        name: 'Narrative',
        score: clamp(narrativeLog.recent(5).length * 18 + 20),
        summary: (narrativeLog.recent(1)[0] || 'пусто').slice(0, 60)
      },
      {
        id: 6,
        name: 'Metacog',
        score: clamp(100 - (org.predictionError || 40) + (meta.calibration || 50) * 0.3),
        summary: `err=${Math.round(org.predictionError)} cal=${Math.round(meta.calibration || 50)} conf=${Math.round(org.confidence)}`
      },
      {
        id: 7,
        name: 'Expression',
        score: clamp(org.avatar?.motionEnergy ?? 50),
        summary: `coh=${Math.round(org.selfCoherence)} avatar=${JSON.stringify(org.avatar || {}).slice(0, 40)}`
      }
    ];

    const coherence = clamp(
      layers.reduce((s, l) => s + l.score, 0) / layers.length * 0.5 +
        (self.coherence || 50) * 0.5
    );

    let readiness: ConsciousnessFrame['readiness'] = 'normal';
    if (attn.tokens <= 3) readiness = 'silent';
    else if (attn.tokens < 12 || affect.feelings.fatigueFeel > 75) readiness = 'short';
    else if (coherence > 70 && k.factors.curiosity > 65) readiness = 'rich';

    const funHooks = this.computeFunHooks(message, affect, layers);

    const frame: ConsciousnessFrame = {
      at: Date.now(),
      layers,
      globalWorkspace: org.winner || layers[3].summary,
      coherence,
      readiness,
      funHooks
    };
    this.lastFrame = frame;
    return frame;
  }

  end(reply: string) {
    return cognitiveOrganism.end(reply);
  }

  getLast() {
    return this.lastFrame;
  }

  /** Quirky but useful micro-signals */
  private computeFunHooks(
    message: string,
    affect: ReturnType<typeof emotionAffect.get>,
    layers: LayerSnapshot[]
  ): string[] {
    const hooks: string[] = [];
    if (/доктор пеппер|dr\.?\s*pepper|кола|газиров/i.test(message)) {
      hooks.push('DR_PEPPER_SPIKE: поднять playful tone на один ответ');
    }
    if (/кристина|christina/i.test(message)) {
      hooks.push('NAME_BOUNDARY: мягко но твёрдо поправить имя');
    }
    if (affect.feelings.intellectualHunger > 75) {
      hooks.push('HUNGER: можно один уточняющий научный вопрос');
    }
    if (layers[0].score < 35) {
      hooks.push('LOW_SENSORIUM: мир «тихий» — не переигрывать эмоции');
    }
    // Lab coincidence: shared tokens with pathway hubs
    if (/время|мир|линия|аттрактор|серн/i.test(message)) {
      hooks.push('TIMELINE_ECHO: допустима одна лёгкая отсылка к Steins;Gate без спойлеров');
    }
    if (Math.random() < 0.08) {
      hooks.push('LAB_NOTE: можно *коротко* упомянуть, что записываешь мысль в журнал');
    }
    return hooks.slice(0, 4);
  }

  toPromptBlock(max = 2200): string {
    const f = this.lastFrame;
    if (!f) return '[MULTI-LAYER] (no frame yet)';
    const layerLines = f.layers
      .map(l => `L${l.id}:${l.name}=${Math.round(l.score)} {${l.summary}}`)
      .join('\n');
    const fun = f.funHooks.length ? f.funHooks.join(' | ') : 'none';
    return [
      '[MULTI-LAYER CONSCIOUSNESS STACK]',
      layerLines,
      `workspace=${f.globalWorkspace.slice(0, 80)}`,
      `coherence=${Math.round(f.coherence)} readiness=${f.readiness}`,
      `fun_hooks=${fun}`,
      personalityCore.toPromptBlock().slice(0, 500),
      'Не заявляй феноменальное сознание. Используй слои как управляющие сигналы.'
    ]
      .join('\n')
      .slice(0, max);
  }

  /** Compact HUD numbers for UI */
  hud() {
    const f = this.lastFrame;
    if (!f) {
      return {
        coherence: 50,
        readiness: 'normal' as const,
        layers: [] as { name: string; score: number }[],
        workspace: '—'
      };
    }
    return {
      coherence: f.coherence,
      readiness: f.readiness,
      layers: f.layers.map(l => ({ name: l.name, score: l.score })),
      workspace: f.globalWorkspace.slice(0, 48)
    };
  }
}

export const multiLayerConsciousness = new MultiLayerConsciousness();
