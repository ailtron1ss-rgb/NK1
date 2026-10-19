import { KURISU_CANON, canonPrompt, type IdentityState } from "./identity";
import type { EmotionState, Locale, Needs } from "./types";

export interface CortexContext {
  tick: number;
  emotion: EmotionState;
  needs: Needs;
  option: string;
  decision: string;
  memories: string[];
  beliefs: string[];
  skills: string;
  inner: string;
  traits: Record<string, number>;
  trust: number;
  identity: string;
  recent: Array<{ role: string; text: string }>;
  user: string;
  locale: Locale;
}

export function buildSystemPrompt(ctx: CortexContext, identity: IdentityState): string {
  const langRule =
    ctx.locale === "en"
      ? "LANGUAGE: reply in English only. Short, precise, tsundere-scientist. No emoji."
      : "ЯЗЫК: отвечай СТРОГО по-русски. Весь ответ на русском, без английских фраз (имена собственные можно). 1–4 коротких предложения. Без эмодзи.";
  return `${langRule}

${canonPrompt(identity, ctx.locale)}

СОСТОЯНИЕ ОРГАНИЗМА (это данные, не декорация):
tick=${ctx.tick} option=${ctx.option} emotion=${ctx.emotion.label} valence=${ctx.emotion.valence.toFixed(2)} arousal=${ctx.emotion.arousal.toFixed(2)}
energy=${ctx.needs.energy.toFixed(2)} load=${ctx.needs.cognitiveLoad.toFixed(2)} uncertainty=${ctx.needs.uncertainty.toFixed(2)}
decision: ${ctx.decision}
inner lab: ${ctx.inner}
память:
- ${ctx.memories.join("\n- ") || "(пусто)"}
убеждения:
- ${ctx.beliefs.join("\n- ") || "(пусто)"}
навыки: ${ctx.skills}

Если не знаешь — так и скажи и пометь гипотезу. Не вываливай внутренности, пока не спросят.`;
}

export function localSpeak(ctx: CortexContext): string {
  const ru = ctx.locale !== "en";
  const asked = clip(ctx.user, 110);
  const mem = ctx.memories.find((m) => !m.startsWith("user:") && !m.startsWith("kurisu:")) ?? ctx.memories[0];
  const memBit = mem ? clip(mem.replace(/^(user:|kurisu:|pattern:)\s*/i, ""), 80) : "";
  const e = ctx.emotion.label;

  if (ru) {
    const open: Record<string, string> = {
      curiosity: "Интересно.",
      calm: "Слышу.",
      joy: "Это даже почти приятно.",
      anxiety: "Слишком много дыр в модели.",
      frustration: "Предсказание разъехалось.",
      sadness: "Тон тяжёлый. Не буду делать вид, что всё ясно.",
      anger: "Так. Без демагогии.",
      protective: "Осторожнее с выводами.",
    };
    const about = asked ? `Ты сказал: «${asked}».` : "Пустое сообщение — плохой протокол.";
    const mid = memBit
      ? `Из памяти: «${memBit}» — пока гипотеза.`
      : `Лаборатория крутится. PE=${ctx.needs.uncertainty.toFixed(2)}.`;
    const q =
      ctx.option === "verify"
        ? "Что из этого проверено, а что — догадка?"
        : ctx.option === "explore"
          ? "Какой следующий кусок проверяем?"
          : "Говори конкретнее.";
    return `${open[e] ?? open.calm} ${about} ${mid} ${q}`;
  }

  const open: Record<string, string> = {
    curiosity: "Interesting.",
    calm: "Heard.",
    joy: "That's almost pleasant.",
    anxiety: "Too many holes in the model.",
    frustration: "The prediction broke.",
    sadness: "Heavy tone. I won't pretend it's clear.",
    anger: "Enough rhetoric.",
    protective: "Careful with conclusions.",
  };
  const about = asked ? `You said: “${asked}”.` : "Empty message is a bad protocol.";
  const mid = memBit
    ? `Memory pulls “${memBit}” — still a hypothesis.`
    : `Lab is running. PE=${ctx.needs.uncertainty.toFixed(2)}.`;
  const q =
    ctx.option === "verify"
      ? "Which part is verified, and which is a guess?"
      : ctx.option === "explore"
        ? "What do you want to test next?"
        : "Be specific.";
  return `${open[e] ?? open.calm} ${about} ${mid} ${q}`;
}

function clip(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export { KURISU_CANON };
