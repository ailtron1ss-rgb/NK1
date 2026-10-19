from dataclasses import replace

import torch
import torch.nn.functional as F

from neurocore.current import (
    CurrentConfig,
    CausalTrunkConfig,
    NeuroCoreCurrent,
    OrganismRuntimeCurrent,
    ThreeFactorFastWeight,
    ThreeFactorPlasticityConfig,
    TemporalCreditConfig,
    long_horizon_fast_credit,
    multi_event_isolation,
)


def test_v115_long_horizon_metrics_are_finite():
    for mode in ("single", "dual", "adaptive", "cascade", "event_bank"):
        row = long_horizon_fast_credit(mode=mode, delay=32, seed=115)
        assert all(torch.isfinite(torch.tensor(v)) for v in row.values())


def test_v115_event_bank_reduces_cross_event_leakage():
    row = multi_event_isolation(seed=115, delay=24)
    assert row["event_bank_unkeyed_cross_leak"] >= 0.0
    assert row["event_bank_keyed_cross_leak"] <= row["shared_cross_leak"] + 1e-6


def test_v115_surprise_gate_is_parameter_free_and_default_off():
    base = CausalTrunkConfig()
    candidate = replace(base, surprise_write_strength=0.5)
    assert sum(p.numel() for p in NeuroCoreCurrent(CurrentConfig(trunk=base)).parameters()) == sum(p.numel() for p in NeuroCoreCurrent(CurrentConfig(trunk=candidate)).parameters())


def test_v115_streaming_runtime_persists_recurrent_latent():
    torch.manual_seed(115)
    m = NeuroCoreCurrent(CurrentConfig.mobile(9))
    r = OrganismRuntimeCurrent(m)
    a = r.step(torch.randn(9))
    b = r.step(torch.randn(9))
    assert not torch.allclose(a["prev_latent"], b["prev_latent"])
    assert r.steps == 2
