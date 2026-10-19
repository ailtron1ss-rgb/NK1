# WorkPass 27 — MemoryOS2 retrieval candidate coverage and BM25 baseline

**Дата:** 13 октября 2026 г.  
**База:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS26_2026-10-13.zip`  
**Версия:** root `27.0.0-super-final14` · runtime `35.50.0` · schema `224`  
**Статус:** implementation workpass; НЕ release-ready.

## Выбранная ветка

Продолжена одна ветка Memory 2.0: `MemoryOS2 → MemoryFabric → OrganismCore → temporal inspector`. Второй владелец памяти не добавлялся. Этот pass закрывает реальный retrieval defect и улучшает измерение качества, но не обещает, что алгоритм уже превосходит baseline.

## Изменения в коде

1. **Полный posting coverage внутри bounded corpus.** Удалён неявный предел 96 IDs на токен. Он отбрасывал совпадения по порядку `Set`/архива ещё до ранжирования. Корпус остаётся ограничен 1600 записями, на запрос попадает не более 192 кандидатов.
2. **Детерминированный выбор кандидатов.** Приоритет сочетает суммарную IDF-поддержку, число совпавших токенов, exact phrase, temporal validity, номер ревизии, время последнего доступа, salience и стабильный ID. Это улучшает корректность candidate gate, не убирая bounded runtime.
3. **Убрана семантическая награда без сходства.** Ранее cosine был преобразован через `(cosine + 1) / 2`, поэтому ортогональные/несвязанные hashed vectors получали 0.5. Теперь положительный score отражает положительный cosine; нулевые/отрицательные пары дают 0.
4. **Настоящий baseline вместо token overlap.** Benchmark теперь вычисляет corpus-scoped Okapi BM25 с `k1=1.2`, `b=0.75`, TF, document frequency и средней длиной документа. Исключаются записи, недействительные на фиксированный `now`, dormant и quarantined. Отчёт пишет полную конфигурацию, состав корпуса и SHA-256 её fingerprint. Seed-sensitivity signature привязана к тому же fingerprint.
5. **Никакого автоматического promotion.** Benchmark остаётся non-promoting; качество сравнивается по одному фиксированному corpus/label set, а правила confidence-aware promotion сохраняются.

## Результаты

- `npm run typecheck` — PASS.
- `npm run test:memory-temporal-inspector-closure` — PASS.
- `npm run test:memory-retrieval-candidate-coverage` — PASS: запись за бывшим posting cutoff остаётся кандидатом, перестановка snapshot не меняет top-k.
- `npm run test:r16:memory` — PASS.
- `npm run test:memory-retrieval-benchmark` — PASS, baseline идентифицируется как Okapi BM25.
- `npm run test:memory-retrieval-experiment` — PASS; fingerprint baseline неизменен между seeds, live snapshot не меняется.
- `node --experimental-strip-types tests/server-smoke.mjs` — PASS в этом проходе.

### Негативный результат, который нельзя скрывать

Текущий 8-query synthetic holdout показывает Recall@5 delta MemoryOS2 против BM25 **-0.25**; paired-bootstrap interval `[-0.75, 0.25]`. Выборка маленькая и синтетическая, поэтому это не оценка продакшена. Но она показывает, что нельзя объявлять hybrid retrieval лучше baseline: promotion остаётся `not-promoted`, а направление следующей работы — улучшить candidate/final ranking, используя только train split, затем измерить на отдельно замороженном temporal holdout.

## Что осталось открытым

- Независимый, размеченный temporal holdout из длинных разговоров с фактами, изменениями во времени, противоречиями и случаями insufficient evidence.
- Сравнение MemoryOS2 и BM25 на этом holdout по Recall@k, MRR, latency и ложному recall, с confidence intervals и no-leakage policy.
- React/Vite production build, browser/Live2D E2E, clean-room recovery/rollback, soak, SBOM/provenance и release sign-off.

**Инвентарь:** 78 нормализованных deliverables; 57 DONE, 11 PARTIAL, 10 TODO. Новая закрытая normalized задача не заявляется: усовершенствованы существующие G10/G14 и benchmark доказательство. Weighted implementation roadmap — 72.30%, не release readiness.
