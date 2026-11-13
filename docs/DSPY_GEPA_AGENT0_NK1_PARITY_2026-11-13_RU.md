# DSPy GEPA и Agent0: карта ассимиляции в NK1

Дата: 2026-11-13  
Основная ветка исходников: `workpass70-source`  
Рабочая исследовательская ветка: `research/source-assimilation-20261113`  
Назначение: зафиксировать выводы по двум обучающим донорам без копирования сторонних runtime и без дублирования когнитивных владельцев NK1.

## 1. Резюме

**DSPy GEPA — самый перспективный алгоритмический донор для следующего прохода**, но не как Python-framework dependency. Ценность — не в переносе всего DSPy, а в ограниченном поиске нескольких версий skill/instruction candidates на основе reflection feedback, оценки на отдельных примерах, Pareto-frontier и строгого бюджета.

NK1 уже имеет значительную часть требуемых оснований:
- `OutcomeReflectionCurriculum.ts` строит проверяемые гипотезы из ошибок и неожиданностей, ограничивает историю и Pareto-ранжирует *цели обучения*;
- `P23LocalModelSkillRevisionGenerator.ts` генерирует один untrusted candidate на основе верифицированных validation evidence и evidence-backed targets; holdout результаты и направление регрессии запрещены на этапе генерации;
- `P23LearningEngine.ts` содержит bounded payload handling, candidate staging и policy для reflective promotion;
- `VerifiedOutcomeLedger.ts` принимает привязанные к manifest/task/version outcome receipts, отклоняет self-report как авторитетное доказательство, поддерживает paired comparisons по seed и family;
- `VerifiedSkillPromotion.ts` требует полное paired holdout coverage, минимум независимых seed, статистически поддержанный seed-clustered gain и отсутствие недопустимой family regression.

При этом Pareto-слой NK1, который обнаружен в `rankLearningTargets(..., 'pareto-frontier')`, ранжирует **задачи/цели обучения**, а не хранит и не выбирает population из альтернативных версий skill candidate. В просмотренных P23 путях не найден готовый GEPA-подобный candidate-population search с parent lineage, per-task candidate scores и ограниченным бюджетом mutation/evaluation. Это предварительный вывод именно по изученным путям; перед реализацией нужен репозиторный поиск по всем аспектам/веткам, чтобы не дублировать существующую реализацию.

## 2. Что конкретно есть в DSPy GEPA

Исследованные исходники из архива `dspy-main`:
- `dspy/teleprompt/gepa/gepa.py`
- `dspy/teleprompt/gepa/gepa_utils.py`
- `dspy/teleprompt/gepa/instruction_proposal.py`
- `docs/docs/diving-deeper/gepa-in-depth.md`
- `docs/docs/api/optimizers/GEPA/overview.md`

Полезные механизмы:
1. **Reflective mutation:** получает не только aggregate score, но и trace/feedback по конкретным predictors; на основе неудачных trajectory предлагает узкое изменение инструкции.
2. **Per-example Pareto archive:** сохраняет набор кандидатов, которые лучше на разных validation items; следующий кандидат выбирается с учётом complementarity, а не только одного aggregate winner.
3. **Candidate lineage:** у каждого кандидата есть parent indices; можно восстановить происхождение, budget cost и момент открытия кандидата.
4. **Budget accounting:** строго выбирается одна из границ `max_metric_calls`, `max_full_evals` или auto-budget; есть ограничение reflection minibatch.
5. **Failure-focused reflection:** `skip_perfect_score` не тратит mutation budget на уже успешные примеры.
6. **Bounded merge:** успешные варианты разрешается объединять, но каждое объединение имеет стоимость re-evaluation и отдельный лимит.
7. **Reproducibility/observability:** seed, per-instance scores, aggregate scores, discovery evaluation counts, run directory и serialized candidate metadata.

### Ключевой интерфейсный вывод

`DspyGEPAResult` сохраняет:
- `candidates` и `parents`;
- `val_aggregate_scores` и `val_subscores`;
- `per_val_instance_best_candidates`;
- `discovery_eval_counts`;
- multi-objective `val_aggregate_subscores`, objective best candidates и Pareto front;
- `total_metric_calls`, `num_full_val_evals`, seed и best candidate.

GEPA использует внешний Python package `gepa` как optimization engine. Поэтому добавлять его как runtime dependency в TypeScript/Android NK1 сейчас нецелесообразно: это увеличивает поверхность зависимостей, усложняет offline/mobile deployment и создаёт второй цикл управления candidate. Лучше реализовать минимально достаточную NK1-native механику на текущем P23/ledger/store.

## 3. Матрица соответствия NK1

| Механизм GEPA | Аналог в NK1 | Статус | Решение |
|---|---|---|---|
| Failure reflection | `OutcomeReflectionCurriculum.reflectOnOutcomes` | Реализовано концептуально и в коде | Использовать существующие hypotheses; не создавать второй reflection owner |
| Target Pareto ranking | `rankLearningTargets(..., 'pareto-frontier')` | Уже есть | Не переносить алгоритм повторно |
| Generate candidate from feedback | `P23LocalModelSkillRevisionGenerator` | Узкий однокандидатный генератор есть | Расширять через batch proposals только при доказанном gap |
| Candidate parent lineage | `VersionedSkillCandidateStore` / revision provenance | Частичное покрытие; exact GEPA population archive не подтвержден | Изучить candidate store schema; не создавать второй store |
| Per-validation-item candidate archive | `VerifiedOutcomeLedger` хранит verified outcomes по task/method/seed; P23 gates paired metrics | Не эквивалентно полноценному GEPA archive | Главный кандидат на улучшение |
| Multi-objective Pareto candidate selection | Pareto для learning targets и paired comparisons для baseline/candidate | Частичное покрытие | Исследовать ограниченный multi-candidate archive |
| Budget accounting | P23 payload/batch/cardinality limits; audit/deadline surfaces | Частичное | Добавить явный shared metric-call/token/time budget только если его нет в canonical owner |
| Holdout secrecy | Generator запрещает передавать holdout results; promotion отдельно верифицируется | Сильнее обычного prompt-optimizer safeguard | Не ослаблять; mutation не видит holdout scores |
| Independent promotion | `VerifiedSkillPromotion` + authenticated evidence + paired seed/family CI | Есть строгие механизмы | Повторно использовать, не дублировать |
| Candidate merging | В изученных P23 paths нет эквивалента безопасного GEPA merge | Не внедрено | Не добавлять до появления candidate archive; merge повышает риск и требует полной повторной оценки |

## 4. Рекомендуемый NK1-native дизайн следующего прохода

Создать не отдельный optimizer daemon, а bounded subroutine внутри канонического P23 flow:

`Failure/Surprise → Evidence-backed Targets → K Candidate Proposals → Independent Validation → Per-task Score Matrix → Pareto Archive → Candidate Selection → Fresh Holdout Gate → Shadow → Promotion/Rollback`

Минимальная модель:
- candidate ID, source version/hash, parent IDs, prompt/skill payload fingerprint, provider/model identity, RNG seed;
- immutable manifest fingerprint + dataset split fingerprint;
- per-task outcomes и независимые receipt refs только из validation split;
- objective vector: task success, policy/safety compliance, postcondition correctness, latency/resource budget, output stability;
- bounded mutation count, metric-call count, token/byte budget, wall-clock budget, max archive size;
- deterministic dominance and tie-break rules; duplicate candidate fingerprints do not consume another full-evaluation slot;
- failed proposals preserved as bounded rejected evidence, not promoted to active skill.

**Критические правила:**
1. Optimizer видит только train/validation. Никаких holdout numeric scores, deltas, rank order или hints в prompt, trace, cache или model telemetry.
2. Holdout используется ровно существующим independent evaluator после выбора кандидата; на изменение candidate fingerprint — новая holdout оценка.
3. Candidate population не становится отдельным writable skill library. Канонический VersionedSkillCandidateStore остаётся единственным владельцем candidate lifecycle.
4. Никакого автоматического включения network provider; локальный loopback llama.cpp остаётся opt-in и disabled until configured.
5. Ни один model-generated feedback, metric string или self-claim не считается authenticated evidence без текущего P23 verifier/ledger.
6. Promotion использует только текущий `VerifiedSkillPromotion` contract, rollback и evidence receipts.
7. Первым этапом должен быть offline shadow experiment и ablation, не runtime default.

### Проверяемая экспериментальная гипотеза

При одинаковом наборе задач, seed и максимальном количестве metric calls, multi-candidate Pareto search должен улучшить holdout success или снизить regressions/family variance по сравнению с single-candidate P23, не ухудшая policy compliance, stability, latency и ресурсные пределы.

Сравнение: `P23-single-candidate` vs `P23-bounded-pareto-k` на одном frozen manifest; paired outcomes минимум по нескольким независимым seed, complete task coverage, family stratification, confidence/bootstrap; ablation без Pareto, без reflection, без archive и без candidate dedup. Не использовать одну aggregate среднюю метрику как единственное основание.

## 5. Agent0: что стоит извлечь, а что нельзя копировать

Исследованный донорский файл:
`Agent0/curriculum_train/examples/reward_function/curriculum_reward.py`

Полезная идея — **контроль разнообразия и novelty для curriculum generation**, чтобы модель не создавала десятки перефразированных задач одного типа. Но реализация в donor example не является production-ready основой для NK1.

Обнаруженные детали/риски:
- BLEU distance matrix строится попарно, O(n²) по числу вопросов; затем используется AgglomerativeClustering;
- выполнение зависит от четырёх фиксированных localhost endpoints `5000..5003`, ThreadPoolExecutor и временных JSON файлов;
- имена временных файлов содержат timestamp + random и операции удаления файлов требуют безопасного изолированного workspace;
- `compute_score` записывает `test.json` в текущую директорию;
- итоговый `min(score, 1-score)` имеет максимум при score=0.5, а не 1.0; поле `accuracy` в возвращаемом словаре фактически получает cluster penalty, а не accuracy. Это требует проверки всей reward contract, прежде чем доверять score как сигналу обучения.

**Решение:** не импортировать trainer, reward function, server farm или внешние Python packages в NK1 runtime. Вместо этого проверить качество уже имеющегося NK1 semantic/task-family dedup и добавить измеряемый curriculum diversity metric только если ablation выявит дублирование:
- semantic distance / task-family entropy на bounded proposal window;
- near-duplicate clusters с explicit threshold и deterministic seed;
- novelty bonus capped and secondary to task correctness;
- novelty не может компенсировать safety failure, incorrect result или postcondition failure;
- bounded O(n log n) approximate lookup или лимитированный pairwise sample вместо неограниченного O(n²);
- хранить объяснимые evidence IDs/cluster labels, не записывать неподтверждённое новшество в semantic memory.

## 6. План дальнейших проходов по источникам

1. **DSPy / GEPA:** полный поиск всех веток на уже существующий multi-candidate P23 path; parity contract; прототип candidate archive в isolated evaluator; fixed budget and frozen validation; no holdout leakage.
2. **Agent0:** аудит полного reward/evaluation path и проверка reward semantics; использовать только diversity/curriculum insights; никаких vLLM/RL training dependencies в runtime.
3. **Microsoft Agent Framework:** сверить pause/resume, checkpoint integrity, idempotent replay и typed handoff с NK1 planner/FlightRecorder.
4. **OpenAI Agents SDK:** сравнить tracing spans, run/item lifecycle и approval boundaries с ActionGateway/FlightRecorder; не создавать второй orchestration runtime.
5. **Chroma/FAISS:** только одинаковые corpus/embedding/filters benchmarks против существующего memory retrieval; не добавлять вторую writable store или native extension без измеримого device win.
6. **Hexis/Will/Mem0/Letta/Lumina/Hermes:** feature-parity audit по каждому adapter; отсутствие теста в одной функции должно оставаться отдельным gap, даже если другой адаптер из того же источника уже проходит CI.

## 7. Статус и ограничения

- Это исследование алгоритмического соответствия, а не заявка на интеграцию DSPy runtime.
- Для DSPy и Agent0 в этой итерации донорский код в NK1 не копировался.
- Лицензии/зависимости/модельные веса/датасеты нуждаются в отдельной проверке до переноса.
- Результаты исследования не доказывают автономность или субъективное сознание; они формируют конкретный, измеримый механизм улучшения learning pipeline.


## 8. Реализованный P23-compatible GEPA sidecar adapter (2026-11-13)

После аудита исторической ветки добавлен новый `runtime/neuro-kurisu/src/organism/learning/GepaReflectiveCandidateGenerator.ts`. Это не перенос полного DSPy/GEPA optimizer и не Python dependency. Это ограниченный transport/projection adapter, позволяющий подключить внешний экспериментальный candidate proposer через уже существующую P23 composition.

Что восстановлено/переработано из прежней GEPA линии:
- candidate-only response contract;
- bounded HTTP transport, endpoint policy, timeout, secret separation;
- P23 revision generator function adapter;
- diagnostics и явный opt-in;
- sidecar отдаёт untrusted candidate, но не получает право его оценивать/активировать.

Что изменено для текущего NK1:
- убран старый aggregate holdout `gap01` request field;
- planner не копирует `fitness.reasons/feedback` в генератор;
- sidecar получает validation-only reports, fixed dimension directives и validation-bound task/trial IDs;
- response score/fitness/pass/fail/promotion claims полностью игнорируются;
- candidate обязан сохранить все верхнеуровневые поля исходного skill payload;
- GEPA включается только при `NK1_GEPA_ENABLED=1`, valid HTTPS/loopback endpoint, API key и уже настроенном trusted P23 compound-repair provider;
- выключенное состояние не меняет локальный llama.cpp path; включённый sidecar не маскирует ошибки незаметным fallback.

**Проверено:** GitHub Actions run `43417587842`, exact code commit `e2fa5545aaac365123dfb65a05e8e66980500bf8`, SUCCESS. В том же run: `SOURCE_ASSIMILATION_AUDIT=PASS`, adapters `7/7`, static checks `33/33`, source audit unit tests `10/10`, P23 local model provider/generator/integration, holdout isolation, GEPA sidecar, Hexis/Letta/Lumina/Will/Mem0 contracts all PASS.

### Updated status by dimension

| Dimension | Status |
|---|---|
| Reflection hypotheses from outcome failures | Existing P23 implementation |
| Pareto ranking of learning targets | Existing P23 implementation |
| One-candidate local reflective revision | Existing P23 implementation |
| GEPA validation-only sidecar transport | Implemented and contract-tested |
| Server composition and local fallback | Wired behind explicit opt-in |
| P23 independent evaluator / authenticated promotion | Existing canonical owner; unchanged |
| Multi-candidate population and per-example Pareto archive | Not implemented yet |
| Actual deployed GEPA service | Not configured/deployed |
| Paired-seed ablation and independent uplift evidence | Not run |
| Target-device memory/latency/soak | Not run |
| Release ZIP inclusion | Not verified |

This is the safe integration seam, not the completed evolutionary optimizer. The next algorithmic feature should be a bounded candidate-population archive owned by P23, not a second skill library or a second promotion system. Its objective vector should remain validation-only until the existing independent holdout evaluator is invoked after selection.

## 9. Updated next-pass plan

1. Search all active/archived branches and the latest P23 store for existing candidate population metadata before creating any archive.
2. Propose the minimum data model: candidate fingerprint, parent IDs, generator/model identity, mutation budget, per-validation-task scores and objective vectors; keep records immutable and bounded.
3. Connect the archive to the existing VersionedSkillCandidateStore or a non-authoritative proposal cache; never create a second writable skill owner.
4. Deduplicate candidates by canonical payload fingerprint before expensive evaluation.
5. Use deterministic Pareto dominance with explicit objectives: verified validation success, policy compliance, postcondition correctness, latency/resource cost and stability.
6. Limit archive size, candidate count, calls, tokens, wall time and concurrency; log each evaluation receipt.
7. Select one candidate from validation-only archive; send that exact payload through existing independent holdout evaluation, then signed shadow and P23 promotion/rollback.
8. Run fixed-manifest paired-seed experiment and ablation against single-candidate P23; do not default-enable until a reproducible benefit appears without safety/generalization regressions.
