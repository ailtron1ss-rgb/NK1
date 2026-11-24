# P2703 — Global Workspace Convergence

## Модуль
`src/organism/cognition/P2703GlobalWorkspaceConvergence.ts`

## Интеграция
`src/organism/cognition/NeuralExperienceBranch.ts`

## Что было до
- B282 и `GlobalWorkspaceSubstrateV2` уже существовали, но рабочая ветвь `NeuralExperienceBranch` не имела собственного bounded convergence шага, который собирал бы одновременно self/personality/goal/memory/world/causal/embodied/information/developmental сигналы перед действием.
- P2702 сделал personality динамической и персистентной; P2701 добавил recurrent/spiking temporal substrate.

## Что добавлено
1. Ограниченная coalition capacity=4.
2. Конкуренция 10 когнитивных источников по salience, uncertainty, prediction error и learned source weight.
3. Recurrent latent state 24-D, сохраняющий рабочий контекст между циклами.
4. Ignition/recurrence/diversity/broadcast metrics.
5. Broadcast непосредственно влияет на action bias в `NeuralExperienceBranch`.
6. Outcome learning: reward/verification/prediction error корректируют source weights и recurrent coupling.
7. Snapshot/restore и миграция через `NeuralExperienceBranchState.version=15`.
8. P2703 не заменяет B282/GlobalWorkspaceSubstrateV2: он является convergence layer, связывающим уже существующие подсистемы в live decision path.

## Реальный эффект
До: многочисленные subsystem biases проходили в `CrossLayerAdaptiveArbiter`, а существующие workspace substrates были представлены отдельными путями.
После: перед fusion создаётся ограниченная конкурирующая coalition; её recurrent/broadcast state меняет action bias и затем обучается по исходу.

## Ограничение
Это инженерная модель bounded global workspace. Она не доказывает субъективное сознание, биологическую эквивалентность или наличие феноменального опыта.

## Тест
`npm run test:p2703:global-workspace`

Проверяет coalition, ignition/broadcast, reward learning, snapshot/restore и live integration с `NeuralExperienceBranch`.
