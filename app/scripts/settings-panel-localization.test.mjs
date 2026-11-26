import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settingsPath = new URL("../src/components/SettingsPanel.tsx", import.meta.url);

test("Settings voice and avatar controls use Russian labels and descriptions", async () => {
  const settings = await readFile(settingsPath, "utf8");
  const connection = await readFile(new URL("../src/components/ConnectionStatus.tsx", import.meta.url), "utf8");

  for (const phrase of [
    ">Голос<",
    "Синтез речи браузером",
    "Озвучивать новые ответы",
    "Голосовой профиль",
    "Автоматически по языку",
    "Микрофон runtime / ASR:",
    "Аватар и отображение",
    "Общие настройки главного экрана и панели аватара",
    "Подключение runtime",
    "2.5D · не включён",
  ]) {
    assert.ok(settings.includes(phrase), `missing localized settings copy: ${phrase}`);
  }

  for (const stale of [
    "Browser speech output",
    "Speak new replies",
    "Voice profile",
    "Automatic language match",
    "Avatar and display",
    "Runtime connection",
    "2.5D · Not enabled",
  ]) {
    assert.ok(!settings.includes(stale), `stale English settings text remains: ${stale}`);
  }

  assert.match(settings, /id="voice-replies-label"/);
  assert.match(settings, /aria-labelledby="voice-replies-label"/,
    "the speech switch must expose the visible control label to assistive technology");
  assert.match(settings, /aria-describedby="voice-replies-description"/,
    "the speech switch must expose its safety/behavior description");
  assert.match(settings, /id="voice-replies-description"/);
  for (const phrase of ["Подключение", "Подключено", "Показан последний подтверждённый снимок.", "Повторить"]) {
    assert.ok(connection.includes(phrase), `missing localized connection copy: ${phrase}`);
  }
  for (const stale of ["Connecting", "Connected", "Degraded", "Offline", "Language fallback", "Retry", "Refresh canonical runtime connection"]) {
    assert.ok(!connection.includes(stale), `stale English connection status remains: ${stale}`);
  }
  assert.match(connection, /aria-label="Повторить подключение к каноническому runtime"/);
});
