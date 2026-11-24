# Upstream candidates — current registry

The source-backed registry is intentionally lazy: external code is not imported during ordinary `neurocore` startup.

## Highest-priority candidates
- Flash Linear Attention: GDN-2, Raven, PGDN, PKDA, KDA, Mamba-3, DeltaFormer, MoM and related recurrent/linear-attention layers.
- Preconditioned DeltaNet: research implementations of PGDN/PKDA and preconditioning kernels.
- Official Mamba: Mamba-3 reference implementation.
- NVIDIA GatedDeltaNet-2: research-only reference because its repository has separate license terms.

## Intake rule
A candidate is not a NeuroCore mechanism until the source is audited, adapted to the canonical contract, benchmarked with matched budgets, ablated, and either promoted or rejected.
