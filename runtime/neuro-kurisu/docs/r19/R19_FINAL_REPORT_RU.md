# Neuro-Kurisu 35.33.0 / R19 — Semantic Evidence & Provenance Closure

## Главное

R19 не добавляет отдельный «ещё один мозг». Изменены три canonical pathways:

1. MemoryOS2 получил provenance-aware conflict arbitration: более свежая, но низкоавторитетная память больше не может автоматически вытеснить более сильное device/external evidence. Слабый конфликтный кандидат переводится в quarantine, историческое evidence сохраняется.
2. MemoryRetentionEconomy получил anti-collapse projection: online learning остаётся адаптивным, но веса возвращаются к разнообразному simplex и bounded negative budget. Это предотвращает схлопывание memory policy в одну feature.
3. OrganismDecisionTrace получил operation-level semantic evidence: state-before hash, candidate hash, selected hash, world-context hash, invariants и закрытие outcome state. Это превращает часть большого runtime graph из «работает где-то» в проверяемую операционную цепочку.

## Новые проверки

- P2892 — provenance conflict closure: PASS; low-authority simulation conflict защищён от вытеснения authoritative device memory.
- P2893 — operation semantic evidence: PASS; 16 решений, mean invariant = 1.0, закрытые outcome traces содержат state-after/outcome hashes.
- P2894 — memory anti-collapse: PASS; 512 learning samples, entropy = 0.9537, max-positive/mean = 1.616, positive simplex preserved.
- P2895 — long horizon: PASS; 256 cycles, restart to tick 257, first/last cycle mean 76.92/119.09 ms, slowdown ratio 1.548x, memoryCount 121.

## Регрессия R18

P2887–P2891: PASS.
P2842 calibration: PASS.
P2855 contextual policy: PASS; holdoutAccuracy = 1.0 on its bounded test.

Architecture: PASS.
Hygiene: 0 errors / 0 warnings.
Forensics: PASS; 0 duplicate content / 0 duplicate names / 0 stale markers.
Integrity: PASS.
Syntax: PASS.

## Release-runner caveat

`release:r19:core` был остановлен внешним timeout на тяжёлом P2895, но P2895 был после этого отдельно выполнен и прошёл PASS. Остальные release gates после исправления hygiene также выполнены отдельно. Это не объявляется агрегатором PASS, а фиксируется как orchestration limitation.

## Не закрыто

- P2867 strict RSS mobile gate остаётся baseline-sensitive и требует реального Android/Termux protocol.
- operation-level semantic coverage пока покрывает только trace-critical surface; следующий этап должен расширить её до 200–400 critical functions.
- learned memory anti-collapse защищён, но пока нет специализированного Memory Anchors benchmark на реальном continual-learning потоке.
- neural/SSM substrate пока исследовательский кандидат, не canonical dependency.

## Интерпретация

R19 повышает доказуемость причинных и непрерывных свойств runtime. Это не доказательство субъективного сознания.
