from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, MutableMapping, Optional, Dict


@dataclass(frozen=True)
class MechanismSpec:
    """A named mechanism with explicit promotion status and evidence."""

    name: str
    owner: str
    purpose: str
    status: str = "candidate"  # candidate | integrated | rejected | legacy
    parameter_budget: Optional[int] = None
    evidence_refs: tuple[str, ...] = ()


class MechanismRegistry:
    """Explicit current-research registry.

    A mechanism may be replaced in-place without creating a new VXX inheritance layer. The
    registry is metadata only; actual neural computation lives in explicit owners.
    """

    def __init__(self, specs: Iterable[MechanismSpec] = ()) -> None:
        self._items: MutableMapping[str, MechanismSpec] = {spec.name: spec for spec in specs}

    def add(self, spec: MechanismSpec) -> None:
        if spec.name in self._items:
            raise KeyError(f"mechanism already registered: {spec.name}")
        self._items[spec.name] = spec

    def get(self, name: str) -> MechanismSpec:
        return self._items[name]

    def integrated(self) -> Dict[str, MechanismSpec]:
        return {k: v for k, v in self._items.items() if v.status == "integrated"}

    def metadata_only_candidates(self) -> Dict[str, MechanismSpec]:
        """Return explicitly reference-only candidates that have no current local implementation."""
        return {
            k: v
            for k, v in self._items.items()
            if v.status == "candidate" and v.owner == "research_reference"
        }

    def all(self) -> tuple[MechanismSpec, ...]:
        """Return all registered mechanisms, including candidate/rejected entries."""
        return tuple(self._items.values())

    def snapshot(self) -> dict[str, dict]:
        return {
            name: {
                "owner": spec.owner,
                "purpose": spec.purpose,
                "status": spec.status,
                "parameter_budget": spec.parameter_budget,
                "evidence_refs": list(spec.evidence_refs),
            }
            for name, spec in self._items.items()
        }


DEFAULT_REGISTRY = MechanismRegistry(
    [
        MechanismSpec(
            name="adaptive_hybrid_temporal_credit",
            owner="recurrent_substrate",
            purpose="parameter-free age-scheduled blend of HiPPO history and cascading eligibility, early emphasis on polynomial history and later emphasis on long-tail cascade",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("V120_TEMPORAL_MULTI_SEED", "HIPPO_S4_REFERENCE", "CET_2026"),
        ),
        MechanismSpec(
            name="unified_sparse_associative_memory_v126",
            owner="recurrent_substrate",
            purpose="capacity-scaled sparse explicit state embedded in the canonical recurrent owner using product-key routing, protected channel-wise delta writes, and state-contained retention",
            status="candidate",
            parameter_budget=3112,
            evidence_refs=("SDM_ARXIV_2607_07386", "SDM_OFFICIAL_GITHUB", "GDN2_2026", "V122_MEMORY_ABLATION"),
        ),
        MechanismSpec(
            name="collision_resistant_key_fingerprint_v126",
            owner="recurrent_substrate",
            purpose="parameter-free compact per-slot key fingerprints that disambiguate partial product-key route collisions during sparse reads and associated writes",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("V125_COLLISION_PROBE", "SDM_ARXIV_2607_07386"),
        ),
        MechanismSpec(
            name="collision_aware_sparse_admission_v126",
            owner="recurrent_substrate",
            purpose="candidate cache-admission policy that limits novel overwrites and favors content-matched routed slots",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("V122_COLLISION_ABLATION", "RAVEN_2026"),
        ),
        MechanismSpec(
            name="product_key_sparse_delta_memory",
            owner="research_candidate",
            purpose="product-key sparse runtime memory with bounded similarity-gated delta-style writes",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("SDM_ARXIV_2607_07386", "SDM_OFFICIAL_GITHUB", "V120_SPARSE_DELTA_PROBE"),
        ),
        MechanismSpec(
            name="mamba3_heavy_tail_activation",
            owner="research_candidate",
            purpose="dependency-free implementation of the Mamba-3 heavy-tail activation as an optional parameter-free state-activation candidate",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("MAMBA3_ARXIV_2603_15569", "MAMBA3_OFFICIAL_SOURCE", "V120_HEAVY_TAIL_SMOKE"),
        ),
        MechanismSpec(
            name="synergy_consensus_feedback",
            owner="current_trunk",
            purpose="parameter-free agreement-weighted consensus feedback from existing predictive/world/self/memory/multiscale branches into the next recurrent input; disabled by default pending qualification",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("TTTLA_ICML2026", "V110_SYNERGY_AUDIT", "V109_DELAYED_RECALL_BENCHMARK"),
        ),
        MechanismSpec(
            name="efla_exact_delta_integrator",
            owner="recurrent_substrate",
            purpose="exact continuous-time scalar integration of the rank-1 delta write step; research-only and disabled by default",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("EFLA_2026", "V108_EFLA_BENCHMARK"),
        ),
        MechanismSpec(
            name="delta_product_transition",
            owner="research_reference",
            purpose="candidate state-transition family using products of generalized Householder transforms for improved state tracking without a second recurrent memory owner",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("DELTA_PRODUCT_NIPS2025",),
        ),
        MechanismSpec(
            name="delta_mem_online_state",
            owner="research_reference",
            purpose="compact online associative state with delta-rule writes for continual interaction memory",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("DELTA_MEM_2026",),
        ),
        MechanismSpec(
            name="ttt_linear_attention_reduction",
            owner="research_reference",
            purpose="treat KV-binding test-time training as a learned linear-attention family, motivating trunk simplification before adding a second optimizer-like subsystem",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("TTTLA_ICML2026",),
        ),
        MechanismSpec(
            name="raven_sparse_memory_routing",
            owner="research_reference",
            purpose="high-recall sparse memory routing with selective slot updates; evaluated as an architectural reference for the current top-k state router",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("RAVEN_2026",),
        ),
        MechanismSpec(
            name="delta_mem_compact_online_memory",
            owner="research_reference",
            purpose="compact online associative memory/write-strategy family for continual interaction memory",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("DELTA_MEM_2026",),
        ),
        MechanismSpec(
            name="mamba3_state_tracking_reference",
            owner="research_reference",
            purpose="reference family for richer recurrence, complex-valued state tracking and MIMO updates; not copied into default trunk",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("MAMBA3_ICLR2026",),
        ),
        MechanismSpec(
            name="data_grounded_predictive_target",
            owner="learning_objective",
            purpose="fixed non-neural projection of the actually observed next-step data; replaces self-generated predictive targets without adding a second learned truth source",
            status="integrated",
            parameter_budget=0,
            evidence_refs=("V124_DATA_GROUNDED_TARGET",),
        ),
        MechanismSpec(
            name="continued_causal_state",
            owner="current_trunk",
            purpose="chunked long-sequence execution with recurrent-state carry and optional truncated BPTT boundaries",
            status="integrated",
            parameter_budget=0,
            evidence_refs=("V113_STATE_FIDELITY", "V113_LONG_HORIZON"),
        ),
        MechanismSpec(
            name="runtime_state_fidelity",
            owner="current_trunk",
            purpose="explicit serialization of batch-shaped multiscale runtime state so resume preserves causal continuity",
            status="integrated",
            parameter_budget=0,
            evidence_refs=("V113_RUNTIME_ROUNDTRIP",),
        ),
        MechanismSpec(
            name="standalone_causal_trunk",
            owner="current_trunk",
            purpose="single current execution/learning graph with one causal associative state owner and compact predictive projections",
            status="integrated",
            parameter_budget=69137,
            evidence_refs=("V106_TRUNK_EXTRACTION", "V112_GRADIENT_COVERAGE", "V111_LEAN_OBJECTIVE", "V113_STRUCTURAL_PRUNING"),
        ),
        MechanismSpec(
            name="unified_associative_substrate",
            owner="recurrent_substrate",
            purpose="sparse recurrent associative substrate with independent erase/write gates, online preconditioning, and sequence-local adaptation statistics",
            status="integrated",
            parameter_budget=40200,
            evidence_refs=("GDN2_2026", "RAVEN_2026", "PGDN_2026", "V90_ISOLATED_RECALL", "V91_SEQUENCE_LOCAL_PRECONDITIONER"),
        ),
        MechanismSpec(
            name="compositional_predictive_memory",
            owner="legacy_v70_memory",
            purpose="historical compositional memory route preserved for evidence/migration only",
            status="legacy",
            evidence_refs=("V70_GATE",),
        ),
        MechanismSpec(
            name="adaptive_replay_utility",
            owner="legacy_v88_replay_controller",
            purpose="historical replay selection controller preserved outside current execution",
            status="legacy",
            evidence_refs=("V87_GATE",),
        ),
        MechanismSpec(
            name="neural_lifecycle_regeneration",
            owner="neuronal_lifecycle_controller",
            purpose="utility- and activity-aware partial rejuvenation of mature low-contribution hidden units to preserve plasticity",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("Dohare_Nature_2024", "Farias_ICLR_2025", "McCutcheon_CCBP_ICLR_2026", "V94_SHORT_QUALIFICATION"),
        ),
        MechanismSpec(
            name="homeostatic_neural_gain",
            owner="recurrent_substrate",
            purpose="slow non-gradient activity regulation via bounded per-unit gain",
            status="candidate",
            parameter_budget=64,
            evidence_refs=("Hakim_SciRep_2025", "V94_SHORT_QUALIFICATION"),
        ),
        MechanismSpec(
            name="adaptive_neural_compute",
            owner="recurrent_substrate",
            purpose="difficulty-gated shallow/deep refinement to allocate compute to hard sequence steps",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("TSA_2026", "RouterTuning_EMNLP_2025", "V95_ADAPTIVE_COMPUTE_QUALIFICATION"),
        ),
        MechanismSpec(
            name="three_factor_fast_synapse",
            owner="recurrent_substrate",
            purpose="causal online fast-synapse adaptation via eligibility trace, broadcast prediction error, and modulatory gate",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("BrainTrace_NatureComms_2026", "AGMP_2026", "EPROP_2020", "V95_ONLINE_PLASTICITY"),
        ),
        MechanismSpec(
            name="adaptive_linearity",
            owner="recurrent_substrate",
            purpose="per-neuron nonlinear/linear interpolation driven by local gradient-flow history",
            status="candidate",
            parameter_budget=64,
            evidence_refs=("AdaLin_PMLR_2026", "V97_ADALIN_CANDIDATE"),
        ),
        MechanismSpec(
            name="selective_weight_regeneration",
            owner="plasticity_controller",
            purpose="periodic reset of lowest-utility weights using |w*g| utility with optimizer-state reset",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("SelectiveWeightReinit_PMLR_2026", "V97_SWR_CANDIDATE"),
        ),
        MechanismSpec(
            name="fast_slow_synaptic_consolidation",
            owner="recurrent_substrate",
            purpose="transfer stable online fast-synapse state into the matched slow readout synapse before clearing fast state",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("V126_CONSOLIDATION_RUNTIME" ,),
        ),
        MechanismSpec(
            name="input_dependent_channel_decay",
            owner="recurrent_substrate",
            purpose="candidate input-dependent per-channel retention that turns fixed decay into token-conditioned forgetting without adding a second recurrent owner",
            status="candidate",
            parameter_budget=520,
            evidence_refs=("GDN2_2026", "MAMBA3_ICLR2026", "V121_TOKEN_DECAY_ABLATION"),
        ),
        MechanismSpec(
            name="multiscale_temporal_decay",
            owner="recurrent_substrate",
            purpose="multiple short/medium/long retention timescales within one recurrent state via a fixed decay prior plus bounded learned residual",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("AGMP_2026", "HGRN2_2024", "V96_LONG_DELAY_QUALIFICATION"),
        ),
        MechanismSpec(
            name="replay_gradient_alignment",
            owner="replay_controller",
            purpose="latent-output gradient-alignment signal for selecting replay examples that support the live correction direction",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("Abbes_LLA2026", "V98_REPLAY_ALIGNMENT_QUALIFICATION"),
        ),
        MechanismSpec(
            name="selective_temporal_credit",
            owner="recurrent_substrate",
            purpose="parameter-free per-sample surprise-gated eligibility, reducing trajectory-wide credit broadcasting under mixed events",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("SelectiveEligibilityTraces_RLVR_2026", "V113_SELECTIVE_CREDIT"),
        ),
        MechanismSpec(
            name="temporal_credit_assignment",
            owner="recurrent_substrate",
            purpose="parameter-free online temporal credit through immediate, single/dual/adaptive/cascaded traces and optional event-specific fast synapses",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("EPROP_2020", "BrainTrace_NatureComms_2026", "TemporalCreditIsFree_2026", "CET_ICLR2026", "V106_TEMPORAL_CREDIT"),
        ),
        MechanismSpec(
            name="qed_erase_control",
            owner="recurrent_substrate",
            purpose="query-derived erasure orthogonal to key direction to reduce stale associative interference",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("QED_2026", "V106_ERASE_SWEEP"),
        ),
        MechanismSpec(
            name="uncertainty_aware_write",
            owner="recurrent_substrate",
            purpose="parameter-free channel-wise write reliability using residual-variance tracking; opt-in KDN/OSDN-inspired candidate",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("KDN_2026", "OSDN_2026", "V106_UNCERTAINTY_SWEEP"),
        ),
        MechanismSpec(
            name="independent_erase_address",
            owner="recurrent_substrate",
            purpose="query-addressed erase independent of key-addressed write, without a second memory owner",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("EDA_2026", "V106_ERASE_SWEEP"),
        ),
        MechanismSpec(
            name="gradient_update_alignment_probe",
            owner="training_controller",
            purpose="diagnose and optionally project the actual post-AdamW probe update against objective-gradient conflicts; candidate-only because optimizer state is not rewritten",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("GUA_2026", "V113_GRADIENT_ARBITRATION"),
        ),
        MechanismSpec(
            name="gradient_conflict_arbitration",
            owner="learning_controller",
            purpose="PCGrad-style conflict resolution among existing objective gradients on a bounded shared-parameter probe",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("PCGrad_2020", "SAGO_ACL2026", "V99_PCGRAD_QUALIFICATION"),
        ),
        MechanismSpec(
            name="gradient_subspace_protection",
            owner="plasticity_controller",
            purpose="low-rank GPM-inspired gradient projection that protects previously used representation subspaces from destructive updates",
            status="candidate",
            parameter_budget=0,
            evidence_refs=("GPM_ICLR2021", "SGP_AAAI2023", "TRGP_ICLR2022", "V98_GPM_SWEEP", "V98_FULL_CURRENT_QUALIFICATION"),
        ),
        MechanismSpec(
            name="sparse_utility_cache",
            owner="legacy_v88_replay_controller",
            purpose="historical replay utility cache preserved outside current execution",
            status="legacy",
            evidence_refs=("V88_GATE",),
        ),
    ]
)
