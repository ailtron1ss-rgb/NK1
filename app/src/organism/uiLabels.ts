import type { ActionKind, EmotionLabel, Needs } from "./types";
import type { UiConnectionStatus } from "./store";

export const UI_EMOTION_LABELS: Record<EmotionLabel, string> = {
  curiosity: "любопытство",
  calm: "спокойствие",
  joy: "радость",
  anxiety: "тревога",
  frustration: "раздражение",
  sadness: "грусть",
  anger: "гнев",
  protective: "защита",
};

export const UI_CONNECTION_STATUS_LABELS: Record<UiConnectionStatus, string> = {
  connecting: "Подключение",
  connected: "Подключено",
  degraded: "Ограниченный режим",
  disconnected: "Нет соединения",
};

export const UI_NEED_LABELS: Record<keyof Needs, string> = {
  energy: "Энергия",
  cognitiveLoad: "Когнитивная нагрузка",
  uncertainty: "Неопределённость",
  socialNeed: "Социальная потребность",
  novelty: "Новизна",
  identityCoherence: "Согласованность идентичности",
  goalPressure: "Давление цели",
  sleepPressure: "Давление сна",
};

export const UI_ACTION_LABELS: Record<ActionKind, string> = {
  respond: "Ответ",
  explore: "Исследование",
  verify: "Проверка",
  rest: "Отдых",
  reflect: "Размышление",
  wait: "Ожидание",
};
