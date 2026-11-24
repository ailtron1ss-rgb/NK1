# Neuro-Kurisu 35.6.1 — BIG PASS 203 Release Audit

## Результат

BIG PASS 203 внедряет Function Passport / Semantic Proof слой и включает его в release-аудит проекта. Функция не считается VERIFIED только потому, что она существует в исходниках или вызывается smoke-тестом: для неё должен существовать behavioural contract, safety classification и полный набор обязательных proof tiers.

## Реальная проверка перед упаковкой

- Typecheck: PASS
- BIG PASS 200 standalone: PASS — coherence 0.7599, coupling 0.69, stability 0.7803
- BIG PASS 200 Core: PASS — coherence 0.6638, coupling 0.2868, phase=fragmented
- BIG PASS 201 longitudinal transfer: PASS — retention 0.773, transfer 0.7069, regressions 0
- BIG PASS 202 device evidence: PASS — 2 verified probes, 1 host probe
- BIG PASS 203 passport contract test: PASS
- Function passport gate: PASS
- Architecture: PASS — cycles 0, legacy leakage 0
- Integrity: PASS
- Source hygiene: PASS — errors 0, warnings 0
- Executable syntax: PASS — JS 593, SH 4, JSON 128
- Release contract: PASS
- Forensics: PASS — empty 0, duplicate content 0, duplicate names 0
- Release source verification: PASS

## Function reality snapshot

- Passport functions: 2,675
- VERIFIED: 15
- INTEGRATION_ONLY: 27
- UNSAFE_TO_AUTO_RUN: 129
- UNVERIFIED: 2,504
- Strict VERIFIED rate: 0.56%
- Safe parameterized probes from the existing sweep: 553/568 successful, 0 failures

Эти числа намеренно строгие. Большое количество UNVERIFIED означает отсутствие достаточного доказательства, а не автоматически нерабочий код.

## Release policy

1. Архив считается валидным только если все перечисленные release gates проходят после распаковки.
2. UNSAFE_TO_AUTO_RUN не запускается автоматическим semantic sweep.
3. Device claims не повышаются из host/synthetic evidence.
4. VERIFIED требует все обязательные proof tiers конкретного passport.
5. Следующий проход должен повышать VERIFIED не искусственным ослаблением критериев, а добавлением реального direct/regression/persistence/replay/device/adversarial evidence.

## Следующий большой проход

Приоритет: закрытие memory → world → self → agency → learning через реальные function-level probes и integration evidence, затем повторный полный sweep 2,675 функций.
