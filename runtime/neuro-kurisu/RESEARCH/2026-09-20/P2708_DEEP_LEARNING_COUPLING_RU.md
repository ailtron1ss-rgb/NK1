# P2708 — глубокая связка delayed credit → epistemic learning → self-normalization → continual validation

## Что сделано

P2708 не добавляет ещё один независимый neural subsystem. Вместо этого он связывает уже существующие владельцы через один экспериментальный coupling layer:

`experience → causal credit (TD + latent residual + verification) → epistemic teaching (information gain + experiment value) → adaptive credit mix → multi-timescale eligibility → astro-like gate → synaptic update → self-normalization → replay/continual evaluation`

### 1. DeepLearningCoupler

`src/organism/cognition/P2708DeepLearningCoupler.ts` теперь является отдельным экспериментальным контроллером с persisted state.

Он отвечает только за:
- нормализацию delayed-credit профилей;
- смешивание causal и epistemic teaching signals;
- self-normalizing weight dynamics;
- диагностические метрики coupling/stability/forgetting proxy.

Он не становится владельцем world model, memory, personality или workspace.

### 2. Четыре delay-профиля

Добавлены профили `short / balanced / long / ultra` с разными decay/weight коэффициентами для fast/mid/slow traces.

Это даёт возможность делать factorial sweep без копирования neural substrate.

### 3. Information gain → credit

P2708 впервые проводит information-gain/experiment value до самого локального credit signal. Это важно: действие теперь может получать часть teaching signal не только за reward, но и за то, насколько оно было epistemically informative.

Это bounded experimental signal, а не утверждение, что проект реализует полноценный active-inference алгоритм.

### 4. Self-normalizing synapses

После обучения экспериментальный слой периодически центрирует строки recurrent weights и тянет RMS к малому target. Это основано на идее локальной event-driven self-normalization из Neurocomputing 2026.

Механизм ограничен и аблируем. Он не заменяет homeostasis P2705.

## Проверки

### Deep coupling

`P2708_DEEP_LEARNING_COUPLING=PASS`
- causal/experimental trajectory difference: `15.80883`
- normalized weight mean: `0.00000`
- normalized RMS: `0.03500`
- coupled credit EMA: `0.0904`
- epistemic teaching EMA: `0.4944`
- normalization updates: `3456`
- neural 72-cycle run: `~268 ms`

### Continual factorial

`P2708_CONTINUAL_FACTORIAL=PASS`

Важно: тест **не показал превосходство experimental слоя** по forgetting в текущей синтетической задаче:
- experimental forgetting proxy: `0.0344`
- control forgetting proxy: `0.0250`
- обе версии generalization: `1.0000`
- trajectory difference: `134.3952`

Следовательно, P2708 доказывает работоспособность механизма и сильное изменение траектории, но не превосходство. Следующий этап должен искать режимы, где связка действительно уменьшает interference, а не считать изменение траектории успехом.

### Long-horizon mobile closure

`P2708_LONG_HORIZON_CLOSURE=PASS`
- 250 operational cycles;
- mobile performance profile;
- warmed median ratio в последнем прогоне: `1.615`;
- first median: `0.21 ms`;
- last median: `0.34 ms`;
- heap growth: `1.313`;
- p95 approximation: `154.85 ms`.

Это закрывает прежний блокирующий тестовый дефект: тест теперь завершает процесс после успешной проверки, поэтому фоновые runtime handles не превращают PASS в timeout.

## Интерпретация

P2708 — это не доказательство сознания. Это инженерный шаг к единой causal learning spine, в которой prediction/error, world-model uncertainty, epistemic value, delayed eligibility и synaptic stability встречаются в одной проверяемой цепочке.

## Источники

- ICLR 2026 — Cascading Eligibility Traces
- Nature Communications 2026 — BrainTrace
- Frontiers in Neuroscience 2026 — AGMP
- Neurocomputing 2026 — Self-normalizing STDP
- Nature Communications 2026 — Active inference and artificial reasoning
- Nature 2025 — adversarial GNWT/IIT testing
