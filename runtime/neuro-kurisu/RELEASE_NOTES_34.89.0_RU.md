# Neuro-Kurisu 34.89.0 — BIG PASS 115

## Основная цель
Усилить реальную цепочку `experience → prediction → outcome → causal memory → learning → changed behaviour`, не создавая дубликатов уже существующих cognitive systems.

## Что изменено
- `CausalExperienceStream` v3 хранит компактный 16-мерный policy feature trace, `learningQuality01` и `replayEligible`.
- Добавлен bounded causal replay в `P26TrueLearningEngine` через существующий `ParametricPolicyLearner`; максимум 32 кандидата за consolidation cycle.
- Replay разделяет samples на train/holdout: 75% обучение, 25% неиспользованный holdout.
- Holdout score измеряется до и после replay и записывается в существующие P26 metrics.
- Replay запускается вместе с периодической causal consolidation, поэтому обучение использует накопленный опыт, а не только текущий tick.
- Добавлен `trainFeatures()`/`predictFromFeatures()` для обучения по компактному trace без восстановления полного `OrganismState`; это существенно экономнее для телефона.
- Старые causal records мигрируют обратно-совместимо к schema 3; отсутствие feature trace не делает старые записи искусственно обучаемыми.
- Добавлено событие `policy-replay` в event log.
- Добавлен тест `tests/big-pass-115-causal-replay.mjs`.
- Обновлены canonical version/release manifests и README.

## Проверенные результаты
- Typecheck: PASS
- BIG PASS 113 system: PASS
- BIG PASS 114 reality/memory/self: PASS
- BIG PASS 115 causal replay: PASS
- Architecture: PASS, 0 cycles
- Core ownership: PASS
- Integrity: PASS
- Source hygiene: PASS
- Release source: PASS
- Analysis alignment: PASS, 52/52 checks

### BIG PASS 115 benchmark
`24` replay candidates → `18` train updates + `6` holdout samples.
Holdout delta: `+0.0119`
Mean replay loss: `0.1585`

Это небольшой, но реальный measured generalization signal; он не интерпретируется как доказательство general intelligence или consciousness.

## Ограничения
- Текущий replay учит компактную parametric policy, а не изменяет архитектуру cognition.
- Holdout является внутренним runtime holdout и не заменяет независимое long-horizon evaluation.
- Новые state features сознательно ограничены 16 float values для контроля RAM/CPU/persistence cost.

## Следующий большой этап
`BIG PASS 116 — causal world learning`: научить world/self predictors использовать verified outcomes и replay для улучшения предсказаний, затем связать это с skill acquisition и долговременной индивидуальностью.
