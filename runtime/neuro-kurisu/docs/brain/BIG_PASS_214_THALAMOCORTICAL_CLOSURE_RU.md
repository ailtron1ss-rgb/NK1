# BIG PASS 214 — замкнутый таламо-кортикальный контур

## Цель

Превратить существующую B207/B211–B213 связку из однонаправленного `thalamus -> cortex` gating + локального cortical prediction в ограниченный взаимный контур:

`state -> thalamic pre-gate -> cortical inference -> cortical precision/error -> thalamic closed-loop re-gain -> arbitration`

При этом один шумный корковый кадр не должен захватывать шлюз. Feedback ограничен по величине, сглаживается и проходит через отдельную channel-model memory.

Это вычислительная функциональная аналогия, а не утверждение анатомической эквивалентности.

## Что изменилось

1. `ThalamocorticalGate` получил bounded `closeLoop(...)`.
2. Для семи каналов появились персистентные `channelModels`.
3. Feedback учитывает cortical precision, contradiction, information gain, posterior и local prediction error.
4. Изменение одного feedback-frame ограничено диапазоном примерно `[-18%, +12%]` до итогового clamp.
5. `recordOutcome(...)` обновляет канал, связанный с действием.
6. `CognitiveKernelCoordinator` теперь выполняет pre-gate -> cortical inference -> closed-loop feedback до финального candidate gating.
7. `OrganismCore` и `StateMigrations` сохраняют/восстанавливают thalamocortical state.
8. Atlas edge `cortex -> thalamus` повышен с research до verified.

## Почему это полезно не только как аналог мозга

Замкнутый routing создаёт дополнительную инженерную возможность: не вычислять и не пропускать через весь downstream одинаковый объём данных. Information gain и contradiction становятся сигналами для изменения пропускной способности конкретного канала, а не только для изменения confidence.

Это особенно важно для мобильного/edge режима: современные работы по dynamic sparsity и neuromorphic systems отдельно рассматривают selective updates, predictive coding, attention/gating и low-power closed-loop computation как путь к снижению вычислительной стоимости. [S1][S2][S3]

## Проверка

### Causal routing

До feedback:
- action channel gain: `0.73771408`
- research channel gain: `0.6271448`

После cortical feedback:
- action channel gain: `0.73771408` в baseline scenario
- research channel gain: `0.5601657354`
- loop gain: `0.6351375062`
- loop error: `0.1142857143`

Research-channel change обусловлен высоким contradiction / низким precision именно у `verify`, что показывает реальное directional влияние feedback.

### Robustness

На намеренно враждебном feedback:
- action gain: `0.6049255456`
- изменение остаётся ограниченным;
- feedback frame не может внести неограниченное усиление.

### Learning

После 14 outcome updates для `explore -> action`:
- posterior: `0.7361107261`
- precision: `0.6061553528`
- samples: `14`

### Persistence

Core run:
- closed loops: `4`
- restart: `4`
- channel model snapshot совпал после восстановления.

## Регрессия

PASS:
- B208
- B211
- B212
- B213
- B214
- TYPECHECK

## Научная рамка

Современные данные поддерживают роль таламуса в state-dependent routing и brain-wide information processing, а sensory thalamocortical circuits имеют modality-specific wiring. Последние работы также связывают prediction/uncertainty с coordinated hippocampal-cortical dynamics и рассматривают dynamic sparsity как путь к energy-efficient intelligent perception. Это мотивирует функциональную, а не буквальную архитектурную реализацию в Neuro-Kurisu. [S4][S5][S6]

## Источники

- [S1] Nature Communications — Exploiting neuro-inspired dynamic sparsity for energy-efficient intelligent perception: https://www.nature.com/articles/s41467-025-65387-7
- [S2] Nature Electronics — Efficient training of neuromorphic electronics (2026): https://www.nature.com/articles/s41928-026-01631-2
- [S3] Nature Reviews Electrical Engineering — Figures of merit for neuromorphic devices through biological emulation efficacy (2026): https://www.nature.com/articles/s44287-026-00321-7
- [S4] Nature Reviews Neuroscience — Sensory modality-specific wiring of thalamocortical circuits: https://www.nature.com/articles/s41583-025-00945-y
- [S5] Nature Neuroscience — Human hippocampal ripples tune cortical responses based on predicted uncertainty (2026): https://www.nature.com/articles/s41593-026-02345-6
- [S6] Nature Reviews Neuroscience — Thalamus, brain-wide information processing and adaptive behavior: https://www.nature.com/articles/s41583-023-00701-0
