from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import torch

from neurocore.current import NeuroCoreCurrent, OrganismTrainerCurrent, RuntimeStateStoreCurrent


def test_v106_checkpoint_roundtrip_and_v99_envelope_compatibility(tmp_path: Path) -> None:
    model = NeuroCoreCurrent()
    trainer = OrganismTrainerCurrent(model)
    path = tmp_path / "v106.pt"
    RuntimeStateStoreCurrent.save(path, model, trainer=trainer)
    restored = NeuroCoreCurrent()
    restored_trainer = OrganismTrainerCurrent(restored)
    result = RuntimeStateStoreCurrent.load(path, restored, trainer=restored_trainer)
    assert result["loaded_tensors"] == len(model.state_dict())
    assert result["missing_tensors"] == []
    assert result["unexpected_tensors"] == []
    assert result["optimizer_loaded"] is True
    assert result["current_neural_version"] == 106


def test_v99_envelope_is_reported_as_legacy_without_breaking_current_load(tmp_path: Path) -> None:
    model = NeuroCoreCurrent()
    state = model.state_dict()
    path = tmp_path / "v99-legacy.pt"
    torch.save(
        {
            "current_schema_version": 11,
            "current_neural_version": 99,
            "engine_source_version": 88,
            "model": state,
        },
        path,
    )
    restored = NeuroCoreCurrent()
    result = RuntimeStateStoreCurrent.load(path, restored)
    assert result["current_neural_version"] == 99
    assert result["loaded_tensors"] > 0
