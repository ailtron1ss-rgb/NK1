/**
 * Curiosity queue — topics Kurisu wants to explore (from 2-main CuriosityItem).
 */

export interface CuriosityItem {
  id: string;
  topic: string;
  question: string;
  interestScore: number;
  knowledgeGap: number;
  status: 'PENDING' | 'RESEARCHING' | 'RESOLVED';
  at: number;
}

const KEY = 'kurisu_curiosity_q_v1';

function load(): CuriosityItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function save(items: CuriosityItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 24)));
}

export const curiosityQueue = {
  list() {
    return load();
  },
  enqueue(topic: string, question: string, interest = 0.8) {
    const items = load().filter(i => i.topic !== topic);
    items.unshift({
      id: `cq_${Date.now().toString(36)}`,
      topic: topic.slice(0, 80),
      question: question.slice(0, 160),
      interestScore: interest,
      knowledgeGap: 0.5,
      status: 'PENDING',
      at: Date.now()
    });
    save(items);
  },
  /** Extract curiosity from user message */
  noteFromUser(msg: string) {
    if (/(расскажи|что такое|почему|как работает)/i.test(msg)) {
      this.enqueue(msg.slice(0, 40), `Уточнить: ${msg.slice(0, 100)}`, 0.75);
    }
  },
  topPending(): CuriosityItem | null {
    return load().find(i => i.status === 'PENDING') || null;
  },
  toPromptBlock(): string {
    const top = load().filter(i => i.status === 'PENDING').slice(0, 3);
    if (!top.length) return '';
    return (
      '[CURIOSITY QUEUE]\n' +
      top.map(t => `- ${t.topic}: ${t.question}`).join('\n')
    );
  }
};
