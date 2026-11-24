# Следующие проходы после V94

## V95 — Continual Plasticity Qualification

Цель: проверить lifecycle/homeostasis на длинных потоках distribution shift, а не на коротком synthetic smoke.

Обязательные измерения: average accuracy/cosine, late-task plasticity, forgetting, recovery speed, rejuvenation count, active-unit fraction, wall time, peak memory.

Promotion rule: механизм включается в current только при устойчивом улучшении минимум на 5 seeds и без неприемлемого регресса latency/memory.

## V96 — Recurrent Backend Tournament

Сравнить current spine с GDN-2 / PGDN / PKDA / Raven / Mamba-style кандидатами через единый contract и matched parameter/compute budget.

## V97 — Engine Flattening

Убрать оставшиеся historical execution dependencies из current path, сохранив миграции checkpoint отдельно.

## V98 — Mobile/CPU Qualification

Batch=1, streaming step, long-run thermal/latency/memory profile, restart/checkpoint recovery.
