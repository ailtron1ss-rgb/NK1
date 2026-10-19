# NeuroCore V87 — BIG PASS REPORT

Дата: 2026-09-24
Статус: CURRENT FRONTIER / RESEARCH-QUALIFIED, utility-gated

## Цель

Сделать replay model-aware без второго full-backward на каждом replay: конкретный старый переход должен оцениваться текущей моделью, а затем utility должна влиять на выбор внутри уже защищённых информационных strata V86.

## Реальные изменения

1. Добавлен bounded detached utility probe.
   - один batched forward на ограниченном candidate set;
   - фактическая текущая replay error по latent prediction;
   - target novelty относительно текущей цели;
   - gradient-free disagreement с текущим prediction;
   - underuse pressure.
2. Добавлен EMA utility по replay slot.
3. Utility теперь выбирает samples внутри `(input_signature, target_signature)` strata, заданных V86 selector. Это сохраняет структуру покрытия и даёт model-aware выбор внутри comparable groups.
4. Добавлен bounded safety floor: допускается только небольшой ограниченный trade-off information-quality ради текущей utility.
5. Добавлен global probe cadence в trainer: probe не запускается постоянно из-за отдельного "просроченного" slot.
6. Исправлен double-count use_count bug: V87 теперь увеличивает reuse ровно один раз после окончательного выбора.
7. Добавлены checkpoint поля utility mean / probe events / fallback events / last probe step.
8. Trainable parameters не добавлены.

## Verification

- Current V82–V87 suite: **38/38 PASS** при `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1`.
- `compileall`: **PASS**.
- `import neurocore`: **PASS**.
- `CURRENT_FRONTIER = 87`: **PASS**.
- Total parameters: **366,909**.
- Active parameters: **159,342 (43.43%)**.
- `neural_memory_v61 is neural_memory_v83`: **True**.

## Causal utility test

На намеренно сконструированном buffer с одинаковым priority и одинаковой replay-структурой два класса samples отличаются только текущей ошибкой модели.

- easy samples error mean: **~0.00100**
- hard samples error mean: **~1.21991**
- legacy selector: `[0, 3, 6, 7, 9, 11]`
- V87 utility selector: `[1, 3, 5, 7, 9, 11]`
- selection changed: **True**
- safety fallback: **0**

Это прямое evidence, что utility не является мёртвой telemetry: при контролируемом вмешательстве текущая ошибка модели причинно меняет replay выбор.

## 3-seed matched utility smoke

Одинаковый short stream, V86 vs V87, 3 seeds.

### Средние значения

- loss reduction proxy V86: **0.36461**
- loss reduction proxy V87: **0.46971**
- относительное отличие: около **+28.8%**, но effect сильно seed-dependent и benchmark короткий; superiority не заявляется.
- wall time V86: **1.390 s**
- wall time V87: **1.588 s**
- overhead: около **+14.3%**
- utility probes: **6 / run** в среднем
- utility selection changes: **~7 / run**
- safety fallback: **0** после stratum-preserving design.

Per-seed result:
- seed 0: V86 loss delta **-0.39872**, V87 **-0.23494**; V87 здесь хуже.
- seed 1: V86 **+0.97481**, V87 **+1.02501**; V87 лучше.
- seed 2: V86 **+0.51774**, V87 **+0.61906**; V87 лучше.

Следовательно mean улучшение driven не всеми seeds одинаково. Это qualification signal, а не окончательное доказательство superiority.

## Stress benchmark status

Длинный A→B→C→A→B→C benchmark с увеличенным числом updates превысил runtime limit среды и **не считается результатом**. Более короткая версия не создаёт достаточного forgetting, поэтому её также нельзя использовать для claims о catastrophic forgetting.

## Scientific classification

### PROVEN
- detached current-model replay utility действительно считается;
- utility хранится per-slot и сохраняется в state;
- utility реально способна менять выбор replay sample;
- выбор остаётся внутри bounded information-safe strata;
- probe cadence ограничен и не запускается на каждом шаге автоматически;
- полный текущий trunk не получил новых trainable parameters;
- checkpoint roundtrip и current test suite проходят.

### NOT PROVEN
- снижение catastrophic forgetting на длинном реальном CL benchmark;
- универсальная superiority V87 над V86/fixed replay;
- optimality utility weights;
- usefulness on large multimodal streams;
- mobile performance на Poco F6.

## Anti-illusion decision

V87 остаётся current frontier, потому что теперь имеется causal evidence, что model-aware utility реально влияет на replay selection, а вычислительный overhead ограничен примерно +14% на short matched smoke. Но это не объявляется доказанным overall continual-learning improvement.

## Следующий bottleneck: V88

1. Compute-aware utility cache: не probe всех candidate slots, а только changed/stale subset.
2. Utility persistence with priority modulation, но без разрушения V86 diversity floor.
3. Stronger CL protocol с 3–5 seeds и более длинными phases.
4. Replay-only lesion/recovery + semantic recombination test.
5. Затем compute-matched recurrent backbone tournament V80 GRU vs V82 selective-delta.
