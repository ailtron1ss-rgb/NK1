# Identity Lineage Architecture 34.51.0

## Principle
Identity causality is a derived evidence graph. It answers “what is currently associated with changes or pressure on identity?” It does not define identity truth.

## Nodes
identity, value, goal, memory, event, belief, observation, prediction, action, outcome, evidence, person, commitment, self-change.

## Relations
supports, contradicts, caused-by, changed-by, evidences, predicted-by, resulted-in, about, involves, binds, influences, revised-by.

## Causal chain
observation → interpretation/belief → prediction/goal → action → outcome → evidence/counterevidence → self/identity update.

## Boundaries
128 nodes / 256 edges; source and evidence metadata bounded; duplicate relation updates replace existing edge rather than growing copies.

## Performance principle
Hot path performs bounded in-place updates; deep snapshots only at persistence/inspection boundaries.
