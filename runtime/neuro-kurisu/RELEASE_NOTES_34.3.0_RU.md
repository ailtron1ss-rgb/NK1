# Neuro-Kurisu 34.3.0 — BIG PASS 35

## Цель прохода

Усиление мобильной эксплуатации и связывание существующих когнитивных механизмов без добавления декоративных P-модулей.

## Реально внедрено

- P40 Model Ecology получила `configured`, `cooldownUntil`, `consecutiveFailures`, timestamps успешных/неуспешных вызовов и circuit-breaker после повторных отказов.
- P40 restore/migration теперь безопасны для старых state: отсутствующие поля восстанавливаются из профилей по умолчанию.
- Runtime sensor clock теперь использует фактический adaptive `sampleDelayMs`, а не только фиксированный `sensorIntervalMs`.
- Добавлен bounded `RuntimeEvidenceBus` для связывания observation → prediction → action → outcome → model/resource evidence.
- Добавлен диагностический `/api/organism/runtime-control`.
- Симулированные переходы `WorldEnvironment` больше не маркируются как external evidence.
- Android bridge учитывает процессорную нагрузку процесса вместе с system load, считает stale age и поддерживает безопасный `NEURO_SCREEN_INTERACTIVE` override.
- Termux installer теперь явно устанавливает `termux-api`.
- P41 native perception исправлена: audio low/mid/high теперь строятся по частотным probe, а image edge density — по пространственным соседям, а не по одномерному порядку массива.
- Добавлен автоматический `audit:big-pass-progress`.

## Проверено

- TYPECHECK=PASS
- BIG_PASS_35_HARDENING=PASS
- P40_MODEL_ECOLOGY=PASS
- P41_NATIVE_PERCEPTION=PASS
- P41_PERFORMANCE=PASS (10000 cycles)
- P57=PASS
- runtime clocks=PASS
- P30 continual=PASS
- P46 prediction ledger=PASS
- P56/P57 integration persistence=PASS
- API routes=PASS, duplicates=0
- architecture audit=PASS
- analysis alignment=PASS

## Не заявляется

Этот release не является доказательством phenomenal consciousness, qualia, human-level AGI или personhood. Он улучшает инженерную основу для их исследовательского изучения и повышает наблюдаемую автономность/устойчивость системы.
