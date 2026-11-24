# P6 ChangeLog — Neuro-Kurisu Evolution Current Release

## Архитектура

- введён единый `VERSION.json`;
- единый release contract для package/server/migration/manifests;
- schema поднята до 8;
- фазовые `p1..p5` заменены доменными `facets.*` в canonical state;
- evolution-код переведён из phase-specific `cognition/p5` в `cognition/evolution`;
- исторические tests/research перенесены в `history/`;
- P5 phase-specific release audit удалён из текущего production surface.

## Надёжность

- добавлен `InvariantEngine`;
- добавлен `IntegritySentinel`;
- добавлен stable SHA-256 state provenance;
- добавлен deterministic replay signature;
- добавлен capability registry;
- добавлен action gateway с dry-run/live gate;
- исправлен state hash после restart: volatile timestamps больше не участвуют в хэше;
- исправлена типовая совместимость Node 22 strip-only.

## Производительность

- добавлен batch persistence per cognitive cycle;
- сокращено число fsync/atomic writes внутри одного шага;
- research lab переведён на memory-backed store.

## Release/качество

- настоящий zero-dependency package-lock v3;
- `release:audit` теперь универсальный и не запускает тяжёлые исследования;
- добавлены release-contract и source-hygiene audits;
- добавлен server smoke;
- UI release marker и state path исправлены;
- Device Gate документация обновлена под Current Release;
- manifests генерируются автоматически.
