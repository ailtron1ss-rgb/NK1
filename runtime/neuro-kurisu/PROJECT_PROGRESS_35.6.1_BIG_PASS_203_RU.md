# Neuro-Kurisu 35.6.1 — Progress after BIG PASS 203

## Current verified release state

The project has a machine-checkable Function Passport layer covering 2,675 semantic functions. The release gate enforces behavioural contracts, proof plans, evidence identity, safety classification and verdict consistency.

### Evidence snapshot

- VERIFIED: 15 / 2,675 (0.56%)
- INTEGRATION_ONLY: 27
- UNSAFE_TO_AUTO_RUN: 129
- UNVERIFIED: 2,504
- Existing parameterized safe probes: 553 / 568 successful, 0 failed
- Architecture cycles: 0
- Architecture legacy leakage: 0
- Source hygiene errors/warnings: 0 / 0
- Executable syntax failures: 0

### Last release gate

`npm run release:brain203` completed successfully.

### Interpretation

The low VERIFIED percentage is intentional: the project no longer treats source existence, name matching or generic smoke execution as proof of semantics. The next increase must come from real function-level evidence.

### Next large pass

Close the highest-value safe functions by domain, starting with memory, world, self, agency and learning. Each promoted function must gain exact direct evidence plus the additional proof tiers required by its safety/domain contract.
