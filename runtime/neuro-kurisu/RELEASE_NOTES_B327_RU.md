# Neuro-Kurisu 35.6.1 — B327

## Recovery-driven Long-Term Learning

B327 превращает краткосрочный recovery influence B326 в долговременную, evidence-gated стратегию внутри канонической AdaptivePolicyEngine.

### Added
- `RecoveryStrategyEpisode`
- `RecoveryStrategyPromotion`
- `RecoveryStrategyState`
- durable recovery strategy state in `AdaptivePolicyState`
- evidence-gated multi-boot promotion
- bounded context transfer
- migration/restore normalization
- `recoveryStrategyBias()`
- `observeRecoveryOutcome()`
- `recoveryStrategyDiagnostics()`
- OrganismCore integration into action utility/canonical policy signals
- B327 micro gate
- B327 Core integration gate
- master roadmap update

### Verification
- B327 recovery long-term learning: PASS
- B327 OrganismCore integration: PASS
- B326 regression: PASS
- P16 migration: PASS
- TypeScript typecheck: PASS

### Limitation
Android/ARM64 device readiness remains a separate gate and is not claimed by host tests.
