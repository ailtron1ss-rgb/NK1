# BIG PASS 162 — Unified Cognitive Economy / Cognitive Loop

## Цель
Не добавлять ещё набор независимых модулей, а связать реальный runtime через три общих принципа:

1. **Unified Cognitive Cycle** — проверяем, что operational cycle содержит причинно связанные стадии observation → prediction → action → outcome → learning → self-update.
2. **Cognitive Resource Economy** — текущие энергия, нагрузка, неопределённость, prediction debt, thermal/RAM pressure реально формируют вычислительный envelope. На мобильном профиле это ограничивает дорогие counterfactual rollouts и language stage.
3. **Reality Evidence Ledger** — simulator/device/derived evidence хранятся раздельно, чтобы внутренняя симуляция не могла автоматически считаться внешним подтверждением.

## Реализация
- Добавлены `src/organism/system/UnifiedCognitiveCycle.ts`.
- Добавлены `src/organism/system/CognitiveResourceEconomy.ts`.
- Добавлены `src/organism/system/RealityEvidenceLedger.ts`.
- Состояния всех трёх подсистем включены в persistent organism system-state и миграцию.
- `OrganismRuntime` теперь восстанавливает их после restart.
- Каждый runtime cycle формирует ресурсную allocation record.
- Budget реально ограничивает число counterfactual branches.
- Runtime cycle получает Unified Cognitive Cycle verification.
- Evidence ledger записывает device observation, simulator outcome и derived cycle evidence.

## Проверка
`npm run test:big-pass-162` — обязательный behavioural test. Тест также создаёт behavioural evidence для методов новых систем, после чего `audit-semantic-coverage` пересчитывает их статус.

Тест проверяет:
- полный causal cycle;
- отсутствие dangling lineage;
- scarcity реагирует на ухудшение ресурсов;
- дорогие операции ограничиваются при scarcity;
- persistence/restore новой resource state;
- разделение device/simulator/derived evidence;
- persistence/restore evidence ledger.

## Итоговые quality gates этого прохода

Подтверждено непосредственно в контейнере:
- `TYPECHECK=PASS`.
- `BIG PASS 162 behavioural test=PASS`.
- Runtime integration + restart `PASS`: tick=1, complete cycle=1, stage coverage=1.0, causal continuity=1.0, evidence total=3, simulator=1, external/device=1.
- `BIG PASS 161 cognitive event fabric=PASS`: 24 buffered events, 36 parent links, 0 dangling, lineage=1.0, cycle coverage=1.0.
- `BIG PASS 161 function sweep=PASS`: 25 candidates, 9 direct passes, 16 intentionally skipped.
- P26 true learning `PASS`, P24 world/identity `PASS`, P28 plasticity `PASS`, P29 governance `PASS`, BIG PASS 127–163 core `PASS`.
- Architecture `PASS`, integrity `PASS`, forensics `PASS`, source hygiene `PASS`, release-source `PASS`.

### Важно
Полный старый regression chain не объявляется полностью PASS, если её выполнение упирается в общий временной лимит. Такие участки остаются незавершёнными доказательствами.
