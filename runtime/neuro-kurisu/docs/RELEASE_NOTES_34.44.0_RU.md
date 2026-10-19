# Neuro-Kurisu 34.44.0 — BIG PASS 73: Mobile Long-Horizon + Projection Efficiency

## Сделано

1. Добавлен `performanceProfile: quality|balanced|mobile`.
2. Mobile-профиль увеличивает окно между deep persistence projections с 4 до 12 циклов, не отключая cognition и сохраняя forced/full flush.
3. Глубокие P24–P55 projections в operational mode теперь не запускаются только из-за body telemetry; семантический внешний опыт и bounded periodic refresh сохраняются.
4. Сокращены повторные snapshots P41 semantic perception, P42 experience, social trust и outcome cognition внутри одного цикла.
5. Cognitive network больше не клонирует 64-entry history на каждом hot broadcast; persistence coordinator остаётся canonical projection owner.
6. Сохранена предыдущая оптимизация WorldModel: deep transition history больше не клонируется в каждом `project()`.
7. Добавлен `tests/mobile-horizon-1000.mjs` как реальный длинный mobile operational gate.
8. Добавлен `docs/ARCHITECTURE_P30_P82_FUSION_MAP_RU.md` для дальнейшего слияния capability layers без P-number explosion.

## Измеренный результат

На текущем validation host mobile 1000-cycle operational run:

- PASS
- warmed median ratio ≈ 1.21
- first median ≈ 30.24 ms
- last median ≈ 36.53 ms
- p95 ≈ 50.94 ms
- canonical memory count = 143

Это программный benchmark, не physical Android qualification.

## Важно

Полная квалификация непосредственно на Poco/Termux:API по-прежнему требует запуска на самом устройстве.
