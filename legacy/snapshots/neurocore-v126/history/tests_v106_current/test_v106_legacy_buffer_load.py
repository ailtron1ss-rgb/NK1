from pathlib import Path
import torch

from neurocore.current import NeuroCoreCurrent, RuntimeStateStoreCurrent


def test_v105_like_checkpoint_without_new_buffers_reports_explicit_reset(tmp_path: Path) -> None:
    model = NeuroCoreCurrent()
    # Simulate V105: old cascade had fewer stages, and uncertainty controller did not exist.
    state = {k: v for k, v in model.state_dict().items() if "uncertainty_write_controller" not in k}
    state["engine.unified_spine_v80.online_plasticity.eligibility_cascade"] = torch.zeros(5, model.spine.hidden)
    path = tmp_path / "legacy-v105.pt"
    torch.save({"current_schema_version": 18, "current_neural_version": 105, "engine_source_version": 88, "model": state}, path)
    restored = NeuroCoreCurrent()
    result = RuntimeStateStoreCurrent.load(path, restored)
    assert result["current_neural_version"] == 105
    assert result["loaded_tensors"] > 0
    assert result["incompatible_state_reset"] >= 1
    assert torch.isfinite(restored.spine.uncertainty_write_controller.residual_variance).all()
