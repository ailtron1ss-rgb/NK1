from __future__ import annotations
"""Canonical mobile-optimization facade backed by the Pareto V6 implementation."""

from .mobile_optimizer_v6 import MobileOptimizerV6, MobileConfig, CONFIGS

MobileOptimizer = MobileOptimizerV6
CANONICAL_SOURCE = "mobile_optimizer_v6"
VERSION = "mobile-optimizer-canonical-v1"

__all__ = ["MobileOptimizer", "MobileOptimizerV6", "MobileConfig", "CONFIGS", "CANONICAL_SOURCE", "VERSION"]
