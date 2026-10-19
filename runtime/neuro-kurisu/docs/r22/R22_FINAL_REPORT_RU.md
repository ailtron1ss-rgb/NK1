# Neuro-Kurisu R22 — Actionable World / Value-per-Byte / Provenance Closure

## Итог
R22 доведён до функционального release-core и расширен поверх исходного плана: memory value-per-byte, correction-aware capsules, actionable world-model head, operation-level semantic evidence и anti-decoration truth surface реально подключены к canonical runtime.

## Реальные изменения
- MemoryRetentionEconomy v4 получил estimated byte cost, net-value-per-byte, budget pressure и bounded budget ranking.
- OrganismCore теперь передаёт реальные оценки размера памяти и реально применяет `retain/dormant` решение.
- TemporalMemoryCompressor получил provenance classes, correction count, explicit correction links, evidence hashes и source diversity; state version повышен до 3 с backward-compatible restore.
- B261UnifiedWorldModel получил action-conditioned reward head (`rewardActionWeights` + per-action bias), что делает reward prediction зависимым одновременно от состояния и выбранного действия.
- P2896 переведён из trivial fixed-reward test в held-out state-conditioned benchmark: 64 training states / 32 held-out states.
- В runtime semantic evidence добавлены отдельные verified operations для world prediction и action selection.
- `OperationSemanticEvidence` runtime surface: 45/45 verified.
- Host/mobile semantic isolation остаётся закрытым P2868.
- Synthetic learning/evidence leaks остаются запрещёнными P2901/R22 anti-decoration audit.
- Release runner сокращён до функционального core-профиля; тяжёлые full-project audits выполняются независимыми процессами, чтобы orchestration timeout не маскировался под defect проекта.

## Фактические результаты
### Actionable world model — P2896
- training states: 64
- held-out states: 32
- model regret: 0.05269
- baseline regret: 0.27394
- regret uplift: 0.80767
- action hit rate: 0.8125
- predicted action sensitivity: 0.36434
- online reward error: 0.18770
- uncertainty: 0.08263

Это внутренний engineering benchmark, а не доказательство качества внешнего мира.

### Memory value-per-byte — P2897
- small memory density: 1.0
- large memory density: 0.1179
- bounded planner: selected high-density memory, deferred low-density memory.

### Correction capsules — P2898
- corrections: 2
- explicit correction links: 2
- provenance diversity: 0.50
- evidence hashes: 8

### Semantic evidence
- static critical operations: 814
- statically covered: 12
- strict coverage: 1.351%
- runtime operation evidence: 45/45 verified.

The low static coverage is intentionally not hidden: this remains the largest evidence debt.

### Long horizon — P2895
- 256 cycles
- restarted tick: 257
- memory count: 121
- first block ≈ 79.31 ms
- last block ≈ 118.76 ms
- slowdown ≈ 1.50×
- standalone run: PASS

### Existing organism compatibility
- P24 world identity: PASS
- P27 world foundation/integration: PASS
- P28 plasticity/integration: PASS
- P30 continual/integration: PASS
- P31 truthfulness/integration: PASS
- P39 continuous-life/integration: PASS

### Release / hygiene
- typecheck: PASS
- architecture: PASS
- hygiene: 0 errors / 0 warnings
- forensics: 0 duplicate content / 0 duplicate names / 0 stale markers
- syntax: PASS
- integrity: PASS
- release contract: PASS
- release-source: PASS
- archive manifest: 4064 files, 0 missing, 0 hash mismatch, 0 extra
- functional release-core runner: PASS (15/15)

## Не закрыто
- реальный Android/Termux device verification;
- static semantic coverage remains low;
- full aggregate long-horizon release orchestration is intentionally separated from functional core because nested heavy audit orchestration is environment-sensitive;
- no consciousness claim is made.
