# BIG PASS 321 — DEVICE REALITY GATE

Дата: 2026-09-14
Версия: Neuro-Kurisu 35.6.1

## Цель

Перевести phone-readiness из архитектурного утверждения в измеряемый runtime-gate.

B321 НЕ считает Linux host Android и НЕ повышает physical-device readiness на основании эмуляции.

## Что добавлено

- `scripts/device-reality-gate.mjs`
- `tests/big-pass-321-device-reality.mjs`
- npm scripts:
  - `device:reality`
  - `test:big-pass-321:device`

## Собираемые данные

1. Node/platform
2. Android `getprop` (если доступен)
3. модель устройства
4. CPU ABI
5. RAM total/free
6. filesystem free space
7. средняя latency записи 256 KiB × 3
8. Termux API command availability
9. battery percentage/temperature/charging
10. Wi-Fi availability
11. sensors availability
12. capability map
13. evidence provenance через `DeviceEvidenceLedger`

## Правило сертификации

`HOST_PROBE` никогда не превращается в `REAL_DEVICE_VERIFIED`.

Физическая сертификация возможна только при live Android/Termux telemetry.

Минимальный production gate:

- Android/Termux runtime;
- доступ к Termux API;
- успешный live telemetry probe;
- свежие данные;
- command success rate >= 0.67 для базового probe набора;
- provenance записан в DeviceEvidenceLedger.

## Host verification этой сборки

Результат на текущей среде:

- verdict: `HOST_ONLY`
- platform: `linux`
- Android-like: `false`
- Termux: `false`
- RAM: 5948 MiB total / 4874 MiB free
- filesystem write probe: ~1.09 ms average
- certification: `host-probe`

Это корректный результат. Physical Android certification здесь НЕ выдана.

## Регрессия

- B321 device gate: PASS
- typecheck: PASS
- B318 durable process restart: PASS
- B320 mobile durability: PASS

B319 crash matrix остаётся отдельным доказанным gate; aggregate повтор всех дорогих тестов не используется как единственная истина.

## Запуск на реальном телефоне

В Termux из корня проекта:

```bash
npm run device:reality
npm run test:big-pass-321:device
```

Для обязательной физической сертификации:

```bash
NK_REQUIRE_REAL_DEVICE=1 npm run device:reality
```

Результат сохраняется в:

`state/device-reality-b321/report.json`

## Что B321 НЕ доказывает

- длительную стабильность 24+ часов;
- отсутствие Android Doze/OEM killing;
- реальную thermal throttling curve без длительного device-run;
- камеру/микрофон как семантические каналы;
- реальную производительность локальной LLM на данном телефоне.

Это отдельные следующие gates.
