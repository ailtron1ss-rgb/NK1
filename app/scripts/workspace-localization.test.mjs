import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Chat keeps send, sleep/wake, export and microphone feedback in Russian", async () => {
  const chat = await read("../src/components/ChatPanel.tsx");
  const labels = await read("../src/organism/uiLabels.ts");
  for (const phrase of [
    "Цикл общения",
    "Ожидаем наблюдение",
    "Уложить спать",
    "Разбудить",
    "Экспортировать историю чата",
    "Очистить историю чата",
    "Очистить только историю чата в этом браузере? Каноническая память не изменится.",
    "ожидаем подтверждение канонического runtime…",
    "Runtime отключён. Черновик сообщения сохранится, если отправка не удастся.",
    "Напишите Курису…",
    "Сообщение для Курису",
    "Начать ввод с микрофона",
    "Остановить запись с микрофона",
    "Отправить",
    "Shift+Enter — новая строка",
    "Расшифровка добавлена в черновик. Проверьте её перед отправкой.",
  ]) {
    assert.ok(chat.includes(phrase), `missing localized chat copy: ${phrase}`);
  }
  assert.match(chat, /UI_CONNECTION_STATUS_LABELS/);
  assert.match(chat, /UI_EMOTION_LABELS/);
  assert.match(chat, /UI_ACTION_LABELS/);
  assert.match(labels, /connecting: "Подключение"/);
});

test("Mind HUD translates canonical snapshot, needs, identity and policy labels", async () => {
  const hud = await read("../src/components/MindHud.tsx");
  const labels = await read("../src/organism/uiLabels.ts");
  for (const phrase of [
    "Снимок состояния",
    "Потребности",
    "Идентичность",
    "Рабочее пространство",
    "Политика выбора",
    "Ошибка предсказания",
    "Последний подтверждённый снимок",
  ]) {
    assert.ok(hud.includes(phrase), `missing localized HUD copy: ${phrase}`);
  }
  for (const phrase of ["Энергия", "Когнитивная нагрузка", "Неопределённость", "Социальная потребность", "Новизна", "Давление сна", "Согласованность идентичности", "Давление цели"]) {
    assert.ok(labels.includes(phrase), `missing shared Russian HUD label: ${phrase}`);
  }
  assert.match(hud, /UI_NEED_LABELS/);
  assert.match(hud, /UI_EMOTION_LABELS/);
  assert.match(hud, /UI_ACTION_LABELS/);
});

test("Labs tabs and empty states use readable Russian labels", async () => {
  const labs = await read("../src/components/Labs.tsx");
  for (const phrase of [
    "Разум",
    "Память",
    "Внутренняя лаборатория",
    "Навыки",
    "Свидетельства",
    "Цели",
    "Канонический семантический мир",
    "Единственный владелец",
    "Навыков пока нет. Разговаривайте и действуйте.",
    "использований",
  ]) {
    assert.ok(labs.includes(phrase), `missing localized Labs copy: ${phrase}`);
  }
});

test("Motivation explains goals and homeostatic drives in Russian", async () => {
  const motivation = await read("../src/components/MotivationPanel.tsx");
  const labels = await read("../src/organism/uiLabels.ts");
  for (const phrase of [
    "Текущие цели",
    "Цели берутся из подтверждённого снимка канонического runtime.",
    "Гомеостаз и потребности",
    "Только просмотр актуальных каналов потребностей.",
    "Сначала дождитесь подтверждения канонического снимка.",
    "Недоступно",
    "Неизвестно",
    "Энергия",
    "Когнитивная нагрузка",
    "Социальная потребность",
    "Давление сна",
    "Согласованность идентичности",
  ]) {
    assert.ok(motivation.includes(phrase), `missing localized motivation copy: ${phrase}`);
  }
  for (const phrase of ["Энергия", "Когнитивная нагрузка", "Социальная потребность", "Давление сна", "Согласованность идентичности"]) {
    assert.ok(labels.includes(phrase), `missing shared Russian motivation label: ${phrase}`);
  }
  assert.match(motivation, /UI_NEED_LABELS/);
  assert.match(motivation, /UI_CONNECTION_STATUS_LABELS/);
});

test("Runtime health translates controls and section labels while keeping raw diagnostics intact", async () => {
  const health = await read("../src/components/RuntimeHealthPanel.tsx");
  for (const phrase of [
    "Состояние runtime",
    "Здоровье и восстановление",
    "Операционные показатели, непрерывность сессии и неподтверждённые результаты внешних действий.",
    "Обновить",
    "Экспортировать",
    "Операционный статус загружен",
    "Ожидаем статус",
    "Обновлено",
    "Некоторые диагностические данные недоступны",
    "Организм · runtime",
    "Последнее действие",
    "Записи памяти",
    "Активная цель",
    "Телеметрия тела и устройства",
    "Непрерывность сессии",
    "Запись непрерывности",
    "Очередь восстановления действий",
    "Runtime не вернул записей для восстановления.",
    "Причина:",
    "Результат:",
  ]) {
    assert.ok(health.includes(phrase), `missing localized runtime health copy: ${phrase}`);
  }
});


test("Research Dock uses Russian approvals and preserves one-time consent before probes", async () => {
  const research = await read("../src/research/ResearchDock.tsx");
  for (const phrase of [
    "Исследовательский мост",
    "Панель предварительной проверки только для чтения.",
    "Запустить проверку FwPKM",
    "Просканировать канонический реестр",
    "Требуется однократное разрешение",
    "Она не начнётся без вашего разрешения именно на эту проверку.",
    "Разрешить один запуск",
    "Отказать",
    "Только исследования",
    "Управляемый режим",
    "Проверка отклонена. Исследовательский код не запускался.",
  ]) {
    assert.ok(research.includes(phrase), `missing localized Research Dock copy: ${phrase}`);
  }
  assert.match(research, /resolveToolPermission\(ticket\.id,true\)/,
    "explicit approval must remain required before running a probe");
  assert.match(research, /resolveToolPermission\(approvalRequest\.id,false\)/,
    "declining a probe must preserve the one-time permission gate");
});
