# Neuro-Kurisu Clean Rebuild 1.1 — ChangeLog

## Цель

Сделать clean-room runtime безопасным для первого Device Gate и уменьшить класс эксплуатационных ошибок, которые не относятся к cognitive architecture.

## Изменения

### Runtime safety
- ProcessLock: один daemon instance на один canonical state.
- OperationalJournal: bounded JSONL operational log с ротацией.
- LLM timeout: `LLM_TIMEOUT_MS`, default 15s.
- HTTP health/metrics endpoints вместо возврата полного cognitive snapshot по health route.
- Graceful SIGINT/SIGTERM с освобождением process lock.

### Termux
- supervisor с exponential backoff до 60 секунд;
- start script с явными HOST/PORT defaults;
- device preflight;
- Device Gate runbook и report template.

### Reproducibility
- package-lock.json обновлён до 1.1.0;
- dependency tree остаётся нулевым;
- runtime state не включается в release archive.

### Verification
- lock verify;
- smoke;
- autonomy;
- restart persistence;
- integrity;
- architecture;
- operational hardening;
- device preflight;
- HTTP health/metrics;
- second-process lock rejection.

## Ограничения

Физические Android thermal/battery/process-reclaim и 24–168h soak тесты требуют целевого телефона и Termux:API.
