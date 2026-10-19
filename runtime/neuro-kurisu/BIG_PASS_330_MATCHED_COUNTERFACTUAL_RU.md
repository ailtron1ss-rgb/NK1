# B330 — Matched Counterfactual Evidence Gate / перепроверка B329
Дата: 2026-09-14
Проект: Neuro-Kurisu 35.6.1

## 1. Что перепроверено
Перед внедрением B330 повторно запущены B326, B327, B328 и B329. Отчёт B329 сопоставлен с фактическим `AdaptivePolicyEngine`, `OrganismCore`, `OrganismRuntime` и `StateMigrations`.

Отдельно исправлена проблема schema-version: после restore raw state мог перекрывать новый default и возвращать `recoveryStrategy.version=2`. Теперь restore принудительно нормализует версию до 3.

## 2. Результат B329 recheck
- B329 weak causal: 3 blocked / 0 promoted.
- B329 ambiguous counterfactual: 3 blocked / 0 promoted.
- B329 strong synthetic evidence: 1 promoted.
- B328 reversal/holdout: PASS; statusAfter=`reversed`, effect01=-0.2436498432, unrelated holdout=0.
- B327 direct learning: PASS.
- B327 real Core: PASS; 3 independent boots, 3 causal blocks, 0 promotions.

## 3. Найденное ограничение B329
`alternativeExpected01` до B330 мог быть только predicted utility ближайшей альтернативы. Это model-based counterfactual, а не matched intervention evidence.

B330 вводит явный provenance:
- `model` — только прогноз альтернативы;
- `matched-simulated` — альтернативная ветка построена из того же pre-state simulator-а;
- `external` — предусмотренный future path для внешнего подтверждения.

Promotion теперь требует:
- independent evidence;
- causal confidence >= 0.65;
- counterfactual support >= 0.60;
- source != `model`;
- минимум 3 matched trials на episode;
- минимум 3 независимых boot-а и согласованность evidence.

Candidate episodes также обязаны иметь matched source и >=3 matched trials. Это предотвращает ситуацию, когда один текущий сильный episode мог бы легитимизировать старые model-only episodes.

## 4. Runtime integration
`OrganismRuntime` после реального `WorldEnvironment.step()` сохраняет matched alternative, построенную через тот же pre-state с независимым `project()` вызовом.

Это записывается в `OrganismCore` как `matched-simulated` evidence.

На каждом обычном runtime boot сейчас доступно только `matchedTrials=1`, поэтому automatic promotion намеренно не происходит. Это safety property, а не failure.

## 5. B330 direct gate
### Model-only
3 episodes → promotions=0, causalBlocked=3.

### One matched trial
3 episodes с matched-simulated, но matchedTrials=1 → promotions=0.

### Strong matched evidence
3 episodes с matched-simulated и matchedTrials=3 → promotions=1; meanMatchedTrials=3.

Restore сохраняет promotion, matchedCounterfactuals и version=3.

## 6. Core multi-boot
После 3 independent runtime boots:
- recoveryStrategy.version=3;
- episodes=3;
- matchedCounterfactuals=3;
- matchedTrials каждого episode=1;
- causalBlockedEpisodes=3;
- promotions=0.

Causal confidence остаётся около 0.286 / 0.321 / 0.355, counterfactualSupport=0.46.

Следовательно, реальный Core не может сам себя убедить в причинности только собственной моделью и одной matched simulation branch.

## 7. Verification
- npm run typecheck: PASS
- B326 recovery causal influence: PASS
- B327 direct learning: PASS
- B327 Core recovery learning: PASS
- B328 reversal/holdout: PASS
- B329 causal promotion gate: PASS
- B330 matched counterfactual gate: PASS

## 8. Ограничения
`matched-simulated` всё ещё не является независимым физическим экспериментом. Это stronger simulator intervention evidence: один и тот же pre-state, отдельная ветка, но тот же environment model.

Для дальнейшего продвижения нужен либо многократный matched rollout с контролем независимости, либо внешний/реальный world transition evidence. Порог нельзя снижать для получения promotion.

## 9. Следующий этап
B331 — repeated matched interventions + causal calibration: повторяем selected/alternative interventions на сопоставимых состояниях, измеряем calibration error, независимость trials и перенос причинной оценки между контекстами. Затем только при стабильной калибровке разрешается автоматическая promotion в Core.
