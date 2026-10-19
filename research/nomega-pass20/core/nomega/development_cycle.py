from __future__ import annotations

"""Stable canonical facade for the development-cycle capability."""

from .development_cycle_v9 import OmegaDevelopmentCycleV9

OmegaDevelopmentCycle = OmegaDevelopmentCycleV9
CANONICAL_SOURCE = "development_cycle_v9"
VERSION = "development-cycle-canonical-v1"

__all__ = ["OmegaDevelopmentCycle", "OmegaDevelopmentCycleV9", "CANONICAL_SOURCE", "VERSION"]
