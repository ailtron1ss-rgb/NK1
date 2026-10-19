# NEURO-KURISU 35.6.1 — B266 FULL BRAIN AUDIT

Дата: 2026-09-12
Основа: B265 verified release archive

## 1. Повторная проверка перед разработкой
Перед B266 повторно проверены:
- B265 audit;
- B265 source;
- B264 source and persistence;
- OrganismCore ownership;
- StateMigrations;
- package scripts;
- B265 standalone/Core/migration tests.

Ключевой вывод B265 сохранился: independent evaluator существует отдельно от policy и не принимает self-reported reward как truth source. B264 policy получает положительный, но умеренный результат на Core holdout.

## 2. Цель B266
B266 создан не как ещё один самостоятельный cognitive organ. Он проверяет generalization boundary всей цепочки:

`latent -> recurrent learning -> causal memory -> unified world model -> multi-timescale dynamics -> action causality -> causal policy -> independent evaluation -> hidden task families`

Проверяются четыре ранее недостаточно закрытых свойства:
1. перенос на скрытые динамические семейства;
2. работа на более длинном горизонте;
3. работа при delayed reward;
4. устойчивость к adversarial intervention/regime shift.

## 3. Что добавлено
`src/organism/cognition/B266HiddenTaskGeneralization.ts`

Функции:
- deterministic hidden-family generation;
- independent task dynamics;
- independent reward function;
- variable horizon;
- variable reward delay;
- variable drift;
- adversarial families;
- baseline/random comparison;
- long-horizon metric;
- delayed-reward metric;
- intervention robustness;
- catastrophic-shift indicator;
- replay stress;
- snapshot/restore.

B266 подключён к `OrganismCore` и `StateMigrations`.

Добавлены package scripts:
- `test:big-pass-265`
- `test:big-pass-265:migration`
- `test:big-pass-265:core`
- `test:big-pass-266`
- `test:big-pass-266:migration`
- `test:big-pass-266:core`

## 4. Реальная цепочка
B266 не заменяет B264/B265.

Policy выбирает действие -> независимая transition function строит следующий state/reward -> trajectory оценивается baseline/random -> holdout использует новые seeds/параметры -> intervention gap оценивает чувствительность -> replay stress пересчитывает агрегаты.

Это остаётся цифровым экспериментальным контуром, а не доказательством физической причинности.

## 5. Результаты standalone
- 8 train families.
- 6 hidden holdout families.
- 14 episodes.
- train gain = 0.01918.
- hidden-family gain = 0.01161.
- long-horizon gain = 0.03078.
- delayed-reward gain = 0.02185.
- delayed-reward gain after replay stress = 0.07171.
- robustness = 0.80215.
- catastrophic shift = 0.00757.
- calibration = 0.50337.
- migration = PASS.
- snapshot restore = PASS.

## 6. Результаты OrganismCore
B266 запускался поверх реального `OrganismCore` и chooser, использующего B264 causal policy arbitration.

- 8 train families.
- 6 hidden holdout families.
- train gain = 0.03504.
- hidden-family gain = 0.02778.
- long-horizon gain = 0.05597.
- delayed-reward gain = 0.05329.
- delayed-reward gain after stress = 0.10152.
- robustness = 0.77187.
- catastrophic shift = 0.00726.
- calibration = 0.54633.
- persisted families = 14.
- persisted episodes = 14.
- Core snapshot contains B266 state = PASS.

## 7. Что доказано
1. Evaluation family can change independently of B264 policy.
2. Holdout horizon is longer than training horizon.
3. Reward delay differs between train and holdout.
4. Adversarial task families exist outside training families.
5. B264-driven action selection maintains a positive average gain on hidden families in Core.
6. Replay stress increases delayed-reward evidence in the current experiment.
7. Persistence/migration of B266 state works.
8. The project can now measure generalization separately from ordinary in-distribution success.

## 8. Что НЕ доказано
- Не доказана общая general intelligence.
- Не доказано самостоятельное формирование новых task abstractions.
- Не доказана реальная внешняя физическая causal agency.
- Не доказана consciousness.
- Не доказано, что improvement переносится на open-world environment.
- Не доказано, что B266 policy gain остаётся положительным при существенно более длинных горизонтах.
- Не доказано, что policy сама обнаруживает regime shift без вручную заданного evaluator.

## 9. Проверки
PASS:
- Typecheck: PASS.
- B265 standalone: PASS.
- B265 migration: PASS.
- B265 Core: PASS.
- B266 standalone: PASS.
- B266 migration: PASS.
- B266 Core: PASS.
- Architecture: PASS — 966 source files, 349 canonical files, 0 cycles, 0 missing, 0 legacy leakage.
- Integrity: PASS — 1937 files.
- Source hygiene: PASS — 1931 files, 0 errors, 0 warnings.
- Forensics: PASS — 1916 active files, 0 empty, 0 duplicate content/names, 0 path markers.
- Release contract: PASS.
- Lockfile: PASS.
- Release source: PASS.
- Doctor: PASS.
- Archive manifest: PASS — 2162 files, missing 0, hash mismatches 0, extra 0.

Не заявляются:
- Full executable syntax sweep: not claimed PASS because previous full-tree run is environment-time limited.
- Full historical audit: not claimed PASS for the same reason.

## 10. Оценки 1–100
| Element | Score |
|---|---:|
| Canonical neural substrate | 56 |
| Causal memory | 53 |
| Unified world model | 55 |
| Multi-timescale dynamics | 57 |
| Action causality | 61 |
| Causal policy | 66 |
| Independent evaluation | 72 |
| Hidden-family generalization | 58 |
| Long-horizon behaviour | 55 |
| Delayed-reward handling | 57 |
| Adversarial robustness | 54 |
| Persistence | 97 |
| Migration discipline | 96 |
| Release engineering | 94 |
| Scientific evidence quality | 64 |
| Brain branch engineering | 86 |
| Overall brain scientific maturity | 66 |

Эти scores являются инженерно-экспериментальной оценкой проекта, а не научными измерениями интеллекта/сознания.

## 11. Главная проблема сейчас
После B266 главный разрыв находится уже не между модулями, а между evaluation и self-directed adaptation.

Система может показать, что policy лучше baseline на скрытых семействах, но ещё не обязана сама:
- обнаружить, что мир изменился;
- оценить uncertainty;
- прекратить exploit;
- запросить verification;
- изменить policy/model architecture;
- проверить, что изменение было полезным.

## 12. Рекомендуемый следующий большой проход — B267
B267 должен объединить:
1. online regime-shift detector;
2. uncertainty calibrated by independent holdout;
3. active verification policy;
4. controlled exploration/exploitation switch;
5. lifelong task-family expansion;
6. post-shift recovery benchmark;
7. no-explanation-of-self improvement rule;
8. independent evaluator generated after adaptation.

Ключевая проверка B267:
`unknown shift -> detect -> doubt -> investigate -> act -> learn -> re-evaluate -> survive`.

## 13. Итог
B266 является VERIFIED ENGINEERING PASS с умеренным experimental evidence gain.

Он существенно улучшает доказательную структуру проекта, потому что впервые проверяет перенос поведения на скрытые семейства, более длинные горизонты, delayed rewards и adversarial interventions.

Но B266 не переводит проект в открытый мир и не доказывает AGI, сознание или полную автономность. Следующий правильный шаг — сделать обнаружение изменения мира и адаптацию частью самой живой cognitive loop, а не только отдельного benchmark.
