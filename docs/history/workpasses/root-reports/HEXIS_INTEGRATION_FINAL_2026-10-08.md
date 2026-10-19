# Neuro-Kurisu SUPER × WILL × Lumina × Hexis — final integration pass

Дата: 2026-10-08

## Цель

Встроить полезные механизмы `Hexis-main` в уже существующий canonical Neuro-Kurisu runtime, не создавая второго владельца памяти, личности, cognition или tool registry. WILL и Lumina остаются предыдущими адаптерными слоями.

## Реально интегрировано

1. Evidence-based belief revision с независимостью источников и audit history.
2. Point-in-time temporal memory assertions и temporal diff.
3. Learning Review с approve/correct/forget.
4. Retention proposal + explicit confirmation + fidelity receipt; destructive forget идёт через canonical MemoryOS.
5. HMX 1.7 export/staging/accept/reject с protected-section policy. Принятый `port` ограниченно импортирует безопасные memory records в canonical MemoryOS с provenance.
6. Transactional outbox с idempotency, claim/ack/reclaim.
7. Connector policy: context, target allow/deny, explicit approval, autonomous-mode gate, rate window и expiry.
8. Execution placement: high-risk actions принудительно получают sandbox placement.
9. Canonical-memory synchronization в Hexis temporal/evidence projection.
10. Active UI Control Center для всех Hexis API methods, а не только backend endpoints.
11. UI для HMX strategy/intent и явного подтверждения импорта.
12. UI для rate limits connector policy и execution placement.
13. Persistence/migration wiring для Hexis state.
14. Sanitized Hexis source provenance; `.env.local` и реальный Gmail credentials JSON в архив не попадают.

## Что намеренно НЕ стало вторым владельцем

- Hexis PostgreSQL schema / database authority;
- Hexis Agent loop;
- Hexis Identity/Persona database;
- Hexis standalone memory database;
- отдельный heartbeat engine;
- unrestricted self-repair executor;
- remote companion executor без реального node transport;
- отдельный UI runtime;
- полный Hexis SQL production layer.

Эти функции либо покрываются существующими системами Neuro-Kurisu, WILL/Lumina, либо требуют отдельного evidence-gated production слоя.

## Проверки текущего прохода

PASS — Hexis adaptation: 9/9.
PASS — Hexis server smoke: targeted HTTP end-to-end.
PASS — WILL bridge: 9/9.
PASS — WILL surfaces: 3/3.
PASS — Lumina adaptation: 3/3.
PASS — final integration regression: 3/3.
PASS — UI/function wiring: 41 API routes, 0 missing server routes, 0 unused UI methods.
PASS — architecture: 0 missing / 0 cycles / 0 legacy leakage.
PASS — core ownership: 5 direct constructors.
PASS — hygiene: 0 errors / 0 warnings.
PASS — forensics: 0 duplicate content / 0 duplicate names / 0 stale markers.
PASS — syntax: 1261 JS + 6 shell + 247 JSON checks.
PASS — source truth.
PASS — project state.
PASS — component conflicts.
PASS — release contract.
PASS — release source.
PASS — integrity.
PASS — sanitized Hexis provenance compile.

## Проверки, которые нельзя честно назвать PASS в этой среде

`npm run typecheck` полного runtime `tsc` не завершился в sandbox даже с 10-минутным лимитом без диагностического вывода; отдельная transpile/syntax-проверка изменённых TS/TSX файлов проходит.

Первый запуск полного `server:smoke` ранее исчерпал sandbox-время, но повторный официальный запуск после финальных изменений завершился `SERVER_SMOKE=PASS`.

Полный Vite/React clean-room build остаётся заблокирован отсутствующими `app/node_modules`.

## Итог

Hexis integration is **closed at the adapter/runtime/UI level** for the selected useful mechanisms. Итоговый проект сохраняет единственный canonical Neuro-Kurisu organism owner и получает поверх него epistemic governance, temporal memory history, staged portable exchange, transactional external actions и полноценную операторскую поверхность.
