# NK1 CI reliability correction — longitudinal holdout workflow (2026-11-01)

The repository-wide CI reliability audit rejected `.github/workflows/memory-longitudinal-holdout-pairing.yml` because it still referenced `actions/checkout@v4` and `actions/setup-node@v4`, below the repository's approved Node.js 24-compatible v7+ action policy.

Updated both first-party actions to v7 and switched Node selection to the root `.nvmrc`, preventing local workflow runtime drift. The existing phase-isolated longitudinal holdout command remains unchanged.

This repairs workflow policy compliance; it does not claim that the holdout experiment itself shows a positive retrieval delta.
