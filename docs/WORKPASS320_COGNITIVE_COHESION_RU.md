# WorkPass320 — замыкание когнитивной связности

**Статус:** интеграционный change set; не production-релиз.

## Что соединено

1. `OrganismRuntime` строит `CognitiveFrame` из результата реального цикла и разрешает frame через `CognitiveDependencyGraph`.
2. Граф сохраняет диагностический снимок в отдельном sidecar-файле состояния. Остановка сбрасывает состояние; следующий запуск восстанавливает его и продолжает монотонную идентичность tick.
3. `CognitiveRoutingPolicy` принимает состояние прерывания/dirty-domain и бюджет, уже разрешённый ресурсным allocator. Она может только ограничивать budget (максимум три ветви), при critical interrupt выключает speculative work, при активном interrupt/governance оставляет максимум одну ветвь и отключает альтернативные projection.
4. Каноническое действие остаётся за planner/Core. Политика не заменяет действие и не повышает предоставленный ресурсный лимит.
5. Публикуется evidence event `cognitive-routing-policy`, где видны исходный/допущенный budget, причина, interrupt и governance wake.

## Повторяемые проверки

Из корня репозитория:

```sh
npm ci --prefix runtime/neuro-kurisu
npm run test:cognitive-integration-suite
```

Composite suite включает runtime typecheck, cycle-boundary tests, graph persistence/restart wiring, routing-policy unit/runtime contracts, memory budget/restore integrity и P23 restore integrity. CI устанавливает зависимости независимо в чистом runner; локальный прогон должен быть зафиксирован отдельно.

## Ограничения и release gates

- Этот change set не доказывает production-readiness и не активирует новые destructive capabilities.
- Установка/прогон зависимостей в текущем sandbox не подтверждены: его сетевой доступ к GitHub/npm недоступен; поэтому создан отдельный remote CI gate.
- Остаются обязательными production UI build + real browser/Live2D E2E, реальная Android/Termux audio проверка, независимый multi-seed retrieval uplift (не продвигать пока `recallDelta <= 0`), длительный soak и license review.
- GitHub Release ZIP не заменён: доступный коннектор читает release metadata, но не может надёжно скачать/пересобрать/загрузить binary asset размером ~135 MB. Источник кода и релизный архив остаются явно различимыми.
