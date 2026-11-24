# P21 Review & Next Work

## Что улучшилось

P21 переводит несколько идей из концептуального отчёта в единый измеряемый контур. Теперь есть дополнительные защиты от монотонности, загрязнения evidence, отсутствия LLM, деградации policy и потери человечески читаемой longitudinal истории.

## Известные ограничения

1. Semantic firewall пока эвристический, а не learned classifier.
2. Model-swap catalog сравнивает backends, но не выполняет автоматически полноценный paired benchmark.
3. Dream Compiler создаёт procedural patterns из повторяемых traces, но ещё не компилирует их в отдельный исполняемый bytecode.
4. Time Capsule создаёт bounded text summaries, а не полноценные semantic narrative snapshots.
5. Shadow organism пока пассивный evaluator, не отдельная модель мира.

## Главный следующий технический долг

Физический Android endurance, local multimodal inference и более глубокий learned world model.


## P22 — реализовано в следующем релизе
P22 intentionally does not add another layer of cognitive terminology. Instead it closes the largest phone/runtime honesty gaps identified in the review:
- world persistence is batched instead of writing every autonomous cycle;
- normal chat avoids an automatic second LLM call;
- phone cadence is governed in one policy module and reacts to thermal trend, battery, RAM, CPU and slow cycles;
- sensor sampling is decoupled from cognition cadence;
- the default Gemini model no longer points at the retired 2.0 Flash endpoint;
- operational metrics expose the real scheduling/persistence mode.

The result is deliberately narrower than the P21 feature set: fewer hidden costs, fewer decorative signals, clearer semantics.
