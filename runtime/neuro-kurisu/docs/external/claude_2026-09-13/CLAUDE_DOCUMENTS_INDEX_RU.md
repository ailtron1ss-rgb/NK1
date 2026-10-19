# Индекс и строгая оценка документов Claude

## Общий вердикт

Документы Claude полезны и местами очень сильны. Самая ценная часть — независимый взгляд на повторяющийся системный дефект: число модулей и метрик растёт быстрее, чем число доказанных поведенческих изменений. Этот вывод совпадает с текущим состоянием проекта и подтверждается свежим semantic audit: на финальном B301-снимке он показывает 3698 function-like единиц, 38 `VERIFIED`, 843 `INTEGRATION_ONLY`, 260 `UNSAFE_TO_AUTO_RUN` и 2557 `UNVERIFIED`.

Но документы **устарели относительно B297** и содержат плановые номера, которые уже разошлись с фактической последовательностью. Их надо использовать как контрольную вторую точку зрения, а не как спецификацию.

## Оценка документов

| Документ | Польза | Надёжность как снимка текущего состояния | Главная ценность | Главный недостаток |
|---|---:|---:|---|---|
| AUDIT_CLAUDE_B266_35_6_1_RU | 95/100 | 70/100 | независимая перепроверка + поиск реального autoRun regress | B266 snapshot, не B297 |
| BRAIN_BRANCH_CHAIN_PLAN_CLAUDE_RU | 94/100 | 68/100 | правильная зависимостная цепочка и запрет на «новый фронт» | часть плановых B263-B266 сдвинулась |
| DEEP_PROGRESS_AND_PLAN_CLAUDE_RU | 96/100 | 72/100 | кирпичи, критерии проверки, телефонные gates | слишком много будущих модулей; риск повторить ширину |
| BIG_PASS_CHAIN_B267_B330_RU | 93/100 | 62/100 | масштабный roadmap и конкретные критерии | поздние названия B-pass уже расходятся с фактическими B297+ |

## Что Claude увидел правильно

1. Автономность должна доказываться живым циклом, а не наличием таймера.
2. Нужен строгий Neural Reality Gate: причинность, lesion, restart/replay, transfer.
3. Дефицит разнообразных `action -> outcome` пар мешает причинному обучению.
4. Верификационный долг нельзя только измерять — его нужно систематически уменьшать.
5. Реальный Android gate должен быть отдельным evidence-уровнем.
6. Self-model, agency, motivation и sleep/replay нельзя держать как изолированные декоративные органы.

## Что уже устарело

- B266 autoRun regression: исторически это была реальная находка, но в текущем B297 `test:p15.5` проходит.
- Старые числа 38 VERIFIED / 1641 UNVERIFIED больше не описывают весь текущий 35.6.1/B297 semantic surface.
- `B297 = sleep consolidation` в позднем плановом документе Claude не соответствует фактическому текущему `B297ExecutiveNeuralFusion`.

## Что мы сохраняем из Claude

- `action diversity -> consequence diversity -> causal model` как одну из главных гипотез.
- impasse/subgoal как механизм «не молчать» при невозможности выбрать действие.
- verification budget.
- independent evaluator regeneration after adaptation.
- curiosity-gated safe exploration как эксперимент, а не как обычный пользовательский диалог.

## Что мы не принимаем автоматически

- любые проценты maturity без привязки к evidence tier;
- факт наличия теста как доказательство функции;
- новые большие модули, если не закрыт предыдущий causal loop;
- simulation как замену физическому Android и реальным последствиям.


## Перепроверка B299 → B300 (13.09.2026)

После очередного прохода документы Claude сохранены как контрольный источник, но не как текущая спецификация. Фактический код показывает, что B297 — исполнительное нейрослияние, B296 — компактное спайковое пластическое ядро, B299 — единый мост развития личности. В B300 этот же мост получил контекстное кредитование вместо создания второго реестра личности. Это специально сделано для предотвращения дублирования.

Ключевой свежий вывод: наличие B299 уже было доказано живыми циклами, но глобальная action-preference могла спутывать ситуацию с самим действием. B300 адресует именно этот дефект: социальный, эпистемический, автономный и поддерживающий контексты хранятся отдельно и смешиваются только при выборе действия.

## B300 final status

Итоговый статус перед архивированием находится в `B300_FINAL_AUDIT_STATUS_RU.md`. Он специально разделяет реально пройденные проверки и незакрытый 40-cycle harness/runtime cleanup, чтобы «PASS» не распространялся на то, чего тест не доказал.

## Перепроверка B301 (13.09.2026)

B301 сохранил главный вывод Claude: ширину модульной архитектуры нельзя считать доказательством функциональной зрелости. В B301 добавлен не новый personality/neural центр, а инфраструктурный слой Mobile State Economy и отдельный эксперимент unseen-context transfer.

В живом тесте B301 B296 дал 24 learning updates и 3744 synaptic updates, а checkpoint/restart сохранил это состояние. Последняя checkpoint projection уменьшилась примерно на 5.8% после bounded-history compaction. При transfer social/epistemic/autonomy mixed context получил `mixedBias=0.07409`, а lesion `.9` подавил его до `-0.00749`. Это узкое экспериментальное доказательство переноса, не доказательство общей интеллектуальной генерализации.

Также найден и исправлен регресс: вызов compaction из generic snapshot увеличивал стоимость обычного когнитивного цикла. Теперь compaction происходит только в checkpoint/save path.

Финальные статические проверки B301: architecture PASS, integrity PASS, forensics PASS, hygiene PASS, contract PASS, syntax PASS, UI smoke PASS, server smoke PASS. Semantic coverage остаётся низким: 38 VERIFIED из 3698 function-like units. Поэтому verification debt остаётся отдельной задачей, а сознание не считается доказанным.


## Перепроверка B302 (13.09.2026)

B302 подтвердил главный стратегический вывод Claude: дополнительный большой модуль сам по себе не нужен. Уже существующих neural/personality/consolidation layers достаточно, чтобы строить проверяемый long-horizon experiment. Поэтому B302 сделан coordinator/evidence ledger.

Свежая release evidence: 96 ticks, 30 full pulses, 66 micro-cycles, 8 autonomous full cycles, 6 world-transition verified outcomes, 4680 B296 synaptic updates и 3 B285 consolidations. Restart сохранил B302/B296/B299 trajectories.

При этом verification debt вырос по количеству surface functions: 38 VERIFIED из 3709 function-like units (~1.02%). Это не регресс доказанной нейронности, а показатель того, насколько большой остаётся непроверенный периферийный surface.

B301 checkpoint economy на последнем запуске сократила persisted projection с 4,657,330 до 4,269,624 bytes (~8.32%). Это помогает, но не делает проект гарантированно лёгким для любого среднего телефона.

B302 фиксирует partial P6 evidence, но не закрывает полноценную long-horizon autonomy. Consciousness remains unproven.

## B304 — Semantic Holdout + Sustained Resource-Aware Operation (13.09.2026)
- `DEEP_AUDIT_B304_SEMANTIC_SUSTAINED_2026-09-13_RU.md`
- `B304_EVIDENCE_REPORT_RU.md`
- `B304_RELEASE_NOTES_RU.md`
- `B304_PROGRESS_V8_RU.md`
- `B304_ARCHITECTURE_DECISIONS_RU.md`
- `B304_FINAL_AUDIT_STATUS_RU.md`
- `B304_NEXT_STEP_PLAN_RU.md`
- `RELEASE_VERIFICATION_B304_2026-09-13_RU.md`

B304 moves holdout testing from numeric/context fingerprints toward hidden semantic task families and ties the temporal governor to direct device resource signals. It remains evaluator-only and does not add another learner.

Свежая evidence: 128 ticks / 52 full / 76 micro; 3 training families / 3 unseen holdout families; novel holdout family rate 1.0; family transfer 0.6610; B296 8112 synaptic updates.

## B303 — Holdout Generalization & Recovery (13.09.2026)
- `DEEP_AUDIT_B303_HOLDOUT_GENERALIZATION_2026-09-13_RU.md`
- `B303_EVIDENCE_REPORT_RU.md`
- `B303_RELEASE_NOTES_RU.md`
- `B303_PROGRESS_V7_RU.md`
- `B303_NEXT_STEP_PLAN_RU.md`
- `B303_ARCHITECTURE_DECISIONS_RU.md`
- `B303_FINAL_AUDIT_STATUS_RU.md`
- `B303_DOCUMENTS_MANIFEST_RU.txt`

B303 is an evaluation-only holdout/recovery layer; it is not a second personality learner.
- `RELEASE_VERIFICATION_B303_2026-09-13_RU.md`


## Перепроверка B305 (13.09.2026)

B305 сохранил главный принцип Claude: не расширять архитектуру ради количества модулей. Вместо нового learner создан evaluation-only critical path ledger, который показывает, какие звенья существующей цепи реально активируются в live-cycle.

Свежие данные: 32 ticks, 16 full, 8 verified world outcomes, B296 2496 synaptic updates, B299 16 learning updates, critical path score 0.475. Самые сильные края: neural->causal 0.625, causal->personality 0.625, personality->policy 1.0. Слабее policy->outcome и outcome->persistence по 0.5; это специально сохранено в отчёте, а не скрыто одной общей оценкой.

B305 также провёл две независимые semantic holdout сессии с разными family splits; novel family rate 1.0 в обеих. Добавлен переносимый Termux benchmark. Он прошёл в host-proxy режиме, но реальный Android evidence остаётся открытым. Verification debt всё ещё велик: 38 VERIFIED из 3734 функций.

## B306
- DEEP_AUDIT_B306_AUTONOMOUS_CAUSAL_2026-09-13_RU.md
- B306_EVIDENCE_REPORT_RU.md
- B306_FINAL_AUDIT_STATUS_RU.md
- B306_PROGRESS_V10_RU.md
- B306_NEXT_STEP_PLAN_RU.md
- B306_RELEASE_NOTES_RU.md

## B307 — Verified Policy Closure (13.09.2026)
- `DEEP_AUDIT_B307_VERIFIED_POLICY_CLOSURE_2026-09-13_RU.md`
- `B307_EVIDENCE_REPORT_RU.md`
- `B307_FINAL_AUDIT_STATUS_RU.md`
- `B307_PROGRESS_V11_RU.md`
- `B307_NEXT_STEP_PLAN_RU.md`
- `B307_RELEASE_NOTES_RU.md`
- `B307_ARCHITECTURE_DECISIONS_RU.md`
- `RELEASE_VERIFICATION_B307_2026-09-13_RU.md`
- `B307_DOCUMENTS_MANIFEST_RU.txt`

B307 не создаёт второй policy learner. В существующий AdaptivePolicyEngine добавлен trusted verified branch, которая изменяет action bias только на подтверждённых world/external outcomes. Unit test поднял bias `0.0324 -> 0.0740`, а live OrganismCore сохранил verified policy rows после restart.
## B308 — Temporal Policy Credit
- DEEP_AUDIT_B308_TEMPORAL_POLICY_CREDIT_2026-09-13_RU.md
- B308_EVIDENCE_REPORT_RU.md
- B308_FINAL_AUDIT_STATUS_RU.md
- B308_PROGRESS_V12_RU.md
- B308_NEXT_STEP_PLAN_RU.md
- B308_RELEASE_NOTES_RU.md


## B309 — Canonical Arbitration Consolidation (13.09.2026)
- `DEEP_AUDIT_B309_ARBITRATION_CONSOLIDATION_2026-09-13_RU.md`
- `B309_EVIDENCE_REPORT_RU.md`
- `B309_FINAL_AUDIT_STATUS_RU.md`
- `B309_PROGRESS_V13_RU.md`
- `B309_NEXT_STEP_PLAN_RU.md`
- `B309_ARCHITECTURE_DECISIONS_RU.md`
- `B309_DOCUMENTS_MANIFEST_RU.txt`
- `RELEASE_VERIFICATION_B309_2026-09-13_RU.md`

B309 не создаёт новый policy learner. `AdaptivePolicyEngine` становится первым классом source в `B297ExecutiveNeuralFusion`, а ранний utility `adaptiveBias` убирается, чтобы один сигнал не учитывался дважды. B297 теперь оценивает повторяемость source-pairs и динамически уменьшает их effective weight. Unit lesion показывает, что policy source действительно влияет на executive selection.

Ключевой предел B309: это ещё не доказательство смены whole-organism action distribution. Остальные decision branches по-прежнему могут доминировать.

## B310 — Action Surface + Evidence-Weighted Source Credit (13.09.2026)
- `DEEP_AUDIT_B310_ACTION_SURFACE_SOURCE_CREDIT_2026-09-13_RU.md`
- `B310_EVIDENCE_REPORT_RU.md`
- `B310_FINAL_AUDIT_STATUS_RU.md`
- `B310_PROGRESS_V14_RU.md`
- `B310_NEXT_STEP_PLAN_RU.md`
- `B310_ARCHITECTURE_DECISIONS_RU.md`
- `B310_DOCUMENTS_MANIFEST_RU.txt`
- `RELEASE_VERIFICATION_B310_2026-09-13_RU.md`
- `B310_MOBILE_AND_NEURAL_NOTES_RU.md`

B310 не создаёт новый learner. В B297 добавлен evidence-weighted source credit: подтверждённый результат усиливает источники, чьи сигналы совпали с направлением исхода; молчащие источники не наказываются. Активные источники больше не разбавляются молчащими источниками в denominator. Utility aggregation получила bounded monotonic transform вместо жёсткого score=0 floor. Decision/workspace records теперь используют актуальную governed candidate surface.

Ключевой результат: positive policy credit 0.8994, negative 0.1171; policy effective weight 0.7615 -> 1.0 в изолированном verified experiment. В whole-organism controlled comparison natural distribution оставалась 11 explore / 13 verify до и после обучения, поэтому естественный frequency shift остаётся открытым B311 target. Policy lesion, однако, изменил distribution до 24 wait/24, что подтверждает causal influence policy channel.


## B311 — Policy Ecology Consolidation + Verified Context Transfer (13.09.2026)
- `DEEP_AUDIT_B311_POLICY_ECOLOGY_2026-09-13_RU.md`
- `B311_EVIDENCE_REPORT_RU.md`
- `B311_FINAL_AUDIT_STATUS_RU.md`
- `B311_PROGRESS_V15_RU.md`
- `B311_NEXT_STEP_PLAN_RU.md`
- `B311_ARCHITECTURE_DECISIONS_RU.md`
- `RELEASE_VERIFICATION_B311_2026-09-13_RU.md`
- `B311_DOCUMENTS_MANIFEST_RU.txt`

B311 объединяет policy-like learning signals в canonical B297 policy source и добавляет ограниченный verified transfer между соседними context buckets. Это не новый learner и не новый personality store.

## B312 — 13.09.2026

Новая source-of-truth серия:
- DEEP_AUDIT_B312_EXECUTIVE_DECISION_HANDOFF_2026-09-13_RU.md
- B312_EVIDENCE_REPORT_RU.md
- B312_PROGRESS_V16_RU.md
- B312_NEXT_STEP_PLAN_RU.md
- B312_ARCHITECTURE_DECISIONS_RU.md
- B312_RELEASE_NOTES_RU.md

Правило сохранено: текущие executable tests/release evidence имеют приоритет над историческими audit documents. B312 не повышает consciousness evidence и не объявляет natural long-horizon autonomy доказанной.

## B313 — 13.09.2026

- DEEP_AUDIT_B313_LONGITUDINAL_DEVELOPMENT_2026-09-13_RU.md
- B313_EVIDENCE_REPORT_RU.md
- B313_FINAL_AUDIT_STATUS_RU.md
- B313_PROGRESS_V17_RU.md
- B313_NEXT_STEP_PLAN_RU.md
- B313_ARCHITECTURE_DECISIONS_RU.md
- AUDIT_RECHECK_MATRIX_RU.md (B313 addendum)

B313 closes a real world-transition -> B285 life-consolidation gap and demonstrates divergent future action distributions after positive vs negative verified outcomes. It does not claim consciousness or open-ended autonomy.

## B314 — Controlled Negative Experience / Causal Scar / Recovery (13.09.2026)

- `DEEP_AUDIT_B314_CAUSAL_SCAR_RECOVERY_2026-09-13_RU.md`
- `B314_EVIDENCE_REPORT_RU.md`
- `B314_FINAL_AUDIT_STATUS_RU.md`
- `B314_PROGRESS_V18_RU.md`
- `B314_RELEASE_NOTES_RU.md`
- `B314_ARCHITECTURE_DECISIONS_RU.md`
- `B314_EXTERNAL_RESEARCH_AND_COMPARISON_RU.md`
- `RELEASE_VERIFICATION_B314_2026-09-13_RU.md`

B314 does not create another memory owner. It extends the canonical B285 autobiographical/life-consolidation state with a bounded, action-specific negative-experience scar and gradual corrective recovery. Verified negative outcomes can suppress the associated action; later verified corrective outcomes reduce that suppression without erasing the historical scar in one step. Lesion and persistence are explicitly tested.

Current B314 live evidence: 16 verified negative outcomes -> scar 0.6271; 20 corrective outcomes -> scar 0.3947 and recovery 0.5480; restart and migration preserve state; lesion blocks further scar updates and removes scar action contribution.
