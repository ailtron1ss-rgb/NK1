# P2716 — глубокая интеграция нейронного credit-контура

## Цель прохода

P2716 не добавляет ещё один изолированный learner. Он связывает уже существующие механизмы в единый экспериментальный регулятор:

`experience → multi-horizon credit → phase selection → adaptive plasticity → synaptic protection → replay/consolidation → world/self coupling → active experimentation → mobile maintenance → external promotion gate`

Владелец нейронного состояния остаётся `NeuralExperienceBranch`.

## Что реально внедрено

### 1. Multi-horizon credit

Добавлена лестница задержек `1/2/4/8/16/32/64/128` тактов. Она агрегирует signed credit поверх уже существующих fast/mid/slow eligibility traces P2705–P2708. Это координационный слой, а не заявление о биологической идентичности.

### 2. Unified plasticity controller

`P2716DeepIntegrationController` одновременно учитывает reward/error, TD, latent residual, verification, epistemic signal, replay credit, self-model error и world-model error. На их основе регулируются фаза, масштаб обучения, consolidation, protection и experiment drive.

### 3. Stability / plasticity protection

Защитная масса связана с локальной importance нейронов. Нейроны с накопленной полезностью получают более консервативный learning gate, а surprise/uncertainty может вернуть plasticity.

### 4. Мобильная непрерывность

Обнаружен реальный architectural gap: temporal-resolution governor мог пропускать полный cognitive pulse, и тогда neural branch физически не получал outcome. Добавлен дешёвый `microTick()`:

`compact sensory state → recurrent neural step → eligibility traces → multi-horizon credit → local synaptic update`

Это не полная cognition в каждый heartbeat; это отдельный hot-path substrate, сохраняющий реальную нейронную динамику и обучение между дорогими full pulses.

### 5. Persistence / restart

Обнаружен второй реальный дефект: migration schema не переносила `neuralExperienceBranch`, поэтому после restart branch мог возвращаться к default state. Состояние теперь явно проходит через `StateMigrations` и сохраняется на durable checkpoint.

## Проверка

- `P2716_DEEP_INTEGRATION=PASS` — 144 outcomes.
- `P2716_CONTINUAL_BATTERY=PASS` — A forgetting 0.0540 vs control 0.0510; B forgetting 0.0000 vs control 0.0046.
- `P2716_MOBILE_SOAK_RESTART=PASS` — 290 измеренных hot-path ticks в 320-cycle сценарии, после restart `deepOutcomes=246`, median ratio `1.444`, persisted=1.
- `P2708_LONG_HORIZON_CLOSURE=PASS` — 250 operational cycles, warmed median ratio `0.846`; при этом тест остаётся тяжёлым по памяти и не считается дешёвым mobile benchmark.
- `P2716_PROMOTION_GATE=PASS` — внутренние метрики сами по себе не дают promotion; внешний matched-control validation является обязательным gate.

## Важный отрицательный результат

На A→B continual benchmark P2716 пока не улучшает forgetting A: `0.0540` против `0.0510` control. Поэтому нельзя утверждать, что новый контур уже превосходит baseline по catastrophic forgetting. При этом на B в этом конкретном synthetic test forgetting снизился до `0.0000` против `0.0046` control, а траектории разделились.

## Что это означает

Сейчас у проекта появился связанный механизм управления пластичностью, но он остаётся экспериментальным. `promotionEligible` намеренно требует внешнего matched-control / ablation / counterfactual / continual / long-horizon / persistence / mobile evidence; внутренний score не считается доказательством улучшения.

## Исследовательские основания

- ICLR 2026 — Cascading Eligibility Traces: https://proceedings.iclr.cc/paper_files/paper/2026/hash/e647dad9086b5a4cc136e1d1926cc172-Abstract-Conference.html
- Nature Communications 2026 — BrainTrace: https://www.nature.com/articles/s41467-026-68453-w
- Frontiers in Neuroscience 2026 — Astrocyte-gated multi-timescale plasticity: https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2025.1768235/full
- Neurocomputing 2026 — Self-normalizing STDP: https://www.sciencedirect.com/science/article/pii/S0925231226008167
- Nature Communications 2026 — Active inference and artificial reasoning: https://www.nature.com/articles/s41467-026-77209-5
- Nature 2025 — adversarial GNWT/IIT testing: https://www.nature.com/articles/s41586-025-08888-1
