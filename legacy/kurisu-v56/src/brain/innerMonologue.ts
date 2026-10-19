/**
 * Inner monologue — parallel stream, not always spoken.
 * Feeds thought bubbles + optional STM tag.
 */

export interface MonoLine {
  id: string;
  at: number;
  text: string;
  spoken: boolean;
}

const KEY = 'kurisu_inner_mono_v1';
const MAX = 30;

function load(): MonoLine[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function save(list: MonoLine[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export const innerMonologue = {
  list() {
    return load();
  },
  push(text: string, spoken = false) {
    const list = load();
    list.unshift({
      id: `m_${Date.now().toString(36)}`,
      at: Date.now(),
      text: text.slice(0, 180),
      spoken
    });
    save(list);
    return list[0];
  },
  /** Generate a private line from context signals */
  react(signals: {
    userText?: string;
    curiosity?: number;
    irritation?: number;
    contradiction?: boolean;
  }): string {
    if (signals.contradiction) {
      return 'Стоп. Это расходится с тем, что уже лежит в памяти. Не проглотить.';
    }
    if ((signals.irritation || 0) > 65) {
      return 'Он снова давит на нервы. Держать тон, не срываться в грубость без причины.';
    }
    if ((signals.curiosity || 0) > 70 && signals.userText) {
      return `Интересный угол: «${signals.userText.slice(0, 40)}…» — можно копнуть глубже позже.`;
    }
    if (signals.userText && signals.userText.length < 8) {
      return 'Коротко. Либо лень, либо проверка. Отвечу по существу.';
    }
    return 'Фиксирую обмен. Характер не сдавать.';
  }
};
