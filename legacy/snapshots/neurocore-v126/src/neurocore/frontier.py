"""Stable import surface for the current NeuroCore architecture."""
from __future__ import annotations

import importlib
import re
from typing import Any

from .version import CURRENT_ENGINE_VERSION, CURRENT_RELEASE_VERSION

CURRENT_FRONTIER = CURRENT_RELEASE_VERSION

_CURRENT = {
    "CausalTrunkConfig", "CausalTrunk",
    "CurrentConfig", "mobile_current_config", "NeuroCoreCurrent",
    "OrganismTrainerCurrent", "OrganismRuntimeCurrent", "RuntimeStateStoreCurrent",
    "UnifiedAssociativeSpine", "NeuralLifecycleConfig", "NeuralLifecycleController",
    "AdaptiveComputeConfig", "ThreeFactorPlasticityConfig", "ThreeFactorFastWeight",
    "MultiTimescaleConfig", "AdaptiveLinearityConfig", "AdaptiveLinearity",
    "FastSlowConsolidationConfig", "consolidate_fast_weight",
    "SelectiveWeightRegenerationConfig", "SelectiveWeightRegenerator",
    "ReplayInfluenceConfig", "GradientArbitrationConfig", "GradientArbitrator",
    "cosine_loss_output_gradient", "replay_gradient_alignment",
    "TemporalCreditConfig", "select_eligibility", "update_trace", "update_cascade_trace",
    "EraseControlConfig", "apply_erase", "orthogonal_address",
    "UncertaintyWriteConfig", "UncertaintyAwareWrite",
    "HiPPOCreditConfig", "HiPPOHistory",
    "ProductKeyMemoryConfig", "ProductKeySparseMemory", "ProductKeySparseDeltaMemory", "heavy_tail_activation",
    "hippo_credit_probe", "sparse_product_key_probe", "sparse_delta_memory_probe", "unified_sparse_memory_probe", "unified_sparse_memory_isolation_probe", "sparse_memory_collision_probe", "long_horizon_fast_credit", "multi_event_isolation", "trunk_profile", "surprise_write_probe",
    "ExecutionProfiler", "ModuleExecutionStat", "gradient_coverage",
    "UnifiedSparseMemoryConfig", "UnifiedSparseAssociativeMemory",
    "DataGroundedTargetConfig", "DataGroundedTarget",
}

__all__ = ["CURRENT_FRONTIER", "CURRENT_ENGINE_VERSION", *_CURRENT]


def __getattr__(name: str) -> Any:
    if name in _CURRENT:
        module = importlib.import_module(".current", __package__)
        return getattr(module, name)
    match = re.search(r"V(\d+)(?:\b|_)", name)
    if match is None:
        match = re.search(r"_v(\d+)(?:\b|_)", name, flags=re.IGNORECASE)
    if match:
        version = int(match.group(1))
        module = importlib.import_module(f".v{version}", __package__)
        try:
            return getattr(module, name)
        except AttributeError as exc:
            raise AttributeError(name) from exc
    raise AttributeError(name)
