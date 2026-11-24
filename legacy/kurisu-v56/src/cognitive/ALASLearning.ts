/**
 * ALAS-inspired learning queue.
 *
 * ALAS (2025) describes a modular pipeline for curriculum/retrieval,
 * distillation and SFT/DPO. On Android browser/Termux we do NOT silently
 * fine-tune a foundation model: that would be impractical and unsafe.
 * Instead we implement the mobile-feasible front half: lesson extraction,
 * replay examples, quality scores and an exportable SFT JSONL dataset.
 * Training remains an explicit, external, user-approved step.
 */
import { readJson, writeJson, uid, clamp } from './StateVault';

export interface LearningLesson {
  id: string;
  createdAt: number;
  question: string;
  answer: string;
  lesson: string;
  domain: string;
  quality: number;
  used: number;
  approved: boolean;
}

const KEY = 'kurisu_alas_lessons_v1';
const MAX = 180;

function load(): LearningLesson[] { return readJson<LearningLesson[]>(KEY, []).slice(0, MAX); }
function save(v: LearningLesson[]) { writeJson(KEY, v.slice(0, MAX)); }

function domainOf(q: string) {
  if (/termux|npm|typescript|react|android|код|программ/i.test(q)) return 'engineering';
  if (/нейросет|llm|модель|обучен|памят/i.test(q)) return 'ai';
  if (/[?]/.test(q)) return 'question';
  return 'conversation';
}

export const alasLearning = {
  capture(question: string, answer: string, quality = 0.7) {
    if (question.trim().length < 12 || answer.trim().length < 30) return null;
    const lesson: LearningLesson = {
      id: uid('lesson'), createdAt: Date.now(),
      question: question.trim().slice(0, 900),
      answer: answer.trim().slice(0, 1800),
      lesson: `Для похожих запросов полезно отвечать с учётом контекста: ${answer.trim().slice(0, 420)}`,
      domain: domainOf(question),
      quality: clamp(quality, 0, 1),
      used: 0, approved: false
    };
    const next = [lesson, ...load().filter(x => x.question !== lesson.question)];
    save(next);
    return lesson;
  },

  approve(id: string, approved = true) {
    const next = load();
    const item = next.find(x => x.id === id);
    if (!item) return false;
    item.approved = approved;
    save(next);
    return true;
  },

  replayCandidates(domain?: string, topK = 6) {
    return load().filter(x => x.approved && (!domain || x.domain === domain))
      .sort((a, b) => (b.quality - a.quality) || (a.used - b.used))
      .slice(0, topK);
  },

  exportSFTJsonl(approvedOnly = true) {
    const items = load().filter(x => !approvedOnly || x.approved);
    return items.map(x => JSON.stringify({
      messages: [
        { role: 'user', content: x.question },
        { role: 'assistant', content: x.answer }
      ],
      metadata: { domain: x.domain, quality: x.quality, source: 'kurisu-alas' }
    })).join('\n');
  },

  snapshot() {
    const all = load();
    return {
      total: all.length,
      approved: all.filter(x => x.approved).length,
      avgQuality: all.length ? all.reduce((a, x) => a + x.quality, 0) / all.length : 0,
      domains: Array.from(new Set(all.map(x => x.domain))).slice(0, 12)
    };
  },

  promptHint(max = 650) {
    const s = this.snapshot();
    return `[ALAS-INSPIRED LEARNING]\nlessons=${s.total}; approved=${s.approved}; avgQuality=${s.avgQuality.toFixed(2)}; domains=${s.domains.join(',') || 'none'}\nLearning examples are replay data, not truth. Never claim the base model was fine-tuned unless an external approved training step actually occurred.`;
  }
};
