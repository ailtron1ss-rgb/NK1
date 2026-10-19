from __future__ import annotations

"""Canonical repair facade backed by the verified v2 implementation."""

from .neural_program_repair_v2 import NeuralProgramRepairV2, RepairResultV2

NeuralProgramRepair = NeuralProgramRepairV2
RepairResult = RepairResultV2

__all__ = ["NeuralProgramRepair", "RepairResult", "NeuralProgramRepairV2", "RepairResultV2"]
