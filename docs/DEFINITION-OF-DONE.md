# Definition of Done

A capability is considered integrated only when all of the following are true:

1. It has one explicit owner.
2. The active code path references that owner through a real import/API boundary.
3. State crossing the boundary has a typed/validated contract.
4. The capability has executable verification.
5. Missing hardware/provider conditions are surfaced honestly rather than simulated.
6. Legacy alternatives are isolated from writable canonical state.
7. Provenance can be traced back to the original uploaded branch.
