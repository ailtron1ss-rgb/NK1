# Release Notes — B260

B260 добавляет Recurrent Causal Memory к canonical neural substrate B259.

Изменения не заменяют старые memory/world/agency systems, а начинают связывать их через единый temporal learning loop.

Проверено: typecheck, B259, B260 standalone, B260 core integration, B242–B249 regression path, P26, architecture, integrity, hygiene, full audit, release contract, lockfile, release source, archive manifest.

Известный environment gate: FileStateStore fsync -> EIO в текущей container filesystem. Не скрывается и не переводится в PASS.
