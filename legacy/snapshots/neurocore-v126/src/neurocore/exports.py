from __future__ import annotations

from pathlib import Path
import torch
from torch import Tensor, nn

from .model import NeuroCoreModel


class ExportWrapper(nn.Module):
    """Tensor-only deployment surface.

    Dataclasses and Python dictionaries are intentionally kept outside the
    export boundary. This wrapper exposes only stable tensor outputs.
    """
    def __init__(self, model: NeuroCoreModel):
        super().__init__()
        self.model = model.eval()

    def forward(self, x: Tensor) -> tuple[Tensor, Tensor, Tensor]:
        out = self.model(x)
        return out.latent, out.predicted_next, out.route_logits


def export_torchscript(model: NeuroCoreModel, path: str | Path, d_model: int | None = None, time: int = 8) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    wrapper = ExportWrapper(model)
    example = torch.randn(1, time, d_model or model.d_model)
    traced = torch.jit.trace(wrapper, example, strict=False)
    traced.save(str(path))
    # Round-trip check proves the artifact can be loaded and invoked.
    loaded = torch.jit.load(str(path))
    with torch.no_grad():
        y = loaded(example)
    if not isinstance(y, tuple) or len(y) != 3:
        raise RuntimeError("exported artifact failed tensor-only output contract")
    return path
try:
    from .v37 import (V37Config, V37State, NeuroWeaveV37, OrganismTrainerV37,
                      RuntimeStateStoreV37, LiveOrganismV37, mobile_v37_config,
                      AutobiographicalIndexV37, TaskTransferV37, PlanImproverV37)
except Exception:
    V37Config=V37State=NeuroWeaveV37=OrganismTrainerV37=RuntimeStateStoreV37=LiveOrganismV37=None
    mobile_v37_config=AutobiographicalIndexV37=TaskTransferV37=PlanImproverV37=None
