# Финальный аудит — область проверки

Проверен актуальный canonical surface проекта после clean-room evolution:

- файлы и каталоги;
- relative imports;
- runtime import cycles;
- legacy/research leakage;
- JSON parsing;
- npm script targets;
- package-lock;
- release/version contract;
- schema migration;
- state invariants;
- stable state hash;
- replay signature;
- whitespace и пустые строки;
- старые version/build markers;
- duplicate textual content;
- server/UI release markers;
- executable Termux scripts;
- restart persistence;
- server health/metrics/chat;
- causal P6 lesions.

Legacy-original проверяется как immutable historical snapshot и не является частью canonical dependency graph.
