from pathlib import Path
import tempfile
import torch

from neurocore.frontier import CURRENT_FRONTIER
from neurocore.v79 import (
    NeuroWeaveV79, OrganismRuntimeV79, OrganismTrainerV79,
    RuntimeStateStoreV79, mobile_v79_config, ContinualMetricsV79,
)


def test_v79_surface_and_single_owner():
    m = NeuroWeaveV79(mobile_v79_config(9))
    assert CURRENT_FRONTIER >= 79
    assert m.neural_memory_v61 is m.neural_memory_v78
    assert sum(p.numel() for p in m.parameters()) < 390_000


def test_v79_strategy_surface_has_four_modes():
    m = NeuroWeaveV79(mobile_v79_config(9))
    t = OrganismTrainerV79(m, lr=4e-4, warmup_steps=1)
    x = torch.randn(8, 54)
    y = torch.randn(8, 20)
    for name in ("naive", "fixed_replay", "agem", "v78_guard"):
        out = t.continual_step_v79(x, y, strategy=name)
        assert torch.isfinite(torch.tensor(out["current_loss"]))


def test_v79_metrics_backward_transfer_and_forgetting():
    m = ContinualMetricsV79()
    m.record_stage([0.8, float("nan"), float("nan")])
    m.record_stage([0.7, 0.75, float("nan")])
    m.record_stage([0.6, 0.72, 0.8])
    assert m.backward_transfer() < 0.0
    assert m.average_forgetting() > 0.0


def test_v79_runtime_and_checkpoint():
    m = NeuroWeaveV79(mobile_v79_config(9))
    runtime = OrganismRuntimeV79(m)
    trainer = OrganismTrainerV79(m, lr=4e-4, warmup_steps=1)
    out = runtime.step(torch.randn(9))
    assert all(torch.isfinite(v).all() for v in out.values() if torch.is_tensor(v))
    path = Path(tempfile.gettempdir()) / "neurocore_v79_roundtrip.pt"
    RuntimeStateStoreV79.save(path, m, trainer=trainer, runtime=runtime)
    m2 = NeuroWeaveV79(mobile_v79_config(9))
    t2 = OrganismTrainerV79(m2, lr=4e-4, warmup_steps=1)
    r2 = OrganismRuntimeV79(m2)
    result = RuntimeStateStoreV79.load(path, m2, trainer=t2, runtime=r2)
    assert result["version"] == 79
    assert not result["shape_mismatch"]
    path.unlink(missing_ok=True)
