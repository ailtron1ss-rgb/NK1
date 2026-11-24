# Forensic Audit — B2504–B2508 Unified Neural Stack

## Исполнение

Проверено: новые исходники, wiring через OrganismCore, persistent state, runtime enable/disable, outcome learning, lesion paths, release metadata и regression tests.

## Что подтверждено кодом

1. B2504 реально получает latent/goal state и выполняет action-conditioned multi-step projections.
2. B2505 реально принимает replay prototypes B2502 и материализует их в собственные primitives перед композиционным inference.
3. B2506 реально регулирует neural authority во времени и имеет outcome correction.
4. B2507 реально рассчитывает consolidation budget; replay вызывается только при рассчитанном budget > 0.
5. B2508 реально меняет horizon и может отключать heavy neural path при resource guard.
6. Все пять state snapshots входят в OrganismSystemState и сохраняются через обычный checkpoint path.
7. OrganismCore использует B2504/B2505 biases в action candidate utility, а B2506 масштабирует neural influence.

## Критические отрицательные результаты

- B2504 пока не показал статистически убедимого снижения prediction error на простом 90-step synthetic sequence: calibration/self-consistency улучшились, но last-step reward error не уменьшился. Следующий проход должен улучшать objective, а не просто увеличивать модель.
- B2502+B2503 на прежнем synthetic holdout пока не дают доказанной super-additive synergy.
- B2507 не запускается в replay mode в обычном низком-pressure runtime; это ожидаемое ресурсное поведение, отдельный stress-test обязателен.
- Causal effect runtime для B2504/B2505 не считается автоматически каждый цикл; lesion остаётся отдельным evaluation operation.

## Решение

Релиз допускается как research-release, но не как заявление о consciousness.
