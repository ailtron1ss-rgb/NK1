import torch
from dataclasses import replace

from neurocore.current import NeuroCoreCurrent, TemporalCreditConfig, UncertaintyWriteConfig


def test_all_temporal_credit_modes_are_reportable() -> None:
    for mode in ("single", "immediate", "dual", "adaptive", "cascade", "event_bank"):
        cfg = replace(NeuroCoreCurrent().cfg, temporal_credit=TemporalCreditConfig(enabled=True, mode=mode))
        report = NeuroCoreCurrent(cfg).learning_parameter_report()
        assert report["temporal_credit_mode"] > 0.0


def test_uncertainty_candidate_is_parameter_free_in_spine() -> None:
    cfg = replace(NeuroCoreCurrent().cfg, uncertainty_write=UncertaintyWriteConfig(enabled=True))
    model = NeuroCoreCurrent(cfg)
    assert sum(p.numel() for p in model.spine.uncertainty_write_controller.parameters()) == 0
    x = torch.randn(2, model.spine.feature_dim)
    out = model.spine.step(x)
    assert torch.isfinite(out["state"]).all()
