from __future__ import annotations

"""Stable canonical facade for partial-program value prediction."""

from .partial_program_value_v2 import PartialProgramValueV2, ValuePredictionV2, ValueFitReportV2

PartialProgramValue = PartialProgramValueV2
CANONICAL_SOURCE = "partial_program_value_v2"
VERSION = "partial-program-value-canonical-v1"

__all__ = ["PartialProgramValue", "PartialProgramValueV2", "ValuePredictionV2", "ValueFitReportV2", "CANONICAL_SOURCE", "VERSION"]
