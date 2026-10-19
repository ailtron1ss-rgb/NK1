# Нейро Курису — текущий статус WorkPass 25

**Дата:** 11 октября 2026 г.  
**Корень:** `25.0.0-super-final12` · **Runtime:** `35.48.0` · **Schema:** `224`  
**Статус:** implementation workpass — **не готов к выпуску**.

## Сколько сделано

- **77 уникальных deliverables:** 56 DONE, 11 PARTIAL, 10 TODO.
- WorkPass25 закрыл **2 новых deliverables** (G76–G77): version-bound calibration artifact и воспроизводимый private-first fitter.
- Runtime NLI: 23 semantic integration cases, 12 service tests, 4 evaluator tests, 5 calibration fitter tests; runtime `tsc` проходит.
- Корневой `audit:workpass25` после создания этих документов проверяет release contracts, runtime, MemoryOS2 benchmark, server imports, UI/API linkage и assets.

## Что сделано в WorkPass 25

1. Добавлен `tools/fit_research_nli_calibration.py`: deterministic temperature scaling, minimum 50 reviewed examples per class, deterministic group-disjoint train/validation split, explicit dataset provenance, SHA-256, before/after NLL and calibration metrics, no raw text in output, private atomic no-overwrite file publication, `promoted=false`.
2. NLI server applies calibration only by explicit configuration and only for an artifact matching the pinned model ID/revision, exact labels, dataset integrity/provenance, sample counts and fit-review criteria.
3. Calibration identity and dataset provenance now flow into semantic claims/quotes/atoms and remain checked on restore. Inconsistent metadata, revision drift or quote/aggregate mismatch is rejected rather than silently reused.
4. Added documentation and package scripts for the fitter and its contract tests.

## Проверки и границы

- `npm --prefix runtime/neuro-kurisu run audit:workpass25`: PASS, including TypeScript compiler, claim evidence, source lineage, semantic NLI, service, evaluator, calibration, idempotency and research/Core/recovery scenarios.
- Actual pretrained model weights/inference **not executed** in this environment: model/package registry DNS remains unavailable. Fitter tests use a loopback mock; no real calibration quality is claimed.
- UI production build and browser E2E remain open because Vite/dependencies are not installed in this environment.
- MemoryOS2 candidate remains **not-promoted** because its confidence interval allows regression and an independent temporal holdout remains open.
- Release durability, external provider receipt flows, clean-room restore/rollback, soak, SBOM/provenance and final sign-off remain open.

## Новые пункты

| ID | Статус | Изменение |
|---|---|---|
| G76 | DONE | Версионно-привязанный артефакт калибровки и provenance через восстановление |
| G77 | DONE | Воспроизводимый локальный fitter температурной калибровки без автоматического продвижения |

**Взвешенная оценка roadmap:** 72.00% (рост на 0.15 п.п. относительно WorkPass24). Это оценка плана, не качество интеллекта и не готовность релиза.
