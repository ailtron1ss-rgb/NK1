# NΩ 1.1.0 Audit

## Separation of claims
We distinguish implementation, integration, testing, and demonstrated capability. Passing tests does not imply general intelligence.

## Verified engineering state
- Repository tests: 74/74.
- `compileall`: pass.
- Frontier-specific tests: 6/6 after the final adapter fix.
- Extended symbolic composite tasks: verified through the NΩ runtime.
- Program equivalence checker: self-equivalence and bounded counterexample path covered.

## Frontier run
- Holdout verified rate: 83.9%.
- Adversarial verified rate: 64.3%.
- Runtime traces captured: 64.
- Trace verified rate: 71.9%.
- Candidate promotion: false.

The candidate was deliberately not promoted because its independent family-classification signal fell while the verified runtime path remained strong. The project therefore keeps 1.0 as the stable generalist and 1.1 as a research branch.

## Mobile caveat
The mobile benchmark uses simulated device budgets and host-side Python latency. It is not a physical Android/Termux battery/thermal measurement.
