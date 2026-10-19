# BIG PASS 205 — Memory→World Causal Closure

## Цель

Закрыть evidence debt из BIG PASS 204: наличие памяти и world-state в одном цикле не считалось причинной связью. PASS 205 добавляет отдельный causal bridge, который сравнивает world prediction в контрфактическом режиме без memory evidence и после его применения, фиксирует конкретные memory IDs, provenance и material delta, а затем проверяет persistence после restart.

## Внедрение

Добавлен `src/organism/system/MemoryWorldCausalBridge.ts`. В `WorldModel2` появилась bounded memory-evidence projection: память получает явный provenance path в latent world state и bounded influence на world prediction. `WorldSubsystemRuntime.applyMemoryEvidence()` выполняет контрфактическую пару prediction calls. `OrganismCore` применяет найденные memories до world arbitration, записывает causal link и сохраняет bridge state. Состояние прошло через `StateMigrations`.

## Проверка

`BIG_PASS_205_MEMORY_WORLD_CAUSAL=PASS`

В тесте: 6 memory-world applications, 6/6 verified links, last influence `0.0354321666`, material delta `0.0354321666`, closure `memoryToWorld=true`, restore `PASS`. World latent state после restart сохраняет memory provenance IDs.

## Критический смысл результата

Теперь `memory→world` означает не просто совместную активность двух подсистем, а наблюдаемый counterfactual effect на world prediction. Это всё ещё не является доказательством физической причинности в открытом мире: следующий уровень проверки должен сделать replay/ablation с одинаковым внешним входом и разными memory evidence paths, а затем проверить downstream action/outcome.

## Регрессии

Typecheck и BIG PASS 205 проходят. Полный release-gate включён как `npm run release:brain205`.
