from __future__ import annotations

import torch
import pytest

from neurocore.current import (
    NeuroCoreCurrent,
    OrganismTrainerCurrent,
    RuntimeStateStoreCurrent,
)


def test_current_surface_is_composition_root() -> None:
    model = NeuroCoreCurrent()
    assert model.engine.__class__.__name__ == "NeuroWeaveV88"
    assert not issubclass(NeuroCoreCurrent, model.engine.__class__)
    manifest = model.current_manifest()
    assert manifest["mechanisms"]["sparse_utility_cache"]["status"] == "integrated"


def test_target_contract_rejects_wrong_time_axis() -> None:
    model = NeuroCoreCurrent()
    x = torch.randn(2, 3, 9)
    bad = torch.randn(2, 3, model.cfg.engine.latent_dim_v46)
    # B,T,L would be accepted only if T == T-1, which is impossible here.
    with pytest.raises(ValueError, match="target_latent_sequence"):
        model.forward_learning(x, target_latent_sequence=bad)


def test_current_training_and_checkpoint(tmp_path) -> None:
    torch.manual_seed(0)
    model = NeuroCoreCurrent()
    trainer = OrganismTrainerCurrent(model)
    x = torch.randn(2, 2, 9)
    goals = torch.randn(2, 2, model.cfg.engine.goal_dim)
    target = torch.randn(2, 1, model.cfg.engine.latent_dim_v46)
    log = trainer.learning_step(x, goals, target_latent_sequence=target)
    assert "loss" in log
    path = tmp_path / "current.pt"
    RuntimeStateStoreCurrent.save(path, model, trainer=trainer)
    restored = NeuroCoreCurrent()
    restored_trainer = OrganismTrainerCurrent(restored)
    loaded = RuntimeStateStoreCurrent.load(path, restored, trainer=restored_trainer)
    assert loaded["loaded_tensors"] > 0
    assert loaded["optimizer_loaded"] is True
