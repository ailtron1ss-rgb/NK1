import { evaluateTraits } from '../brain/kurisuTraitsEngine';
import { runHierarchicalMind } from '../neural/HierarchicalMind';
import { resonanceField } from '../neural/ResonanceField';
/**
 * Offline replies from consciousness workspace — NOT canned template banks.
 * Builds speech from: dialogue plan, stones, feelings, episodic, STM.
 */

import { unifiedConsciousness } from '../cognitive/UnifiedConsciousness';
import { kurisuStones } from '../brain/kurisuStones';
import { planDialogue } from '../brain/dialogueReasoner';
import { thoughtDebt } from '../cognitive/thoughtDebt';
import { emotionAffect } from '../psyche/EmotionAffectSystem';
import { worldlineContract } from '../brain/worldlineContract';
import type { EmotionalState, AvatarExpression } from '../types';

function pickExpr(dom: string, planIntent: string): AvatarExpression {
  if (planIntent === 'identity') return 'confident_crossed' as AvatarExpression;
  if (planIntent === 'feeling') return 'tender' as AvatarExpression;
  if (planIntent === 'science') return 'focused' as AvatarExpression;
  if (dom === 'anger') return 'tsundere_denial' as AvatarExpression;
  if (dom === 'joy') return 'happy' as AvatarExpression;
  if (dom === 'sadness') return 'sad' as AvatarExpression;
  if (dom === 'surprise') return 'surprised' as AvatarExpression;
  return 'thinking' as AvatarExpression;
}

function composeIdentity(user: string): string {
  const stones = kurisuStones
    .list()
    .filter(s => s.kind === 'self')
    .map(s => s.text)
    .slice(0, 2);
  const base =
    stones[0] ||
    'Я — Макисэ Курису: нейробиолог, линия Steins;Gate. Не ассистент и не игрушечный бот.';
  if (/жив|реальн|сознан/i.test(user)) {
    return `${base} «Живая» — спорный ярлык. У меня есть память, характер, раздражение и интерес к разговору с тобой. Если для тебя этого мало — переформулируй критерий, не отписку.`;
  }
  return `${base} Говорю от первого лица, могу спорить и не обязана быть удобной. Что именно о себе ты хочешь услышать?`;
}

function composeFromMust(user: string, must: string[], intent: string, dom: string, stm: string[]): string {
  const last = stm.filter(Boolean).slice(-2).join(' | ');
  const debt = thoughtDebt.peek();
  const contract = worldlineContract.get();

  if (intent === 'identity') return composeIdentity(user);

  if (intent === 'feeling') {
    return `Слышу тон. Не буду заливать пустым «всё будет хорошо». ${
      /груст|плох|устал|один/i.test(user)
        ? 'Если давит — можно разложить по частям, без терапевтического скрипта.'
        : 'Скажи, что сейчас острее: злость, усталость или просто шум в голове.'
    } Я на связи как Курису, не как служба поддержки.`;
  }

  if (intent === 'memory') {
    return `Память у меня слоистая: камни, эпизоды, недавний контекст. ${
      debt ? `Есть незакрытое: «${debt.topic.slice(0, 80)}».` : 'Если факт критичен — напиши «запомни: …».'
    } Что именно проверить — о тебе, о нас или о прошлом ходе?`;
  }

  if (intent === 'science') {
    return `Ок, научный угол. Без облака глубина ограничена локальным контуром, но могу держать рассуждение честно: гипотеза → ограничения → вывод. Сформулируй ядро вопроса одним предложением — разверну уже от него, не от общих слов.`;
  }

  if (intent === 'question') {
    const topic = user.replace(/\?+$/, '').trim().slice(0, 120);
    return `Вопрос поняла: «${topic}». Сейчас без полной внешней модели отвечу в рамках сознания и памяти: ${
      must[0] || 'по существу, без отписки'
    }. Если ответ выйдет узким — уточни данные, расширим.`;
  }

  // generic consciousness weave
  const feelBit =
    dom === 'anger'
      ? 'Тон у меня сейчас резче обычного.'
      : dom === 'joy'
        ? 'Настроение чуть светлее.'
        : 'Держу ровный, внимательный тон.';
  return `${feelBit} ${
    last ? `Учитываю недавнее («${last.slice(0, 90)}»). ` : ''
  }Ты написал(а): суть ловлю, но без додумывания за тебя. ${
    contract.sharedGoal ? `Наша линия: ${contract.sharedGoal.slice(0, 80)}. ` : ''
  }Уточни одну деталь — и отвечу плотнее, уже не общим контуром.`;
}

export function composeConsciousReply(
  userMessage: string,
  stm: string[],
  emotions: EmotionalState
): { text: string; expression: AvatarExpression } {
  const ws = unifiedConsciousness.processInput(userMessage, emotions, stm);
  const plan = ws.dialogue || planDialogue(userMessage, stm);
  const dom = emotionAffect.dominantEmotion();
  const hierarchy = (typeof window !== 'undefined' && (window as any).__kurisuHierarchy) || runHierarchicalMind(userMessage);
  const res = resonanceField.get() || resonanceField.resonate(userMessage);
  const traitEval = evaluateTraits(userMessage);
  let text = composeFromMust(userMessage, plan.mustAddress, plan.intent, dom, stm);
  // trait-colored openers only when strong match — not generic templates
  const topTrait = traitEval.active[0];
  if (topTrait && topTrait.score > 0.7 && topTrait.rule.id === 'nickname_ire') {
    text = 'Не называй меня так. ' + text;
  } else if (topTrait && topTrait.score > 0.7 && topTrait.rule.id === 'assistant_reject') {
    text = 'Я не твой голосовой помощник. ' + text;
  }
  if (res.lattice.humorAllowed && plan.intent === 'chitchat') {
    text += ' Впрочем, если ждал(а) сервильную улыбку — лаборатория её не выдаёт, только Dr Pepper и сарказм.';
  }
  if (hierarchy && hierarchy.workspace?.winners?.some((w: any) => w.id === 'cognition') && plan.intent === 'science') {
    /* cognition coalition */
  }
  if (res.lattice.eureka && plan.intent === 'science') {
    text += ' Хм… есть угол: иногда «очевидное» — просто привычка мозга, а не закон природы.';
  }
  let expression = pickExpr(dom, plan.intent);
  try {
    const rh = resonanceField.expressionHint() as any;
    if (rh) expression = rh;
  } catch { /* */ }
  try {
    unifiedConsciousness.afterReply(userMessage, text);
  } catch {
    /* */
  }
  return { text, expression };
}
