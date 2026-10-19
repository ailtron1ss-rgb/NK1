# NEURO-KURISU — BIG PASS 88 FINAL REPORT

Release: **34.61.0** · schema **111**

## Scope
BIG PASS 88 углубляет длинную developmental loop без создания нового Pxx/source-of-truth. Основные изменения:

1. Value attribution теперь выводится из фактических `action + goal context + source`, а не только из `project.origin`.
2. Value learning использует expectation-relative signal `success - predictedUtility`, а не жёсткий порог успеха.
3. Outcome attribution сохраняет value-specific provenance через event `value-attribution`.
4. P67 получил bounded `recalibrateActiveGoals`, чтобы доказанное изменение values могло менять priority/urgency уже существующих активных целей.
5. Тест BIG PASS 88 проверяет два разных developmental histories на одинаковом будущем контексте.
6. Source-truth/release pointers проверены и синхронизированы после baseline gate.

## Evidence
- `BIG_PASS_88_ATTRIBUTION=PASS`: verify→truth, explore→curiosity, respond→social; expectation-relative revision emitted after corroboration.
- `BIG_PASS_88_LONG_HORIZON=PASS`: одинаковый future context при разных curiosity/autonomy histories дал различие priority у одной goal family; обе истории сохранили authored self-change.
- `BIG_PASS_87_LONG_HORIZON=PASS`: 2/5 action families remain divergent under matched value histories.

## Not claimed
Не утверждается consciousness, phenomenology, qualia, personhood или human-equivalent self-awareness.

## Legacy
INTEGRATE: canonical Live2D assets.
ADAPT: voice/diagnostics/interaction mechanisms.
REFERENCE: historical UI/research/cognition.
EXCLUDE-RUNTIME: legacy organism/memory/world/cognition runtimes.

## Qualification
Typecheck/source-truth/architecture/ownership/forensics/hygiene/integrity/release contract: PASS.
Critical developmental/self-change/identity/persistence/runtime suites: PASS.
Mobile 1k/2k: PASS.
Mobile 5k: qualification depends on full process completion; any unfinished run remains UNRESOLVED.
Mobile 10k: UNRESOLVED.
