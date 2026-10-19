# Neuro-Kurisu — WorkPass 21 implementation report

**Дата:** 2026-10-11  
**Baseline:** WorkPass 20 (`Neuro-Kurisu 35.42.0`)  
**Новая линия:** root `21.0.0-super-final7`, runtime `35.43.0`, schema `223`  
**Release status:** implementation workpass; не release-ready.

## Что реализовано в коде

1. **Новый `ResearchSourceLineage.ts`.** Нормализует URL, исключает измерительные query-параметры, считает identity канонического документа и ищет exact-content/near-duplicate связи. Для approximate match используются 5-token shingles, минимум 48 токенов, минимум 28 shingles и высокий порог overlap; короткие фрагменты не объединяются только из-за общей тематики. Порог — инженерная эвристика, не готовая метрика происхождения.
2. **`ProjectResearchSession` интегрирован с lineage.** Lineage вычисляется при ingestion, хранится вместе с excerpt provenance и пересобирается при restore из ограниченных исходных данных, а не принимается на веру из сохранённой метки. Добавлен `duplicateLineageCount`.
3. **`EvidenceFirewall` учитывает story lineage.** External observations образуют connected components по связям publisher↔lineage. Если два домена перепечатывают одну историю, это одна evidence family и они не удовлетворяют independent-source gate. Идентичность документа и проверка changed-content conflict остаются отдельными понятиями.
4. **Каноническая MemoryOS2 не плодит syndicated copies.** Хранится одна capped-confidence hypothesis note на lineage; до восьми alternate URLs сохраняются в `researchMirrorUrls`. Это сохраняет provenance и уменьшает дубль-записи без повышения epistemic status до fact.
5. **Добавлен Core integration сценарий.** Две перепечатки не проходят corroboration; после третьего независимого story lineage возникает две evidence families и в MemoryOS2 сохраняются две записи, одна со ссылкой на зеркало.
6. **Согласованы релизные metadata** WorkPass 21/runtime 35.43.0, root/runtime audit aliases, `VERSION.json`, список дел, status inventory, roadmap scorecard и актуальный backlog.

## Сколько сделано

- **3 implementation deliverables закрыты** в нормализованном реестре (G66–G67 и lineage-gate workstream; см. список дел), отражены в updated backlog.
- Нормализованный реестр: **67 задач — 48 DONE, 10 PARTIAL, 9 TODO** (добавлены две отдельные подтверждённые deliverables; два остающихся больших направления не переименованы в DONE).
- Детализированный backlog: **180 задач**, включая 3 новых P0 item; broader source genealogy оставлен PARTIAL.
- Точечная проверка: claim evidence **20 cases PASS**; source lineage **8 cases PASS**; project research/Core integration **PASS**; outcome idempotency **5 scenarios PASS**; runtime TypeScript **PASS**.
- Weighted implementation scorecard: **71.10%** против 70.75% в WorkPass 20. Это оценка покрытия roadmap, не качество интеллекта и не release readiness.

## Чего этот проход НЕ утверждает

- Source lineage — осторожная lexical near-duplicate эвристика. Она не восстанавливает всю цепочку пресс-релиз → wire service → редакционная перепечатка и может пропустить перефразированные копии.
- Claim verifier по-прежнему использует explicit claim и exact textual anchors; general entailment, NLI, автоматическое атомарное извлечение claims и calibrated probabilities не реализованы.
- Не доказан прирост MemoryOS2 на независимом temporal holdout.
- Production Vite build, dependency-complete app typecheck, browser/Live2D E2E, live external provider run, clean-room restore/upgrade/rollback, длительный soak и SBOM/provenance sign-off остаются открытыми.

## Приёмка

- `node --experimental-strip-types runtime/neuro-kurisu/tests/research-claim-assessment.mjs` — PASS.
- `node --experimental-strip-types runtime/neuro-kurisu/tests/research-source-lineage.mjs` — PASS (8 cases).
- `node --experimental-strip-types runtime/neuro-kurisu/tests/big-pass-179-project-research-gates.mjs` — PASS, включая новый Core→MemoryOS2 сценарий.
- `node --experimental-strip-types runtime/neuro-kurisu/tests/project-execution-idempotency.mjs` — PASS (5 scenarios).
- `npm --prefix runtime/neuro-kurisu run typecheck` — PASS (`mode=tsc`).
- Root metadata, app-script/browser smoke contracts, memory retrieval benchmark, server import/UI API linkage и asset gates собираются в `npm run audit:workpass21`; результаты финального запуска указаны в упаковочном отчёте.

## Направление следующего прохода

1. Подключить настоящий semantic entailment/NLI provider за явным backend-интерфейсом, с `unknown` при недоступности или неоднозначности; сначала сверить модели и runtime footprint. В качестве open-source кандидатов рассмотрены [Transformers.js zero-shot/NLI pipeline](https://huggingface.co/docs/transformers.js/api/pipelines) и [ONNX DeBERTa small-long-NLI](https://huggingface.co/onnx-community/deberta-small-long-nli); в этом проходе модель не установлена и не выдаётся за рабочую интеграцию.
2. Выделять atomic claims только из явно declarative assertions и сохранять связь claim↔quote; составной/неясный запрос остаётся `unknown`.
3. Измерять false merge/false split source-lineage на размеченном наборе, затем проводить независимый temporal memory holdout.
4. Закрывать UI production build/browser E2E, а не объявлять release готовым до clean-room run.
