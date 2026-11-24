# BIG PASS 323 — PROCESS KILL / RESUME REALITY

Дата: 2026-09-14
Версия: Neuro-Kurisu 35.6.1

## Цель

Проверить более сильный контракт, чем обычный restart: процесс организма должен быть принудительно завершён SIGKILL, после чего новый процесс должен загрузить durable state и продолжить жизненный контур без потери критического learning/closure состояния.

## Что внедрено

Добавлен `tests/big-pass-323-process-kill-resume.mjs` и npm-команды:

- `test:big-pass-323:kill-resume`
- `audit:b323:reality`

Тест создаёт первый Node-процесс, который выполняет durable saves и принудительно завершается `SIGKILL` на tick 3. Второй независимый Node-процесс загружает тот же файл и продолжает работу.

## Фактический результат

- process session 1 → killed by `SIGKILL`
- durable tick before kill: 3
- process session 2 → resumed
- final tick: 7
- learning: 7
- closures: 7
- pre-kill history retained: PASS
- post-resume history retained: PASS

## Regression

- Typecheck: PASS
- B318 durable process restart: PASS
- B320 mobile durability: PASS
- B321 device reality: PASS, `HOST_ONLY`

## Что доказано

1. Runtime действительно переживает границу процесса.
2. SIGKILL между checkpoint-ами не уничтожает уже сохранённое состояние.
3. Новый процесс получает durable memory и продолжает learning/closure.
4. Session identity позволяет различать жизнь до и после process death.

## Ограничение

Это host-level process lifecycle proof. Это не доказательство Android Doze/OEM kill, физического power-loss и не Android certification. Для этого требуется B321 `REAL_DEVICE_VERIFIED` evidence на реальном Termux/Android устройстве.

## Следующий фронт

B324 должен добавить device-aware watchdog/recovery protocol: heartbeat, stale-run detection, automatic resume marker, bounded checkpoint-loss accounting и отдельный Android/Termux mode, не выдавая host proof за physical-device evidence.
