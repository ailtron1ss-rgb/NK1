# BIG PASS 108 — Session Firewall + Trajectory Evidence Ledger

Версия: 34.82.0
State schema: 117

## Цель
Усилить Cognitive Research Battery так, чтобы экспериментальный дизайн создавался до наблюдения исходов, каждое наблюдение проверялось против заранее созданного слота, а изменения состояния организма сохранялись отдельно от оценки результата.

## Реализовано
1. **Deterministic session schedule** — protocol seed заранее создаёт пары replay-on/replay-off, контексты, задержки, holdout и порядок.
2. **Session firewall** — фактический trial обязан совпадать со своим preregistered slot.
3. **Protocol freeze** — session-specific schedule hash больше не записывается обратно в protocol capsule.
4. **Terminal seal** — завершённая session не принимает новые outcomes.
5. **External evaluator contract** — явные evaluatorRunId/source/version; synthetic-test source запрещён для evaluator API.
6. **Trajectory Ledger** — runtime state hash и tick фиксируются отдельно от task score.
7. **Persistence** — sessions, schedules, checkpoints и trials сохраняются и восстанавливаются.
8. **Migration** — schema 116 → 117, battery version 2 → 3.
9. **Audits** — функциональный, migration, Core restart и reproducibility.

## Почему это лучше прежнего слоя
Pass 107 уже защищал protocol-level валидность. Pass 108 закрывает ещё более конкретную дыру: ранее protocol существовал, но runtime outcome не обязан был совпасть с заранее назначенным experiment slot. Теперь такой outcome может быть отвергнут до попадания в evidence store.

## Что НЕ делалось
Не добавлялся второй planner, внутренний генератор task score, автоматическая «оценка сознания», self-modification по исследовательскому score и изменение canonical MemoryOS.

## Научный статус
Synthetic tests проверяют только механику. Реального доказательства улучшения памяти, переноса, субъективности или сознания они не дают.

## Финальная техническая проверка

- Targeted Pass 108 audit: PASS.
- Mobile horizon 1000: PASS (ratio 1.218; p95 16.99 ms).
- Operational horizon 500: PASS (ratio 1.117; p95 45.45 ms).
- Operational horizon 1000: PASS (ratio 1.442; p95 52.09 ms).
- Archive manifest: PASS, 1415 controlled files, missing 0, hash mismatches 0, extra 0.

Длинные проверки разделены от bounded-аудита намеренно: это устраняет ситуацию, когда timeout одного длительного теста маскирует результаты уже завершившихся gate-проверок.
