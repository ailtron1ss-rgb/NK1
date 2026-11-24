# NK1 CI reliability correction — longitudinal holdout workflow (2026-11-01)

The repository-wide CI reliability audit rejected this workflow because it referenced actions/checkout@v4 and actions/setup-node@v4, below the repository's approved Node.js 24-compatible v7+ action policy.

Both actions now use v7 and Node selection reads the root .nvmrc. The existing phase-isolated holdout command remains unchanged.

This fixes CI policy compliance; it does not imply a positive retrieval uplift in the holdout experiment.
