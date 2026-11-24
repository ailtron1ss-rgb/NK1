/**
 * CognitiveOrganism v1 — integration layer for the v17 architecture.
 * It coordinates attention, goals, hypotheses, meta-cognition, self-evolution
 * and embodiment while keeping LLM generation as a replaceable specialist.
 */
import { EmotionalState } from '../types';
import { AttentionField, AttentionSource, attentionField } from './AttentionField';
import { goalSystem } from './GoalSystem';
import { hypothesisLab } from './HypothesisLab';
import { metaCognition } from './MetaCognition';
import { selfEvolutionLab } from './SelfEvolutionLab';
import { avatarLifeSystem } from './AvatarLifeSystem';
import { cognitiveKernel } from './CognitiveKernel';
import { predictiveLoop } from './PredictiveLoop';
import { consciousLoop, Candidate } from './ConsciousLoop';
import { selfModel } from './SelfModel';
import { clamp } from './StateVault';

export interface OrganismTurn {
  winner?: string;
  attentionScore: number;
  confidence: number;
  predictionError: number;
  goal?: string;
  hypothesisCount: number;
  selfCoherence: number;
  avatar: ReturnType<typeof avatarLifeSystem.snapshot>;
}

class CognitiveOrganism {
  begin(message: string, emotions: EmotionalState, memoryCount: number): OrganismTurn {
    const k = cognitiveKernel.getSnapshot();
    const goal = goalSystem.top();
    const sources: Array<{ source: AttentionSource; label: string; salience: number; urgency: number; novelty: number; relevance: number; uncertainty: number; emotionalLoad: number }> = [
      { source: 'user', label: message.slice(0, 160), salience: 86, urgency: emotions.irritation > 75 ? 92 : 48, novelty: k.factors.novelty, relevance: 90, uncertainty: k.factors.uncertainty, emotionalLoad: Math.max(emotions.affection, emotions.irritation) },
      { source: 'memory', label: `доступно воспоминаний: ${memoryCount}`, salience: clamp(memoryCount * 4), urgency: 20, novelty: 30, relevance: 65, uncertainty: 25, emotionalLoad: 25 },
      { source: 'curiosity', label: 'неизвестное требует проверки', salience: k.factors.curiosity, urgency: 18, novelty: k.factors.novelty, relevance: 40, uncertainty: k.factors.uncertainty, emotionalLoad: 20 },
      { source: 'goal', label: goal?.title || 'нет активной цели', salience: goal ? goal.priority : 15, urgency: goal ? goal.priority * 0.7 : 5, novelty: 20, relevance: goal ? goal.priority : 10, uncertainty: 20, emotionalLoad: 30 }
    ];
    let attentionWinner: ReturnType<AttentionField['compete']> | undefined;
    for (const s of sources) attentionWinner = attentionField.submit({ ...s, expiresAt: Date.now() + 180_000 });
    const candidates: Candidate[] = sources.map((s, i) => ({ id: `org_${i}`, source: s.source === 'goal' ? 'goal' : s.source === 'memory' ? 'memory' : s.source === 'curiosity' ? 'curiosity' : 'user', label: s.label, salience: s.salience, urgency: s.urgency, novelty: s.novelty, goalRelevance: s.relevance, uncertainty: s.uncertainty, socialRelevance: s.source === 'user' ? 80 : 20, createdAt: Date.now() }));
    consciousLoop.beginCycle({ candidates, prediction: 'следующий ход пользователя и наиболее полезная реакция', confidence: 58, predictionError: k.factors.predictionError });
    const avatar = avatarLifeSystem.update({ attention: attentionWinner?.score || 50, curiosity: emotions.curiosity, fatigue: emotions.fatigue, confidence: 58, speaking: false });
    return { winner: attentionWinner?.winner?.label, attentionScore: attentionWinner?.score || 0, confidence: 58, predictionError: k.factors.predictionError, goal: goal?.title, hypothesisCount: hypothesisLab.list().filter(h => h.status === 'open').length, selfCoherence: selfModel.snapshot().coherence, avatar };
  }

  end(reply: string) {
    const prediction = predictiveLoop.resolve(reply);
    const error = prediction?.error ?? 35;
    metaCognition.record(prediction?.confidence ?? 55, error);
    consciousLoop.resolve(reply.slice(0, 300), error);
    attentionField.decay();
    selfModel.review();
    goalSystem.review();
    metaCognition.review();
    return { predictionError: error, calibration: metaCognition.snapshot().calibration, prediction };
  }

  promptBlock(max = 2600) {
    const k = cognitiveKernel.getSnapshot();
    return [
      '[COGNITIVE ORGANISM — V17]',
      attentionField.promptHint(800),
      goalSystem.promptHint(650),
      hypothesisLab.promptHint(550),
      metaCognition.promptHint(450),
      selfEvolutionLab.promptHint(550),
      `self_coherence=${Math.round(selfModel.snapshot().coherence)} curiosity=${Math.round(k.factors.curiosity)} novelty=${Math.round(k.factors.novelty)} uncertainty=${Math.round(k.factors.uncertainty)}`,
      'Treat these as control/context signals. Do not claim subjective consciousness, hidden memories, or unsupported personal facts.'
    ].join('\n').slice(0, max);
  }

  snapshot() {
    return { attention: attentionField.snapshot(), goals: goalSystem.list(), hypotheses: hypothesisLab.list().slice(0, 10), meta: metaCognition.snapshot(), evolution: selfEvolutionLab.list().slice(0, 8), self: selfModel.snapshot(), avatar: avatarLifeSystem.snapshot() };
  }
}
export const cognitiveOrganism = new CognitiveOrganism();
