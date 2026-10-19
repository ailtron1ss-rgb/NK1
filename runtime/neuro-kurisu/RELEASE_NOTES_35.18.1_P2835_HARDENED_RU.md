# Neuro/Kurisu 35.18.1 — P2835 Hardening

Дата: 2026-09-20

## Назначение
Patch-release поверх P2835, фиксирующий реальные интеграционные дефекты, обнаруженные во время cross-layer regression и persistence validation.

## Исправления

1. P2820 stale-teacher detector теперь использует предыдущий tick до обновления state.tick. Ранее проверка фактически не могла обнаруживать большие временные разрывы.
2. NeuralExperienceBranch сохраняет актуальные snapshots P2820/P2835/P2774/P2805 после завершения outcome-path, чтобы restart получал последнее состояние обучения.
3. Legacy experimental toggle теперь не оставляет P2774 model-time replay включённым скрыто: experimental=false действительно отключает весь новый experimental replay path.
4. P2835 replay provenance использует contextId из ExperienceToken, поэтому transfer-safety gate получает фактический контекст происхождения replay sample.
5. P2820 persistence test проверяет реальный snapshot.tick и фактические teacher/coreset/transfer counters после restore; тест больше не может пройти из-за сравнения undefined.
6. P2835 release static gate отделён от тяжёлого исторического 28-run P2820 matrix; быстрый current-release synergy является каноническим release smoke, а тяжёлая matrix остаётся отдельным experimental evidence.

## Новые проверки

- P2835 hotpath smoke — PASS
- P2835 current-release synergy — PASS, 4 run, ABA + ABBA
- P2835 persistence — PASS, 48 outcomes, restart PASS
- legacy regression suites — проходят в отдельных чистых процессах; длинный объединённый chain не используется как единственная доказательная процедура из-за resource pressure.

## Ограничения

Полный 28-run P2820 historical synergy matrix после интеграции P2835 не является каноническим release gate: полный стек значительно дороже прежней конфигурации и в длинной последовательности упирается в runtime/resource ceiling. Это фиксируется как operational debt, а не как PASS.

## Interaction factorial

`P2835_INTERACTION_FACTORIAL=PASS`, 16 runs: 2 regimes × 4 variants × 2 seeds. В обоих режимах краткосрочный reward остался равным control (`ABA=0.8733`, `ABBA=0.8750`), но full-вариант реально изменил neural mass (`Δmass=0.0072` / `0.0303`). Это показывает, что текущий teacher/transfer слой пока меняет внутреннее обучение сильнее, чем короткий вручную заданный reward policy; дополнительный reward gain не засчитывается.
