from .contracts import CURRENT_ENGINE_VERSION, CURRENT_SCHEMA_VERSION, CurrentCheckpointEnvelope, TargetContract
from .causal_trunk import CausalTrunkConfig, CausalTrunk
from .core import (
    CurrentConfig,
    NeuroCoreCurrent,
    OrganismRuntimeCurrent,
    OrganismTrainerCurrent,
    RuntimeStateStoreCurrent,
    mobile_current_config,
)
from .neural_spine import UnifiedAssociativeSpine
from .registry import DEFAULT_REGISTRY, MechanismRegistry, MechanismSpec
from .upstream import UpstreamBackendCatalog, UpstreamBackendSpec, inspect_constructor, make_upstream_backend
from .upstream_adapter import SequenceModuleAdapter
from .neural_lifecycle import NeuralLifecycleConfig, NeuralLifecycleController
from .adaptive_compute import AdaptiveComputeConfig, difficulty_score, choose_deep, deep_fraction
from .online_plasticity import ThreeFactorPlasticityConfig, ThreeFactorFastWeight
from .temporal_dynamics import MultiTimescaleConfig, decay_prior_logit, effective_decay
from .adaptive_linearity import AdaptiveLinearityConfig, AdaptiveLinearity
from .fast_consolidation import FastSlowConsolidationConfig, consolidate_fast_weight
from .weight_regeneration import SelectiveWeightRegenerationConfig, SelectiveWeightRegenerator
from .gradient_subspace import GradientSubspaceConfig, GradientSubspaceGuard
from .gradient_arbitration import GradientArbitrationConfig, GradientArbitrator
from .temporal_credit import TemporalCreditConfig, select_eligibility, update_trace, update_cascade_trace
from .erase_control import EraseControlConfig, apply_erase, orthogonal_address
from .uncertainty_write import UncertaintyWriteConfig, UncertaintyAwareWrite
from .hippo_credit import HiPPOCreditConfig, HiPPOHistory
from .unified_sparse_memory import UnifiedSparseMemoryConfig, UnifiedSparseAssociativeMemory
from .data_target import DataGroundedTargetConfig, DataGroundedTarget
from .execution_profile import ExecutionProfiler, ModuleExecutionStat, gradient_coverage
from .learning_core import LearningCoreConfig, LearningCoreController, LearningPlan
from .mamba3_candidate import heavy_tail_activation, Mamba3Candidate, Mamba3CandidateConfig
from .kda_attention import KDAAttention, KDAConfig
from .gdn2_candidate import GDN2Config, GatedDeltaNet2Candidate
from .rwkv7_goose import RWKV7GooseLayer
from .native_sparse_attention import NativeSparseAttention
from .ttt_layer import TestTimeTrainingLayer
from .mlstm_candidate import MLSTMConfig, MLSTMCandidate, MLSTMState
from .sequence_backend import SequenceBackend, StatefulModule, SequenceEngine, SequenceRunReport, SequenceChunkPlan, make_chunk_plan, run_steps, run_chunked, run_prefill, run_decode, run_decode_many, run_optimized, compare_outputs, state_nbytes, sequence_capabilities
from .sparse_routing import SparseExpertRouter, MoBABlockSelector, normalized_entropy
from .frontier_stack import FrontierIntegrationStack, FrontierStackConfig
from .mobile_profile import MobileExecutionBudget, MobileTier, MOBILE_TIERS, choose_mobile_tier, validate_mobile_budget
from .context_parallel import ContextParallelPlan
from .fused_loss import FusedLinearCrossEntropyLoss
from .plasticity import PlasticityConfig, PlasticityMonitor, effective_rank, feature_rank_regularizer
from .qualification_gate import QualificationThresholds, QualificationDecision, evaluate_candidate, apply_decision
from .decontamination import DecontaminationManager, DecontaminationRecord, validate_no_inert_enabled_features, validate_registry_truthfulness, runtime_liveness_probe, source_duplicate_method_scan, validate_registry_versioned_current_names, validate_causal_config_field_usage, validate_current_version_metadata, validate_research_only_surface, validate_current_package_boundary

__all__ = [
    "CURRENT_ENGINE_VERSION",
    "CURRENT_SCHEMA_VERSION",
    "CurrentCheckpointEnvelope",
    "TargetContract",
    "CausalTrunkConfig",
    "CausalTrunk",
    "CurrentConfig",
    "NeuroCoreCurrent",
    "OrganismRuntimeCurrent",
    "OrganismTrainerCurrent",
    "RuntimeStateStoreCurrent",
    "mobile_current_config",
    "UnifiedAssociativeSpine",
    "DEFAULT_REGISTRY",
    "MechanismRegistry",
    "MechanismSpec",
    "UpstreamBackendCatalog",
    "UpstreamBackendSpec",
    "inspect_constructor",
    "make_upstream_backend",
    "SequenceModuleAdapter",
    "NeuralLifecycleConfig",
    "NeuralLifecycleController",
    "AdaptiveComputeConfig",
    "difficulty_score",
    "choose_deep",
    "deep_fraction",
    "ThreeFactorPlasticityConfig",
    "ThreeFactorFastWeight",
    "MultiTimescaleConfig",
    "decay_prior_logit",
    "effective_decay",
    "AdaptiveLinearityConfig",
    "AdaptiveLinearity",
    "FastSlowConsolidationConfig",
    "consolidate_fast_weight",
    "SelectiveWeightRegenerationConfig",
    "SelectiveWeightRegenerator",
    "GradientSubspaceConfig",
    "GradientSubspaceGuard",
    "GradientArbitrationConfig",
    "GradientArbitrator",
    "LearningCoreConfig",
    "LearningCoreController",
    "LearningPlan",
    "TemporalCreditConfig",
    "select_eligibility",
    "update_trace",
    "update_cascade_trace",
    "EraseControlConfig",
    "apply_erase",
    "orthogonal_address",
    "UncertaintyWriteConfig",
    "UncertaintyAwareWrite",
    "HiPPOCreditConfig",
    "HiPPOHistory",
    "UnifiedSparseMemoryConfig",
    "UnifiedSparseAssociativeMemory",
    "DataGroundedTargetConfig",
    "DataGroundedTarget",
    "heavy_tail_activation",
    "Mamba3Candidate",
    "Mamba3CandidateConfig",
    "KDAAttention",
    "KDAConfig",
    "GDN2Config",
    "GatedDeltaNet2Candidate",
    "RWKV7GooseLayer",
    "NativeSparseAttention",
    "TestTimeTrainingLayer",
    "SparseExpertRouter",
    "MoBABlockSelector",
    "normalized_entropy",
    "MLSTMConfig",
    "MLSTMCandidate",
    "MLSTMState",
    "SequenceBackend",
    "StatefulModule",
    "SequenceEngine",
    "SequenceRunReport",
    "SequenceChunkPlan",
    "make_chunk_plan",
    "run_steps",
    "run_chunked",
    "run_prefill",
    "run_decode",
    "run_decode_many",
    "run_optimized",
    "compare_outputs",
    "state_nbytes",
    "sequence_capabilities",
    "FrontierIntegrationStack",
    "FrontierStackConfig",
    "MobileExecutionBudget",
    "MobileTier",
    "MOBILE_TIERS",
    "choose_mobile_tier",
    "validate_mobile_budget",
    "MobileDeviceSnapshot",
    "MobileBenchmarkConfig",
    "MobileBenchmarkResult",
    "snapshot_device",
    "benchmark_model",
    "quantization_audit",
    "android_backend_policy",
    "export_benchmark_json",
    "AdaptiveFrontierBudgetController",
    "AdaptiveFrontierDecision",
    "MobileExportSpec",
    "MobileExportStateCodec",
    "MobileExportStep",
    "MobileExportSequence",
    "build_mobile_export_adapter",
    "export_mobile_programs",
    "ByteTextConfig",
    "UTF8ByteCodec",
    "ByteRoleFeatures",
    "ByteTextEncoder",
    "ByteLanguageModel",
    "causal_text_pairs",
    "build_byte_language_model",
    "ByteLanguageStream",
    "ByteLanguageStreamCheckpoint",
    "ContextParallelPlan",
    "FusedLinearCrossEntropyLoss",
    "validate_no_inert_enabled_features",
    "validate_registry_truthfulness",
    "runtime_liveness_probe",
    "source_duplicate_method_scan",
    "validate_registry_versioned_current_names",
    "validate_causal_config_field_usage",
    "validate_current_version_metadata",
    "validate_research_only_surface",
    "DecontaminationManager",
    "DecontaminationRecord",
    "DeltaIntegratorConfig",
    "exact_linear_step",
    "online_learning_e2e_probe",
    "long_horizon_fast_credit",
    "multi_event_isolation",
    "trunk_profile",
    "surprise_write_probe",
    "hippo_credit_probe",
    "sparse_product_key_probe",
    "sparse_delta_memory_probe",
    "unified_sparse_memory_probe",
    "unified_sparse_memory_isolation_probe",
    "unified_sparse_memory_abi_probe",
    "unified_sparse_memory_retention_ablation",
    "sparse_memory_collision_probe",
    "mlstm_reference_probe",
"learned_long_term_memory_probe",
"learned_long_term_memory_capacity_probe",
"learned_long_term_memory_checkpoint_probe",
"learned_long_term_memory_background_probe",
"unified_sparse_long_memory_probe",
"learned_long_term_memory_promotion_gate",
"learned_long_term_memory_overwrite_probe",
"learned_long_term_memory_replay_probe",
    "validate_current_package_boundary",
    "PlasticityConfig",
    "PlasticityMonitor",
    "effective_rank",
    "feature_rank_regularizer",
    "QualificationThresholds",
    "QualificationDecision",
    "evaluate_candidate",
    "apply_decision",
]

from .delta_integrator import DeltaIntegratorConfig, exact_linear_step
from .qualification import online_learning_e2e_probe, long_horizon_fast_credit, multi_event_isolation, trunk_profile, surprise_write_probe, hippo_credit_probe, sparse_product_key_probe, sparse_delta_memory_probe, unified_sparse_memory_probe, unified_sparse_memory_isolation_probe, unified_sparse_memory_abi_probe, unified_sparse_memory_retention_ablation, sparse_memory_collision_probe, mlstm_reference_probe, learned_long_term_memory_probe, learned_long_term_memory_capacity_probe, learned_long_term_memory_checkpoint_probe, learned_long_term_memory_background_probe, unified_sparse_long_memory_probe, learned_long_term_memory_promotion_gate, learned_long_term_memory_overwrite_probe, learned_long_term_memory_replay_probe, unified_memory_end_to_end_probe
from .mobile_runtime import MobileDeviceSnapshot, MobileBenchmarkConfig, MobileBenchmarkResult, snapshot_device, benchmark_model, quantization_audit, android_backend_policy, export_benchmark_json
from .mobile_adaptation import AdaptiveFrontierBudgetController, AdaptiveFrontierDecision
from .mobile_export import MobileExportSpec, MobileExportStateCodec, MobileExportStep, MobileExportSequence, build_mobile_export_adapter, export_mobile_programs
from .text_interface import ByteTextConfig, UTF8ByteCodec, ByteRoleFeatures, ByteTextEncoder, ByteLanguageModel, causal_text_pairs, build_byte_language_model, ByteLanguageStream, ByteLanguageStreamCheckpoint
