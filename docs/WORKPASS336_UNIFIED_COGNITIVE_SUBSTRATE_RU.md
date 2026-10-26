# WorkPass336 — интеграция Unified Cognitive Substrate

**Дата:** 26 октября 2026 г.  
**Ветка:** `work/nk1-unified-substrate-runtime-integration-2026-10-26-r1`  
**Статус:** code and regression committed; exact-head validation pending.

## Проблема до изменения

В базовой линии `UnifiedCognitiveSubstrate.ts` был компактным 103-строчным адаптером, но реальный `OrganismRuntime` его не использовал. Runtime уже строил `CognitiveDependencyGraph` и ограничивал counterfactuals на основе ресурсов/interruption, однако агрегированный cross-system state (continuity/self-model, world uncertainty, prediction debt, device resources, evidence provenance) не входил в этот routing decision и не имел собственного restart-safe sidecar.

## Что подключено

1. **Строгий substrate state.** Версионная схема с проверкой own-properties; bounded finite metrics и safe counters; нормализация текстовых значений; отклонение неизвестной версии persisted snapshot.
2. **Реальный cycle boundary.** После `this.core.observe(cycleObservation)` и построения dependency state интегрируются значения self/world/prediction/resources, memory pressure и observation/evidence coverage.
3. **Durability.** Sidecar `${config.stateFile}.cognitive-substrate.json`; безопасное восстановление после повреждённого/несовместимого файла с operational warning; сохранение при значимом изменении или каждые 16 тиков; отдельный final flush при `stop()`.
4. **Связанная политика ресурсов.** `resolveUnifiedCognitiveWorkPolicy` накладывается на `resolveCognitiveRoutingPolicy`. Итоговый budget — пересечение upstream resource budget, interruption/dependency limits и substrate limits. Under low evidence, low readiness, thermal/RAM pressure or conflict, optional simulation budget falls or is disabled.
5. **Action ownership.** Substrate является агрегатором состояния и ограничителем необязательной вычислительной работы, а не отдельным арбитром действий. `OrganismCore` по-прежнему владеет выбором canonical action.
6. **Regression wiring.** `tests/unified-substrate-runtime-wiring.mjs` проверяет hostile persisted fields, non-finite values, invalid/replayed ticks, fail-closed optional-work policy и то, что реальный runtime связывает persistence, integration и policy. Test добавлен в cognitive integration suite и rebuild recovery chain.

## Почему перенесено выборочно

Ветка `fix/unified-substrate-runtime-wiring-rebased-2026-10-25` содержит нужную строгую версию substrate и полноценную runtime wiring. Но её `OrganismRuntime.ts` расходится с WorkPass334 примерно на десятки тысяч символов и включает другие изменения. Вместо wholesale overwrite перенесены узкие элементы: substrate schema, restore/integration/policy/persistence sections, тест и package-script wiring. Существующие routing policy и canonical Core action path сохранены.

## Что не подтверждено

- Локальные тесты/typecheck не запущены: эта среда не смогла разрешить DNS `github.com` для clone.
- До результативного Actions run exact HEAD не считается проверенным. Тестовые файлы/скрипты включены в cognitive integration suite, но их наличие не является доказательством PASS.
- Не заявляется, что слой доказывает сознание, общий интеллект или production readiness. Это архитектурное улучшение связности и устойчивости cognitive runtime.

## Следующие release gates

1. Успешные `npm run typecheck` и `npm run test:unified-substrate-runtime-wiring` на exact HEAD.
2. End-to-end runtime step/restart test с реальными persistence failures и проверкой, что canonical action не меняется при разных substrate work budgets.
3. Soak/heap/CPU evaluation на целевом Android/Termux устройстве.
4. Независимые holdout-измерения learning/transfer и внешние postcondition outcomes.
