# Release Notes B292

## B292 — Cognitive State Bus + Evidence-linked Intention Trace

B292 объединяет executive/developmental подсистемы без добавления нового независимого «владельца личности».

### Изменения
- добавлен bounded Cognitive State Bus;
- добавлен Evidence-linked Intention Trace;
- B291 получает continuity/commitment/recent-failure signals;
- persistence/recovery для B292;
- standalone и core integration tests;
- reality-closure sampler;
- устранены duplicate-content evidence files;
- forensic/full audit policy расширена для generated evidence JSON.

### Проверка
- TYPECHECK=PASS
- B292 standalone=PASS
- B292 core=PASS
- B291 regression=PASS
- B290 core=PASS
- organism smoke=PASS
- restart persistence=PASS
- concurrency=PASS
- UI smoke=PASS
- server smoke=PASS
- architecture=PASS
- integrity=PASS
- forensics=PASS
- hygiene=PASS
- contract=PASS
- release source=PASS
- audit full=PASS
- mobile 250-cycle focused profile=PASS (p95 128.29 ms)
- mobile 600/900-cycle profiling completed; 1000-cycle host gate remains unresolved and is not claimed as PASS
- operational 250=PASS

### Function Reality
3,573 функций: 38 VERIFIED, 818 INTEGRATION_ONLY, 259 UNSAFE_TO_AUTO_RUN, 2,458 UNVERIFIED. B292 не переводит функции в VERIFIED без direct/lifecycle behavioral evidence.

### Final recheck after hot-loop optimization

The test scripts now use `node --experimental-strip-types` for TypeScript tests. The B292 Cognitive State Bus returns its internal bounded state for hot-loop reuse; the Intent Trace uses in-place deque maintenance; B290/B291 metrics are cached once per cycle. These changes preserve the standalone/core behavioral tests and remove avoidable allocation overhead. The long 1000-cycle mobile gate remains intentionally unresolved rather than being weakened.
