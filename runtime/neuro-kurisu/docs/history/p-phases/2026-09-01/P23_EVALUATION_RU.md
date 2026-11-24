# P23 Evaluation — что проверено и что ещё нельзя считать доказанным

## Проверенный минимальный эксперимент

Синтетический deterministic corpus из 12 traces показывает:

- 12 experiences записываются;
- 12 replay updates выполняются один раз;
- повторный replay даёт 0 новых updates;
- высокий-quality context/action pattern проходит holdout validation и получает `promoted` status;
- shadow сравнения создаются для каждого опыта;
- adaptive-policy ablation создаётся для каждого опыта;
- checksum принимает исходный material и обнаруживает преднамеренное изменение material.

## Integration test

На реальном `OrganismCore + FileStateStore` host-side integration test проверяет:

- 8 outcomes → 8 experiences;
- 8 shadow comparisons;
- 8 ablation comparisons;
- manual P23 replay → 8 updates;
- state flush;
- новый `OrganismCore` → состояние восстанавливается;
- checksum после reload остаётся валидным;
- replay count не теряется.

## Что это доказывает

Это доказывает механическую связность P23 learning path и persistence.

Это НЕ доказывает:

- transfer learning;
- general intelligence;
- emergence of consciousness;
- superior performance on open-world tasks;
- superiority over modern RL/agent baselines.

## Следующий экспериментальный уровень

P24 должен добавить blind benchmark corpus, где организм не знает правильные ответы заранее, и нужно сравнивать:

`baseline`

против

`baseline + P23 learning`

по одной и той же задаче.

Только это позволит получить действительно causal claim о пользе P23.

## Truthfulness / anti-decoration gate

Перед P24 дополнительно подтверждены три правила: promoted skill реально влияет на future ranking; evidence debt реально влияет на `verify` и может уменьшаться после успешной проверки; checksum стабилен после JSON round-trip и после central commit checkpoint.
