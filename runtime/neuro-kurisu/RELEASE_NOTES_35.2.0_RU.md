# Neuro-Kurisu 35.2.0 — Verified Autonomous Life

35.2.0 усиливает 35.1.0 строгим проверяемым контуром decision → exact outcome → verification → causal accountability.

## Основные изменения
- `VerifiedAutonomousLifeEngine`: exact decision IDs, outcome ledger, perception evidence, causal links, integrity checkpoints, longitudinal evidence, recovery accounting.
- Core/runtime integration: реальный `OrganismRuntime.step()` создаёт и закрывает пары decision/outcome без тестовых подмен.
- Persistence: verified-life ledger сохраняется на финальной persistence boundary и восстанавливается после restart.
- Server: `/api/organism/verified-autonomous-life` отдаёт snapshot, benchmark и self-audit.
- Backward-compatible state schema bump: 125.
- Engineering/research claim boundary сохранён: показатели не интерпретируются как доказательство субъективного сознания.

## Проверки
- TYPECHECK PASS
- BIG PASS 116–125 regression PASS
- BIG PASS 126 regression PASS (standalone/core/server)
- BIG PASS 128–154 PASS
- BIG PASS 155 standalone/core/server PASS
- BIG PASS 155 restart persistence PASS
- architecture / core ownership / hygiene / forensics / integrity / release source / release contract PASS
- archive manifest + ZIP integrity PASS
