# Neuro/Kurisu 35.18.2 — P2836 Reality-First

Дата: 2026-09-20

## Основной апгрейд

P2836 перестраивает outcome path: simulator остаётся predictive shadow, а успешный real Android/Termux outcome становится первичным источником feedback/learning в `hybrid`/`external-first` режимах.

## Код

- Добавлен `RealityGroundingController`.
- Добавлен `NeuralCausalTraceLedger`.
- Runtime feedback перенесён после embodied outcome.
- B365 grounded transition learning получает reality evidence.
- B380 temporal closure получает grounded reward/surprise/verification.
- Continuous cognitive fabric получает grounded signal.
- P2820 получил fast/slow memory thermostat.
- NeuralExperienceBranch replay budget использует adaptive allocation.
- Новые ledgers сохраняются в organism system state.

## Проверки

- Typecheck — PASS.
- P2835 hotpath — PASS.
- P2835 persistence — PASS.
- P2836 reality-first integration — PASS.

## Ограничение

Тестирование внутри Linux/Node не может подтвердить реальное Android hardware execution. Поэтому `external-first` в локальной интеграции безопасно откатывается к simulation, когда Android capability отсутствует. Аппаратная certification остаётся следующим обязательным этапом.
