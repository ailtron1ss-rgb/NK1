# Release Notes B378 — 35.6.28

B378 — Physical Action Consequence Gate.

Главное изменение: разделены `device observation` и `device actuation receipt`. Успех Termux-команды больше не равен доказанному внешнему эффекту.

Изменены:
- `src/organism/body/EmbodiedActionExecutor.ts`
- state normalization в `src/organism/core/OrganismCore.ts`
- release contract / VERSION / manifests
- B378 causal/performance tests
- B378 architecture/audit/progress documentation

Проверено:
- host не повышает физический evidence class;
- `rest` остаётся derived;
- TTS не получает ложную `verified=true`;
- observation на реальном Android будет повышаться до verified только при свежем независимом device sample.

Физический Android/Termux в этой среде всё ещё НЕ сертифицирован.
