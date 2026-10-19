# V119 — FINAL INTEGRATED

Финальная интеграция последних проходов V116–V118 поверх V115.

## Реальные изменения

- Добавлен causal HiPPO-LegS history state как runtime-only substrate. Чтение истории выполняется **до** обновления текущим сигналом, поэтому teaching signal шага t не может ретроактивно кредитовать сам себя.
- Добавлены режимы temporal credit `hippo` и `hybrid`; hybrid смешивает выбранный cascade stage с HiPPO reconstruction без новых trainable parameters.
- Добавлен изолированный `ProductKeySparseMemory`: реальный product-key routing, bounded runtime values и опциональный learned initial state. Он не является вторым default memory owner и не инстанцируется current trunk автоматически.
- Обновлён current/frontier API до V119.
- Сохранена backward migration policy: старые VXX checkpoints считаются legacy; incompatible runtime state не загружается молча.
- Добавлены final current tests и release manifest.

## Статус кандидатов

HiPPO/hybrid и product-key memory остаются research-only. Прежние synergy, post-update alignment, event-bank, QED/address, uncertainty-write, EFLA и adaptive mechanisms также не продвигаются в default без соответствующего evidence gate.

## Ограничение

Внешние research repositories используются как reference source, а не как копирование целого upstream проекта.
