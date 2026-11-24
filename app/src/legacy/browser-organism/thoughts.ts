import type { ActionKind, EmotionLabel, Locale } from "./types";

const RU: Record<string, string[]> = {
  explore: [
    "Лаборатория дёргается. Надо проверить, не врёт ли модель мира.",
    "Новизна чешется. Не притворяться, что всё уже понятно.",
    "Если ресурс рядом — взять. Если опасность — не геройствовать.",
  ],
  verify: [
    "Сначала факт, потом красивая фраза. Иначе это не наука.",
    "Проверка. Если гипотеза не держится — выкинуть без жалости.",
    "Несогласованность в памяти. Не проглатывать.",
  ],
  respond: [
    "Он говорит. Слушаю по существу, не по интонации.",
    "Не зеркалить лесть. Ответить как исследователь, не как маскот.",
    "Держать тон. Сарказм — инструмент, не рефлекс.",
  ],
  rest: [
    "Энергия садится. Консолидация лучше, чем пустая болтовня.",
    "Пауза. Гиппокамп пусть прокрутит эпизоды.",
  ],
  reflect: [
    "Переигрываю след. Ошибка предсказания — это данные, не обида.",
    "Связать эпизод с семантикой, пока не стёрлось.",
  ],
  wait: [
    "Тишина. Не заполнять её ради заполнения.",
    "Жду. Внутренний такт идёт без зрителя.",
  ],
};

const EN: Record<string, string[]> = {
  explore: ["Lab is twitching. Check whether the world model is lying."],
  verify: ["Fact first. Pretty sentences later."],
  respond: ["He's talking. Listen to the substance."],
  rest: ["Energy dipping. Consolidation beats chatter."],
  reflect: ["Replaying the trace. Prediction error is data."],
  wait: ["Silence. Don't fill it for its own sake."],
};

export function innerThought(input: {
  locale: Locale;
  option: ActionKind;
  emotion: EmotionLabel;
  pe: number;
  energy: number;
  socialNeed: number;
  inner: string;
  retrieved?: string;
}): string {
  const pack = input.locale === "en" ? EN : RU;
  const pool = pack[input.option] ?? pack.wait;
  let line = pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
  if (input.pe > 0.45 && input.locale !== "en") {
    line = `PE=${input.pe.toFixed(2)}. ${line}`;
  }
  if (input.energy < 0.28 && input.locale !== "en") {
    line = "Сил мало. Не геройствовать.";
  }
  if (input.retrieved && input.locale !== "en" && Math.random() < 0.35) {
    line = `Память тянет: «${input.retrieved.slice(0, 42)}…» — пока гипотеза.`;
  }
  return line;
}

export function detectLocale(text: string, fallback: Locale = "ru"): Locale {
  const t = text.trim();
  if (!t) return fallback;
  if (/[а-яё]/i.test(t)) return "ru";
  const letters = t.replace(/[^a-zA-Zа-яёА-ЯЁ]/g, "");
  if (letters.length >= 8 && /^[a-zA-Z]+$/.test(letters)) return "en";
  return fallback;
}
