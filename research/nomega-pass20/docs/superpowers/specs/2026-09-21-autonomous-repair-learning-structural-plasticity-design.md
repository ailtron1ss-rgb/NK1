# NΩ 1.28 Design — Autonomous Repair Learning + Structural Plasticity

## Goal

Turn verified failures into reusable neural repair knowledge while making structural plasticity transactional and independently verifiable.

## Architecture

`failure evidence → neural repair policy → candidate shortlist + safe fallback → execution verifier → repair outcome replay`

and independently:

`substrate state → utility/eligibility inspection → bounded grow/prune plan → transaction → external gate → commit/rollback → restart verification`.

The neural policy never serves as correctness oracle. The structural controller never promotes a mutation without external evidence.

## Success criteria

1. Repair policy fits from real repair outcomes.
2. Verified repair rate does not regress after learning.
3. First-verified candidate rank improves at equal candidate budget.
4. Structural mutations are bounded and reversible.
5. Rejected structural mutations restore the exact pre-transaction state.
6. Saved structural state reloads identically in a fresh process.
