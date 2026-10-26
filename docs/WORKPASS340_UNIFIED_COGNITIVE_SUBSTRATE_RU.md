# WorkPass340 — интеграция Unified Cognitive Substrate

**Дата:** 26 октября 2026 г.  
**Ветка:** `work/nk1-unified-substrate-runtime-integration-2026-10-26-r3`  
**Статус:** code and regression committed on a fresh base; exact-head validation pending.

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


## Additional runtime smoke added in this pass

The runtime now exposes `unifiedCognitiveSubstrateSnapshot()` as a cloned diagnostic read. `tests/organism-smoke.mjs` runs the existing 30-cycle mobile smoke, then asserts that the substrate cycle/tick advanced and coupling metrics are finite. It stops the runtime, reconstructs it against the same state-file path and checks that the substrate sidecar restores at least the prior cycle count/tick. The integration script now runs both `unified-substrate-runtime-wiring.mjs` and `organism-smoke.mjs`. This is authored coverage; it remains pending until the exact-head Actions result completes.


## CI-driven correction after first integration run

The first PR integration job successfully completed Node.js 24 setup, workspace dependency installation, environment doctor, project progress validation, app typecheck/build, and then failed in `typecheck-runtime.mjs` on two substrate wiring errors: `PredictionDebtState` was cast directly to `Record<string, unknown>`, and the typed cycle observation was read as if it contained a `vision` member. Both source issues were corrected in e4348fd8999d4cba03a7f29a10b98c063f8b1e76. The debt cast now uses an explicit `unknown` bridge; vision relation count is set to zero until the separate P41 pipeline exposes typed relation evidence. The corrected HEAD needs a fresh CI run; the earlier failure is not treated as a pass.


## Port to the fresh source base and CI-driven fixes

The earlier PR #150 was found to be diverged from the current source line (26 commits ahead, 11 behind) after WorkPass339 was merged. It was not merged. The substrate code and narrowly scoped runtime changes were re-applied on fresh branch `work/nk1-unified-substrate-runtime-integration-2026-10-26-r3`, which currently compares as 5 commits ahead / 0 behind the source base; the merged WorkPass339 signature hardening remains present.

The first attempt on the older branch found two TypeScript contract issues. Both are fixed in this fresh branch: prediction-debt aggregation uses an explicit `unknown` bridge before indexing, and relation count remains `0` until P41 provides typed relation evidence, rather than reading a nonexistent `cycleObservation.vision` property. The 30-cycle smoke now additionally asserts that substrate state advances and is restored from its sidecar after stop/re-init. This is authored coverage only; fresh-branch CI must still complete before calling it PASS.

**No progress-score uplift:** tracked lane scores and historical CI rows remain anchored to their prior tested code SHA. WorkPass340 itself is marked pending until exact-head typecheck and the wired regression/smoke suite pass.


**Fresh-base code/test checkpoint:** `5cf4b900be66b2daa9146da074c89096cdcd00ce`. Exact-head CI remains pending.


Periodic sidecar writes are wired on meaningful substrate changes and every 16 Core ticks, while the orderly-stop path performs a final flush. The latest runtime wiring commit is `5cf4b900be66b2daa9146da074c89096cdcd00ce`.
