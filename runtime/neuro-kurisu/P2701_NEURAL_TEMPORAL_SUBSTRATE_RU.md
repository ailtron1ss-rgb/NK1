# P2701 — Neural Temporal Substrate

## Модуль
`src/organism/cognition/NeuralTemporalSubstrate.ts`

## Что реализовано
- компактное recurrent/spiking ядро: 32 нейрона × 6 recurrent-связей;
- persistent membrane state + adaptation + sparse spikes;
- temporal pre/post traces и synaptic eligibility;
- reward-modulated STDP-like пластичность;
- обучаемый sensory projection;
- prediction readout и temporal embedding;
- полная snapshot/restore persistence;
- жёсткое ограничение активности для мобильного CPU.

## Реальная интеграция
`NeuralExperienceBranch` теперь вызывает substrate в live decision path. Его temporal embedding смешивается с сенсорным 64-D потоком до основного spiking/recurrent слоя, а после outcome тот же substrate получает reward/error/verification и меняет веса.

Это не декоративный neural-класс: тест проверяет spikes, обучение, изменение состояния и restart persistence.

## Проверка
- `npm run typecheck` — PASS
- `tests/p2701-neural-temporal-substrate.mjs` — PASS
- 80 temporal steps → 148 spikes
- 30 learning passes → 5649 synaptic updates
- prediction error substrate: 0.50 → 0.122
- branch integration: `learningUpdates > 0`

## Ограничение
P2701 усиливает инженерную нейронность и временную пластичность, но не является доказательством сознания или биологической эквивалентности мозга.
