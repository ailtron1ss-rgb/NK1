/**
 * MiCRo-style lightweight experts (no heavy NN — mobile-safe).
 * Experts: language, logic, social, knowledge.
 */

export type ExpertId = 'language' | 'logic' | 'social' | 'knowledge';

export interface ExpertVote {
  id: ExpertId;
  weight: number;
  hint: string;
}

function scoreText(text: string) {
  const t = text.toLowerCase();
  return {
    logic: /(почему|как работает|докажи|логик|если|значит|вывод)/.test(t) ? 0.9 : 0.2,
    knowledge: /(факт|знаешь|что такое|история|наука|теория)/.test(t) ? 0.85 : 0.25,
    social: /(как дела|чувствую|груст|рад|спасибо|прости|друг)/.test(t) ? 0.9 : 0.3,
    language: 0.4
  };
}

export function activateExperts(userMessage: string): ExpertVote[] {
  const s = scoreText(userMessage);
  const votes: ExpertVote[] = [
    {
      id: 'logic',
      weight: s.logic,
      hint: 'Структура ответа: посылки → вывод, без воды.'
    },
    {
      id: 'knowledge',
      weight: s.knowledge,
      hint: 'Опирайся на известные факты/науку; если не уверена — скажи.'
    },
    {
      id: 'social',
      weight: s.social,
      hint: 'Тон живой, эмпатия без сюсюканья, характер Курису.'
    },
    {
      id: 'language',
      weight: s.language + Math.max(s.logic, s.social, s.knowledge) * 0.2,
      hint: 'Естественная русская речь; длина ответа определяется задачей, *действие* только если уместно.'
    }
  ];
  votes.sort((a, b) => b.weight - a.weight);
  return votes;
}

export function expertsPromptBlock(votes: ExpertVote[]): string {
  const top = votes.slice(0, 3);
  return (
    '[MiCRo EXPERTS]\n' +
    top.map(v => `• ${v.id} (${v.weight.toFixed(2)}): ${v.hint}`).join('\n')
  );
}
