from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Dict

@dataclass
class NOMEGAConfig:
    # Shared state / model shape
    latent_dim: int = 96
    workspace_slots: int = 8
    max_reason_steps: int = 6
    min_reason_steps: int = 1
    num_experts: int = 8
    top_k: int = 2
    router_hidden: int = 64
    memory_dim: int = 96
    memory_capacity: int = 512
    retrieval_k: int = 4

    # Decision thresholds
    confidence_threshold: float = 0.68
    verify_threshold: float = 0.55
    abstain_threshold: float = 0.42

    # Compute / mobile budgets
    default_compute_budget: float = 1.0
    max_compute_budget: float = 4.0
    target_latency_ms: float = 1200.0
    target_energy_proxy_mj: float = 2200.0
    max_candidates: int = 4
    max_program_len: int = 128

    # Features
    enable_symbolic: bool = True
    enable_neural_invent: bool = True
    enable_adaptive_depth: bool = True
    enable_memory: bool = True
    enable_verifier: bool = True
    enable_planner: bool = True
    enable_dual_runtime: bool = True
    enable_reasoning_audit: bool = True
    enable_dynamic_budget: bool = True
    experimental_predictive_workspace: bool = True
    enable_verified_cache: bool = True
    cache_capacity: int = 256
    enable_working_memory: bool = True
    working_memory_slots: int = 8
    enable_skill_bank: bool = True
    enable_skill_expert: bool = True
    skill_capacity: int = 256
    enable_expert_governance: bool = True
    enable_world_model: bool = True
    world_model_hidden: int = 96
    enable_tool_planning: bool = True
    enable_self_improvement: bool = True
    max_tool_calls: int = 4
    max_total_trace_items: int = 64
    cache_verified_only: bool = True
    safety_regression_tolerance: float = 0.05
    safety_expert_floor: bool = True

    # NΩ 0.8 research stack
    enable_universal_latent: bool = True
    enable_attention_memory: bool = True
    attention_memory_capacity: int = 256
    enable_self_model: bool = True
    enable_skill_compiler: bool = True
    enable_advanced_telemetry: bool = True
    enable_evolution_controller: bool = True
    enable_latent_alignment: bool = False
    enable_quantization_lab: bool = True
    research_mode: bool = True
    # NΩ 0.9 research brain
    enable_research_brain: bool = True
    enable_skill_graph_v2: bool = True
    enable_self_play_v2: bool = True
    enable_continual_v2: bool = True
    enable_mobile_compiler_v2: bool = True
    research_brain_influence: float = 0.0

    # NΩ 1.0 adaptive generalist
    enable_adaptive_generalist: bool = True
    generalist_hidden: int = 96
    generalist_vocab: int = 2048
    generalist_actions: int = 8
    generalist_influence: float = 0.0
    generalist_checkpoint: str = ""
    enable_prioritized_replay: bool = True
    replay_capacity: int = 2048
    enable_ewc: bool = True
    ewc_strength: float = 0.08

    # Learning / safety
    seed: int = 41
    bootstrap_routing: bool = True
    min_route_margin: float = 0.05
    reward_cost_weight: float = 0.10
    reward_verification_weight: float = 0.75
    reward_efficiency_weight: float = 0.15
    allow_unverified_answers: bool = False
    promotion_min_gain: float = 0.01

    # NΩ frontier 1.1 research stack
    enable_trace_learning_v2: bool = True
    enable_counterfactual_v2: bool = True
    enable_skill_versioning: bool = True
    enable_frontier_evaluation: bool = True
    enable_mobile_benchmark_v3: bool = True
    enable_project_audit_v2: bool = True
    frontier_train_steps: int = 32
    frontier_holdout_per_family: int = 4
    frontier_adversarial_per_family: int = 2
    trace_capacity: int = 4096
    skill_regression_tolerance: float = 0.05


    # NΩ 1.2 integrated development stack
    enable_joint_learning_v2: bool = True
    enable_memory_v2: bool = True
    enable_world_model_v2: bool = True
    enable_multimodal_grounding_v2: bool = True
    enable_mobile_optimizer_v4: bool = True
    omega12_train_steps: int = 12
    omega12_train_per_family: int = 4
    omega12_holdout_per_family: int = 3
    omega12_adversarial_per_family: int = 2
    omega12_candidate_only: bool = True


    # NΩ 1.3 research architecture
    enable_sparse_moe_v1: bool = True
    sparse_moe_experts: int = 4
    sparse_moe_influence: float = 0.0
    enable_hybrid_reasoner_v2: bool = True
    hybrid_reasoner_influence: float = 0.0
    hybrid_reasoner_steps: int = 2
    enable_skill_transfer_v2: bool = True
    enable_uncertainty_suite_v2: bool = True
    enable_experiment_registry_v2: bool = True
    enable_production_guard_v2: bool = True
    # NΩ 1.20 canonical executable spine + governed self-evolution
    enable_executable_spine_v2: bool = True
    # Canonical neural program proposer; proposals are always independently executed/verified.
    enable_canonical_neural_program: bool = True
    canonical_neural_program_checkpoint: str = ""
    canonical_neural_program_hidden: int = 32
    canonical_neural_program_max_len: int = 24
    enable_self_evolution_lab_v1: bool = True
    executable_spine_candidates: int = 6
    enable_counterexample_refinement_v2: bool = True
    self_evolution_trials: int = 6


    # NΩ 1.3 unified learning stack
    enable_unified_learning_v3: bool = True
    enable_world_model_v3: bool = True
    enable_skill_transfer_v3: bool = True
    enable_multimodal_v3: bool = True
    enable_mobile_optimizer_v5: bool = True
    unified_train_steps: int = 8
    unified_train_per_family: int = 3
    unified_holdout_per_family: int = 3
    unified_adversarial_per_family: int = 2
    unified_candidate_only: bool = True

    # Mobile runtime state
    ram_gb: float = 4.0
    has_npu: bool = False

    @classmethod
    def mobile(cls, ram_gb: float = 4.0, has_npu: bool = False):
        return cls(latent_dim=48, router_hidden=32, memory_dim=48, top_k=1, max_reason_steps=3, ram_gb=ram_gb, has_npu=has_npu, max_candidates=3, working_memory_slots=4)

    @classmethod
    def balanced(cls, ram_gb: float = 6.0, has_npu: bool = False):
        return cls(latent_dim=64, router_hidden=48, memory_dim=64, top_k=2, max_reason_steps=4, ram_gb=ram_gb, has_npu=has_npu, max_candidates=4)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
