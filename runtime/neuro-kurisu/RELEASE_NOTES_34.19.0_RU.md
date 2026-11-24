# Neuro-Kurisu 34.19.0 — BIG PASS 48

## Основной результат

BIG PASS 48 усиливает Evidence Spine и превращает подтверждение внешних данных в proof-carrying evidence. Параллельно сохранена dependency-inverted граница cognitive subsystems и усилена автономная research-сессия.

## Реализовано

- Evidence Firewall: quarantine/promoted/contested/rejected/expired.
- Разделение source identity и content identity.
- Независимые источники обязательны для promotion внешних claims.
- Контрверсии одного источника сохраняются и могут вернуть claim в contested.
- Proof receipt содержит policy version, время promotion, независимые источники, content hashes и итоговый score.
- Research session сбрасывается при смене project/claim и хранит bounded history.
- External project research gateway: HTTPS-only, allowlist, private-host block, redirect block, timeout/size limits, bounded cache.
- CognitiveSubsystemPorts переведены на accessor contract без concrete OrganismCore import.
- Migration schema 92 синхронизирована с ReleaseContract.
- 250/500/1000-cycle operational gates подтверждены на текущем исходном дереве; 1000-cycle baseline: ratio 1.397, last 38.18 ms, p95 45.97 ms, heap 48.64→75.43 MB.

## Ограничения

- Live external-network validation не выполняется в sandbox без реального исходящего доступа.
- Native Android lifecycle, real vision, full social cognition и 24h/72h/7d/30d device validation остаются отдельными задачами.
- Полный composite audit может превышать одно wall-clock окно; отдельные correctness/security/release gates запускаются независимо.
