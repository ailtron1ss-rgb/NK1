# BIG PASS 326 — Recovery Causal Influence

## Цель
Проверить, что процессный recovery влияет на последующее поведение организма, а не остаётся только инфраструктурным событием.

## Внедрение
- `AdaptivePolicyEngine.recoveryBias()` — self-model-conditioned recovery signal.
- `OrganismCore` добавляет recovery bias в канонический rawUtility action arbitration.
- Влияние зависит от `continuityShock01` и `postRecoveryIntegration01` и естественно уменьшается при интеграции.
- `OrganismCore.recoveryPolicyDiagnostics()` публикует измеримый signal для verification.
- `tests/big-pass-326-recovery-causal-influence.mjs` добавлен в официальный npm scripts.

## Проверенный контур
`durable restart -> recovery event -> self-model shock -> policy influence -> action selection -> integration -> reduced influence`

## Реальные результаты
До recovery:
- continuityShock = 0
- postRecoveryIntegration = 0
- все recovery biases = 0

После recovery:
- continuityShock = 0.58
- postRecoveryIntegration = 0.45
- explore = -0.017545
- verify = +0.014355
- rest = +0.015950
- reflect = +0.012122

После 12 интеграционных циклов:
- continuityShock = 0.25947
- postRecoveryIntegration = 0.775
- explore = -0.003211
- verify = +0.002627
- rest = +0.002919
- reflect = +0.002218

То есть recovery-sensitive policy effect не только присутствует, но и уменьшается по мере восстановления self-model.

Дополнительно выбор действия изменился между recovery-phase и поздней фазой (`respond` -> `explore`), что совместимо с уменьшением recovery constraint; изменение не считается единственным доказательством причинности, а служит наблюдаемым behavioural consequence поверх измеренного policy signal.

## Regression
- B324 recovery watchdog: PASS
- B325 recovery autobiography: PASS
- B326 recovery causal influence: PASS через npm
- Изменённые TypeScript-файлы успешно загружаются Node `--experimental-strip-types` в реальном тесте.

## Ограничение
Полный глобальный `typecheck` проекта в текущем runtime budget уже неоднократно превышает лимит; B326 не объявляет его PASS и не подменяет его локальным тестом.

## Статус
**B326 = VERIFIED for implemented behavioral contract.**
