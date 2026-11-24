# Neuro-Kurisu 34.81.0 — BIG PASS 107

## Тема
Cognitive Research Battery: воспроизводимые longitudinal-эксперименты, preregistration, uncertainty и claim gating.

## Добавлено

- `CognitiveResearchBattery` с bounded persistent state;
- immutable-by-id protocol registration и preregistration hash;
- reproducibility capsule: release, state schema, seed, evaluator version;
- controlled delays, contexts, matched replay-on/off trials;
- independent verification + holdout gate;
- negative-control condition/phase;
- deterministic bootstrap 95% CI;
- data-quality score;
- claim ladder `insufficient → exploratory → confirmatory-eligible → replicated/contradicted`;
- duplicate/outcome-provenance protection;
- Core APIs и persistence restore;
- state schema 115→116;
- tests и audit tooling.

## Важная граница
Тестовая synthetic data используется только для проверки программной механики. Она не считается реальным эмпирическим доказательством способности Neuro-Kurisu или сознания.

## Проверено
Typecheck, Pass 103–107 regressions, migration, research-battery audit, release/source/architecture/integrity/hygiene/forensics/syntax/server checks, mobile 1000, operational 500 и operational 1000 — PASS.
