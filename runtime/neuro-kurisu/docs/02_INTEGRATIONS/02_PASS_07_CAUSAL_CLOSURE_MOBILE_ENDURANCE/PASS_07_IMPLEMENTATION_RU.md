# Neuro-Kurisu — PASS 07: Causal Closure + Mobile Retention + Endurance

Дата: 2026-09-26

## Цель прохода

Укрепить причинную замкнутость между B294/CausalLifeGraph и runtime, закрыть долгоживущие state-growth пути, снизить стоимость mobile persistence и дать воспроизводимый mobile-profile gate.

## Реальные изменения

### 1. B294 duplicate-closure guard

`B294CausalNeuralEventSpine.closeOutcome()` теперь идемпотентен для уже закрытого episode.

В нормальном `OrganismCore` world/non-world branches остаются взаимоисключающими; guard защищает от будущего повторного вызова и не меняет правильный single-close путь.

### 2. CausalLifeGraph hot path

- добавлены O(1) индексы `nodeById` и `edgeByKey`;
- `recordCycle()` больше не пересчитывает graph metrics для каждого edge;
- передача одного опыта в feedback объединена в один полный recordCycle после появления learning/self-change данных;
- experience lineage feedback теперь переиспользует `obs:${tick+1}`, созданный observation-фазой;
- B294 episode ID записывается в causal-life nodes.

### 3. World-model long-horizon bounds

`WorldModel2` получил жёсткие bounded limits:

- `memoryEvidence <= 128`;
- `causalHypotheses <= 512`;
- `transitionHypotheses <= 2048`;
- существующие pending/prediction bounds сохраняются.

### 4. Mobile bounded retention

Снижены live-retention bounds для длинных non-canonical историй:

- CognitiveDomainClosure — 16 recent records в runtime owner;
- P40 semantic claims — 256, situations — 64, hypotheses — 128;
- embodied transition log — 64;
- NeuralExperienceBranch replay buffer — 192.

Это не ограничивает canonical neural parameter matrices и не удаляет persisted identity/value owners.

### 5. B301 persistence economy

B301 расширен под новые bounded branches и теперь измеряет только реально компактизируемые ветви вместо сериализации всего `persisted` дважды на каждом compaction pass.

Добавлены scoped limits для:

- cognitive closure;
- P40 claims/situations/hypotheses;
- embodied transitions;
- neural replay.

`lastBytesBefore/lastBytesAfter` теперь являются размером компактизируемых ветвей, а не полной копией организма. Это сделано намеренно, чтобы диагностика сама не создавала большой memory spike.

### 6. Termux mobile V8 profile

`scripts/termux/start.sh` и `scripts/termux/supervisor.sh` получили безопасный default:

`--max-old-space-size=192`

Значение можно переопределить через `NEURO_NODE_MAX_OLD_SPACE_MB` или существующий `NODE_OPTIONS`.

Это не меняет cognitive semantics; это runtime memory envelope для medium-phone профиля.

## Executable evidence

- `P2865_CAUSAL_EVENT_CLOSURE=PASS`
- `P2866_WORLD_MODEL_STATE_GROWTH=PASS`
- `P2867_MOBILE_RETENTION=PASS`
- `P2864_RUNTIME_PERFORMANCE=PASS`
- `P2863_ADAPTIVE_REPLAY_EMBODIED_MULTISTEP=PASS`
- `P2868_MOBILE_DECISION_EQUIVALENCE=PASS`
- `R7 performance guards=PASS`
- B301 migration=PASS
- typecheck=PASS

Mobile profile evidence with `NODE_OPTIONS=--max-old-space-size=192`:

`peakHeap ≈ 118.8 MB`

`peakRSS ≈ 340.0 MB`

`post-GC heap ≈ 76.4 MB`

Retention bounds in the same gate:

`closure=16, claims=256, embodied=24, replay=24`.

`p2863` under the 192 MB V8 profile still passes the functional gate. Expensive multi-step runtime replay may be suppressed by the resource governor in the constrained profile; direct multi-step generation remains covered independently.

## Important limitation

Peak RSS is still too high to call this physical Android-device validation. The measured result is host-side V8 evidence plus a constrained memory profile, not proof on a real medium phone. P2868 additionally checks that the constrained V8 profile preserves the action sequence, logical tick and learning-update count; small continuous replay/grounding differences remain bounded below 0.001 and are treated as runtime-resource effects rather than semantic replacement.

The full `OrganismRuntime` 100/500/1000-cycle endurance gate remains open. Compact subsystem endurance (1000 cycles) passes; a full runtime run is still too expensive for the current execution budget.

## Claim boundary

Этот проход не доказывает сознание, субъективный опыт, human-level intelligence или биологическую эквивалентность. Он усиливает причинно-последовательную инженерную основу, мобильную ресурсную экономику, persistence и evidence coverage.
