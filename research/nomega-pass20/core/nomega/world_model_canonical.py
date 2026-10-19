from __future__ import annotations

"""Stable canonical facade for the current ensemble world-model implementation."""

from .world_model_v3 import WorldModelV3, WorldModelTrainerV3, EnsembleRollout, DynamicsMember

WorldModel = WorldModelV3
WorldModelTrainer = WorldModelTrainerV3
CANONICAL_SOURCE = "world_model_v3"
VERSION = "world-model-canonical-v1"

__all__ = ["WorldModel", "WorldModelV3", "WorldModelTrainer", "WorldModelTrainerV3", "EnsembleRollout", "DynamicsMember", "CANONICAL_SOURCE", "VERSION"]
