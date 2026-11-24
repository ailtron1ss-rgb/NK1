# Neuro-Kurisu 34.86.0 — BIG PASS 112

Главный фокус: self-directed learning investment gate.

Организм теперь перед запуском нового developmental cycle оценивает, стоит ли расходовать ресурс на обучение. Решение может быть `invest`, `observe`, `defer` или `recover` и сохраняется в bounded ledger. Это решение само по себе не меняет mastery/policy и не создаёт evidence.

P36 state: v4. Global state schema: 121.

Проверено: typecheck, Pass 112 functional/migration/audit, Pass 109–111 focused regressions, release/source/architecture/integrity/hygiene/forensics. Mobile 1000 и operational 500 проходят. Финальный operational 1000 в последнем execution window не подтверждён из-за timeout; старый PASS не переносится автоматически.
