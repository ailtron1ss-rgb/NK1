# Neuro-Kurisu 35.30.0 — R16 Final Report

Дата: 2026-09-26

## Статус

**R16 ЗАВЕРШЁН как кодовый release.** Базой был фактически сохранённый R15, после чего незавершённые изменения из continuation-прохода были восстановлены непосредственно в исходном дереве, исправлены, протестированы и включены в release 35.30.0.

## Реальные изменения

1. **Temporal memory / retrieval**
   - сохранена R15 revision lineage;
   - retrieval refreshes temperature только для кандидатов, а не для всех 1600 resident memories;
   - bounded revision-group recall сохранён;
   - R15 temporal/contradiction/retrieval regression PASS.

2. **Long-horizon autonomy**
   - prediction-error сравнивается с предыдущей ошибкой до обновления состояния;
   - существенный рост prediction error вызывает реальную revision;
   - commitment снижается;
   - активный шаг может быть переставлен на pending fallback, а не просто увеличивается счётчик revisions.

3. **Continuous cognitive continuity**
   - duplicate event IDs отклоняются;
   - out-of-order ticks/timestamps отклоняются;
   - accepted event IDs сохраняются в bounded recent window;
   - независимый continuity test PASS.

4. **Persistence / durability**
   - исправлена off-by-one логика full projection в checkpoint path;
   - B319: 5 crash injection points + corruption recovery PASS;
   - B320: adaptive durability PASS: window 8, low-battery 4, resource-pressure 12;
   - bounded closure проверяется относительно фактического adaptive window.

5. **Memory knockout validity**
   - B165 test fixture исправлен: content-addressed IDs стабильны между экземплярами, поэтому knockout применяется к B напрямую и проверяется отсутствие утечки удаления в A;
   - downstream policy divergence = `0.016936...`, то есть memory knockout реально меняет downstream decision utilities.

6. **Release/source truth**
   - package/version/lock/VERSION/ReleaseContract/manifests синхронизированы;
   - текущая документация обновлена с R15 на R16;
   - исторические отчёты не переписывались.

## Проверки

- TypeScript typecheck: **PASS**
- R15 temporal memory regression: **PASS**
- R16 memory behavior: **PASS**
- R16 autonomy continuity: **PASS**
- R16 continuous fabric: **PASS**
- R16 core closure: **PASS**
- B165 memory knockout: **PASS**
- B319 crash recovery: **PASS**
- B320 mobile durability: **PASS**
- R14 memory audit: **PASS, 19/19**
- R15 memory audit: **PASS**
- Core ownership: **PASS, errors=0, directConstructors=5**
- Architecture: **PASS, sourceFiles=1704, canonicalFiles=541, missing=0, cycles=0, legacyLeakage=0**
- Full project audit: **PASS, errors=0, warnings=0**
- Hygiene: **PASS, warnings=0**
- Forensics: **PASS, duplicateContent=0, duplicateNames=0, staleMarkers=0**
- Syntax: **PASS, JS=1185, SH=6, JSON=240**
- Integrity: **PASS, schema=219**
- Release contract: **PASS**
- Release source truth: **PASS**
- Archive manifest: **PASS, 3982 files, missing=0, hashMismatches=0, extra=0**

### Mobile measurements

256-MB runtime benchmark:
- 30 cycles
- elapsed: **13.446 s**
- p50: **434.73 ms**
- p95: **526.16 ms**
- max cycle: **765.10 ms**
- max V8 heap: **127.65 MB**
- max RSS: **292.54 MB**

Mobile soak:
- 30 cycles
- 14.62 s
- peak RSS: 317.2 MB
- PASS

R15 had p95 roughly 676–773 ms on its final runs; the new benchmark is therefore materially better on this measurement, while runtime variance remains possible.

## Semantic evidence

Current semantic coverage audit reports:
- total functions: **5318**
- VERIFIED: **34**
- INTEGRATION_ONLY: **9**
- UNSAFE_TO_AUTO_RUN: **317**
- UNVERIFIED: **4958**
- verified rate: **0.64%**

This is intentionally not inflated. The project still has a major evidence gap between architectural breadth and independently verified behavioral semantics.

## Current assessment

- Core architecture: **87/100**
- Memory substrate: **88/100**
- Persistence/continuity: **90/100**
- Continual learning: **64/100**
- World model: **60/100**
- Neural substrate: **50/100**
- Autonomy: **67/100**
- Self/identity: **67/100**
- Behavioral evidence: **22/100**
- Engineering maturity: **~64/100**
- Readiness for the target autonomous artificial-personality organism: **~48/100**

These are engineering-progress estimates, not claims of consciousness or personhood.

## Important aggregate-test note

The aggregate `npm run test:r16` reached its outer 10-minute runner limit while executing the final B165 component after all earlier components had already passed. B165 was then executed independently and passed. Therefore this release does **not** label the timed-out aggregate command as PASS; every release-critical component has its own recorded successful run.
