from __future__ import annotations
"""Canonical experiment registry facade backed by V3 provenance records."""

from .experiment_registry_v3 import ExperimentRegistryV3

ExperimentRegistry = ExperimentRegistryV3
CANONICAL_SOURCE = "experiment_registry_v3"
VERSION = "experiment-registry-canonical-v1"

__all__ = ["ExperimentRegistry", "ExperimentRegistryV3", "CANONICAL_SOURCE", "VERSION"]
