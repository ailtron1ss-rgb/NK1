# BIG PASS 155 — Verified Autonomous Life / 35.2.0

## Цель
Сделать autonomous cognitive life реально проверяемой: каждая автономная decision должна иметь точного successor outcome, evidence basis, causal attribution и durable continuity.

## Реально внедрено
1. `VerifiedAutonomousLifeEngine` — decision/outcome/perception ledgers, causal links, longitudinal samples, checkpoints, integrity digest.
2. Core integration — уникальный decisionId создаётся при реальном выборе действия и передаётся в outcome.
3. Outcome provenance — external-postcondition / internal-transition / tool-contract / simulation / none.
4. Active-perception evidence — выбранная рекомендация превращается в отдельную observation запись.
5. Persistence — ledger повторно прикрепляется на финальной persistence boundary после generic projection.
6. Restart recovery — state сохраняется и восстанавливается как часть реального Runtime.
7. Server endpoint — `/api/organism/verified-autonomous-life` на настоящем `src/server/server.mjs`.
8. Research hooks — longitudinal points и auditable ablation/research interfaces.

## Фактические тесты
### Standalone
40 циклов; 40 решений; 40 exact outcomes; closed-loop 0.853; overall 0.776; integrity 1.000; self-audit PASS.

### Реальный OrganismRuntime
2 runtime steps; 2 решения; 2 outcome; 2 perception records; overall 0.500; audit PASS.

### Реальный server
Фактически запущен `src/server/server.mjs`; endpoint HTTP 200; benchmark доступен; audit PASS.

### Restart
1 runtime step → flush → process stop → новый Runtime → ledger восстановлен; cycles=1, decisions=1, digest совпал; audit PASS.

## Ограничения
Реальная внешняя sensorimotor integration зависит от доступного устройства и backend. Кодовые адаптеры существуют, но отсутствие физического сенсора не превращается в фиктивное evidence. Метрики engineering/behavioral и не доказывают субъективное сознание.
