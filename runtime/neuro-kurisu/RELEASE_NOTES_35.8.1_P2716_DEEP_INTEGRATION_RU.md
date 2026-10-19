# Neuro/Kurisu 35.8.1 — P2716 Deep Integration / Mobile Continuity

## Крупный проход

Этот релиз является продолжением P2716, но выделен в 35.8.1 потому, что в нём исправлены две реальные runtime/persistence проблемы, а не только добавлен исследовательский код.

### Добавлено

- реальный micro-neural path для temporal-resolution ticks;
- recurrent neural step на каждом micro tick;
- delayed credit через существующие fast/mid/slow traces;
- P2716 phase/protection/plasticity controller в micro-path;
- durable migration для `neuralExperienceBranch`;
- restart validation с сохранёнными neural outcomes;
- promotion gate, который требует внешней matched-control validation.

### Проверено

`npm run typecheck` — PASS.

`P2716_DEEP_INTEGRATION` — PASS.

`P2716_CONTINUAL_BATTERY` — PASS, но без заявления о superiority по task-A forgetting.

`P2716_MOBILE_SOAK_RESTART` — PASS: 320 cycles, restart сохранённого branch подтверждён.

`P2708_LONG_HORIZON_CLOSURE` — PASS.

P2702/P2703/P2705/P2706/P2707/P22/restart regressions — PASS при отдельных прогонах.

## Ограничения

Этот релиз не доказывает сознание, биологическую эквивалентность или общую способность к автономному организму. Он доказывает только наличие и runtime-интеграцию конкретных механизмов в кодовой базе и прохождение указанных инженерных тестов.

## Финальные release-gates 2026-09-20

- `TYPECHECK=PASS`
- `RELEASE_CONTRACT=PASS`
- `SOURCE_TRUTH=PASS`
- `CLEAN_ARCHITECTURE=PASS` — sourceFiles=1576, canonicalFiles=507, missing=0, cycles=0, legacyLeakage=0
- `CLEAN_INTEGRITY=PASS` — files=3495, schema=200
- `SOURCE_HYGIENE` — errors=0, warnings=0
- `SYNTAX_JSON=PASS` — js=1091, sh=6, json=240
- `FORENSICS=PASS` — empty=0, duplicateContent=0, duplicateNames=0
- `SOURCE_TRUTH=PASS`
- `API_ROUTES=110`, duplicates=0

### Последние экспериментальные результаты

`P2716_DEEP_INTEGRATION=PASS` — 144 outcomes; trajectories diverged from control.

`P2716_CONTINUAL_BATTERY=PASS` — task-A forgetting `0.0540` vs control `0.0510`; task-B forgetting `0.0000` vs `0.0046`. Это не является доказательством общего anti-forgetting superiority.

`P2716_MOBILE_SOAK_RESTART=PASS` — restart persistence подтверждено (`persisted=1`), после restart сохранён neural branch (`deepOutcomes=246`).

`P2708_LONG_HORIZON_CLOSURE=PASS` — 250 operational cycles, warmed median ratio `0.846`; heap growth около `3.92x` в этой конкретной проверке, поэтому память остаётся отдельным mobile bottleneck.

`P2716_PROMOTION_GATE=PASS` — внутренние метрики не могут самостоятельно переводить механизм в promoted status; внешний validation остаётся обязательным.
