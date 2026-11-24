/**
 * Unified status strip for UI: emotions, thoughts, desires, goals, body, relation.
 * Pure data — React can render badges / bars / chips from this.
 */

export interface IndicatorItem {
  id: string;
  group: 'emotion' | 'cognition' | 'body' | 'relation' | 'system' | 'desire';
  label: string; // Russian short
  valueText: string;
  level?: number; // 0..100 optional bar
  tone: 'neutral' | 'warm' | 'cold' | 'alert' | 'positive' | 'muted';
}

export function buildStatusIndicators(input: {
  emotions: {
    trust: number;
    affection: number;
    irritation: number;
    curiosity: number;
    happiness: number;
    fatigue: number;
  };
  relationStage: string;
  expression: string;
  environment: string;
  energy: number;
  presenceMode: string;
  currentDesire?: string;
  currentThought?: string;
  activeGoal?: string;
  speaking?: boolean;
  offline?: boolean;
}): IndicatorItem[] {
  const e = input.emotions;
  const items: IndicatorItem[] = [
    {
      id: 'mood',
      group: 'emotion',
      label: 'Настроение',
      valueText: moodLabel(e),
      level: e.happiness,
      tone: e.irritation > 60 ? 'alert' : e.happiness > 60 ? 'positive' : 'neutral'
    },
    {
      id: 'curiosity',
      group: 'emotion',
      label: 'Любопытство',
      valueText: `${e.curiosity}`,
      level: e.curiosity,
      tone: e.curiosity > 70 ? 'warm' : 'neutral'
    },
    {
      id: 'trust',
      group: 'relation',
      label: 'Доверие',
      valueText: `${e.trust}`,
      level: e.trust,
      tone: e.trust > 65 ? 'positive' : 'neutral'
    },
    {
      id: 'stage',
      group: 'relation',
      label: 'Стадия',
      valueText: input.relationStage,
      tone: 'neutral'
    },
    {
      id: 'expr',
      group: 'body',
      label: 'Выражение',
      valueText: input.expression,
      tone: 'muted'
    },
    {
      id: 'env',
      group: 'body',
      label: 'Среда',
      valueText: input.environment,
      tone: 'muted'
    },
    {
      id: 'energy',
      group: 'body',
      label: 'Энергия',
      valueText: `${input.energy}`,
      level: input.energy,
      tone: input.energy < 30 ? 'alert' : 'neutral'
    },
    {
      id: 'presence',
      group: 'system',
      label: 'Присутствие',
      valueText: presenceLabel(input.presenceMode),
      tone: input.presenceMode.includes('idle') ? 'warm' : 'neutral'
    }
  ];

  if (input.currentThought) {
    items.unshift({
      id: 'thought',
      group: 'cognition',
      label: 'Мысль',
      valueText: truncate(input.currentThought, 64),
      tone: 'muted'
    });
  }
  if (input.currentDesire) {
    items.unshift({
      id: 'desire',
      group: 'desire',
      label: 'Желание',
      valueText: truncate(input.currentDesire, 64),
      tone: 'warm'
    });
  }
  if (input.activeGoal) {
    items.push({
      id: 'goal',
      group: 'cognition',
      label: 'Цель',
      valueText: truncate(input.activeGoal, 48),
      tone: 'neutral'
    });
  }
  if (input.speaking) {
    items.push({
      id: 'speak',
      group: 'system',
      label: 'Речь',
      valueText: 'говорит',
      tone: 'positive'
    });
  }
  if (input.offline) {
    items.push({
      id: 'net',
      group: 'system',
      label: 'Режим',
      valueText: 'оффлайн-ограниченный',
      tone: 'alert'
    });
  }

  return items;
}

function moodLabel(e: {
  irritation: number;
  fatigue: number;
  happiness: number;
  curiosity: number;
}) {
  if (e.irritation > 65) return 'раздражена';
  if (e.fatigue > 70) return 'устала';
  if (e.curiosity > 75) return 'увлечена';
  if (e.happiness > 70) return 'в хорошем настроении';
  if (e.happiness < 30) return 'приглушена';
  return 'спокойна';
}

function presenceLabel(mode: string) {
  switch (mode) {
    case 'in_chat_active':
      return 'ты активен';
    case 'in_chat_idle':
      return 'ты в чате, молчишь';
    case 'app_background':
      return 'приложение свёрнуто';
    case 'away':
      return 'тебя нет';
    default:
      return mode;
  }
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
