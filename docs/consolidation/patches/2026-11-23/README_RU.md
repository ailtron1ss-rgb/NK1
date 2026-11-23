# Патчи консолидации — 2026-11-23

## Статус: активных патчей нет

Все патчи, подготовленные в ходе анализа, переведены в `historical/` или не включены. Текущий ствол `89a7047ca` уже содержит актуальные контракты, и применение старых патчей может откатить более новые проверки.

## historical/1101-planner-gate-test.patch

**Статус: OBSOLETE — не применять.**
**Ветка:** `aspect/risk-aware-recovery-runtime-wiring-20261122` (PR #1101, closed)
**Head на момент проверки:** `af9040164`

Патч приводил устаревшие static-regex к контракту `projectAllowed && !riskRecoveryApplied`. Он был проверен:

```text
COGNITIVE_RUNTIME_PLANNER_EXECUTION_GATE=PASS
```

Но затем ствол `89a7047ca` независимо интегрировал risk-aware recovery и обновил planner-gate контракт:

```text
const planningBudget = projectAllowed && !riskRecoveryApplied ? ...
const plan = riskRecoveryApplied ? this.plans.buildBudgetFallback(...) : ...
```

Применение старого патча к текущему стволу откатило бы этот более новый контракт. Патч оставлен только для provenance.

## Исторические проверки, не включённые в патчи

### #1104 active information

На промежуточном head `44b564a3c` тест падал на `experiments>0`: спайки novelty/uncertainty/prediction error не пробивали порог `shouldExperiment > 0.48`. Сильные одновременные спайки давали `experiments=52`. Upstream исправил это в `4aa51e5f2`; в #1104 порог `.45` (3 эксперимента). Закрытый #1105 предлагал `.34` (54 эксперимента), но не был смержен. Патч не включён.

### #1093 redaction

На head `103de13e6` найден security-баг: токен `ghp_...` сохранялся, а `[REDACTED]` добавлялся после него. Причина — общий replace-callback сохранял capture-group. Автор исправил баг в `fe877ef79`; ствол содержит более сильный тест. Патч не включён.

## Безопасность

- Патчи не содержат секретов, ключей и токенов.
- При подготовке не выполнялись force-push и удаление веток.
- Все проверки выполнялись в отдельных временных worktree; после проверки они удалены.
