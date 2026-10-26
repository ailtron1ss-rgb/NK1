# WorkPass322 — активация критических прерываний из интероцепции

**Дата:** 2026-10-25  
**Ветка:** `fix/cognitive-interrupt-severity-normalization-2026-10-25`  
**Черновой PR:** [#135](https://github.com/ailtron1ss-rgb/NK1/pull/135)  
**Целевая source-ветка:** `work/node24-project-pin-rebased-20261025`

## Найденная ошибка на уровне источника сигнала

В `runtime/neuro-kurisu/src/organism/core/CognitiveFrame.ts` тип прерывания выбирается по порогам:
- `resource-critical` при `energy01 < 0.18`;
- `thermal-critical` при `thermal01 > 0.82`;
- `memory-pressure` при `ramPressure01 > 0.86`.

Но отдельное поле `active` рассчитывалось только как `interruptPriority01 > 0.72`. Веса конкретных датчиков были ниже общего порога: `energy=0.17 → (1-energy)*0.86 ≈ 0.714`, `thermal=0.83 → thermal*0.80 ≈ 0.664`, `RAM=0.87 → RAM*0.78 ≈ 0.679`. Поэтому отдельное опасное состояние могло получить критическую метку, но не активировать защитное прерывание.

## Что изменено

1. **Источник:** `CognitiveFrame` теперь активирует прерывание, если сработал критический тип, независимо от общего эвристического порога. Числовой priority сохраняет роль измерения интенсивности, но больше не отменяет явный severity label.
2. **Маршрутизатор:** `CognitiveRoutingPolicy` закрывает спекулятивные counterfactual ветви по критическому типу даже при противоречивом `active=false`.
3. **Восстановление:** `CognitiveDependencyGraph` нормализует тип прерывания и восстанавливает `active=true` для известных критических меток, предотвращая ослабление защиты неконсистентным сохранённым флагом.
4. **Регрессии:** добавлен `cognitive-frame-critical-interrupt.mjs`: сырые значения энергоуровня, температуры и RAM проверяются в цепочке `buildCognitiveFrame → resolveCognitiveRoutingPolicy`. Расширены unit-тесты маршрутизатора и тест восстановления графа.
5. **Интеграция тестов:** тест кадра включён в `test:cognitive-integration-suite`; ранее существовавший `test:p320:cognitive-dependency-restore` также включён в composite gate.
6. **Достижимость CI:** текущая ветка добавлена в push-фильтры cognitive integration suite и repository wiring audit.

## Команды проверки

```sh
npm ci --prefix runtime/neuro-kurisu
npm --prefix runtime/neuro-kurisu run test:cognitive-frame-critical-interrupt
npm --prefix runtime/neuro-kurisu run test:cognitive-routing-policy
npm --prefix runtime/neuro-kurisu run test:p320:cognitive-dependency-restore
npm --prefix runtime/neuro-kurisu run test:cognitive-integration-suite
npm run test:repo-wiring
npm run audit:repo-wiring
```

## Статус доказательств

**Тесты не объявляются пройденными.** Последний проверенный набор GitHub workflow-run/status не содержал записей. Push-фильтры теперь включают ветку, но нужно подтвердить, что GitHub действительно выдал runner, шаги и результаты для актуального head SHA. Неподтверждённый CI нельзя трактовать ни как PASS, ни как failure приложения.

## Что осталось

Этот pass усиливает одну защитную границу когнитивной маршрутизации; он не завершает весь Neuro Kurisu. Остаются точная-head typecheck/build и runtime regression, полноценные browser/Live2D/TTS и Android/Termux тесты, независимая holdout-оценка памяти/обучения, длинный soak и license review. Release ZIP не менялся.
