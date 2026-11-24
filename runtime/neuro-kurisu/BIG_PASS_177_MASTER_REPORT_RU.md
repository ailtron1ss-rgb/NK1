# NEURO-KURISU — BIG PASS 177 MASTER REPORT

Дата: 2026-09-10
Версия: 35.6.1

## Главная цель

BIG PASS 177: перевод Android/embodiment из набора отдельных адаптеров в более честный sensorimotor контур с реальным capability detection, fresh-device evidence, interoceptive impact, diagnostics persistence и проверяемыми actuator paths.

## Ключевые изменения

1. `AndroidEmbodimentBridge` получил `AndroidTelemetryDiagnostics` и `sampleAndroidTelemetryDetailed()`. Старый API сохранён через thin wrapper.
2. Добавлен `invalidateTermuxCapabilityCache()` для детерминированного lifecycle/testing и исправлен `commandExists()` с login-shell на non-login shell, чтобы PATH не давал ложный negative capability result.
3. `EmbodimentRuntime` теперь сохраняет sample count, sensor failures и diagnostics snapshot.
4. `OrganismCore.setEmbodiment()` атомарно сохраняет body + diagnostics, применяет body к canonical organism needs и прогоняет P66 interoceptive homeostasis.
5. При существенном изменении body создаётся `embodiment-sample` event для causal evidence.
6. `organism.device.status` и `organism.project.device` перестали заявлять `verified=true` при host fallback / stale Android telemetry. Fresh device evidence теперь требует `source=android-termux` и `staleMs=0`.
7. Добавлены regression tests: Android sensor contract, device truthfulness, Core embodiment causality + persistence.
8. Semantic/function reality audits обновлены до pass 177.

## Доказательства

- Android mocked Termux contract: PASS, 3/3 commands, battery=0.62, motion=0.22.
- Device truthfulness: PASS; в host environment fallback не считается verified.
- Core embodiment causality: PASS; energy 0.820→0.492, cognitive load 0.180→0.551, P66 cycles=1, diagnostics persisted through restart.
- BIG PASS 176 longitudinal regression: PASS; replay uses stateAfter, idempotent, 31 cycles survived restart, continuity=0.932.
- Parameterized function probe: 497/509 PASS, 0 FAIL, 0 input synthesis needed, 12 lifecycle-needed.
- Semantic inventory: 2489 functions; 24 VERIFIED, 594 INTEGRATION_ONLY, 224 UNSAFE_TO_AUTO_RUN, 1647 UNVERIFIED.
- VERIFIED rate: 0.96%.
- Evidence coverage: 6.93%.
- Function liveness inventory: 2561 function-like declarations, 2532 with body, 107 exported, 158 zero-reference.
- P31 functional consciousness regression: PASS.
- P35 semantic world body: PASS.
- P37 sensorium: PASS.
- P41 native/semantic/temporal perception: PASS.
- P42 unified experience: PASS.
- Voice embodiment/interruption: PASS.
- Restart persistence: PASS, 28.39 s.
- Architecture: PASS, sourceFiles=789, canonicalFiles=269, missing=0, cycles=0, legacyLeakage=0.
- Integrity: PASS, files=1529.
- Forensics: PASS, activeFiles=1515, duplicateContent=0, duplicateNames=0.
- Hygiene: PASS, errors=0, warnings=0.
- Release source: PASS, application=35.6.1, schema=127.
- Lock: PASS.

## Ограничения / честные предупреждения

1. Физический Android не подключён в этой sandbox-среде. Android contract проверен через детерминированные fake Termux executables; это доказывает логику адаптера, но не даёт физического device proof.
2. Старый 30-cycle organism smoke в одном batch запуске превысил транспортный лимит среды. Поэтому он НЕ засчитан как PASS в этом release evidence. Bounded 5-cycle smoke-профиль был проверен отдельно: init PASS, 5/5 cycles PASS, stop PASS.
3. Full aggregate `audit:big-pass-177` не используется как source of truth; каждый существенный gate проверяется отдельно, чтобы timeout orchestration не маскировался под functional result.
4. Long-horizon heap growth остаётся отдельным performance backlog.

## Что НЕ утверждается

Этот pass не доказывает феноменальное сознание, человеческую субъективность или полноценную физическую embodied agency. Он доказывает конкретные функциональные causal/lifecycle свойства software organism.
