from __future__ import annotations

import torch

from neurocore.current import NeuroCoreCurrent, OrganismRuntimeCurrent


def test_v110_stream_runtime_matches_sequence_path() -> None:
    torch.manual_seed(1110)
    model_seq = NeuroCoreCurrent().eval()
    model_rt = NeuroCoreCurrent().eval()
    model_rt.load_state_dict(model_seq.state_dict())
    x = torch.randn(1, 3, 9)
    g = torch.randn(1, 3, 8)
    seq = model_seq(x, g)
    rt = OrganismRuntimeCurrent(model_rt)
    rows = [rt.step(x[:, i], g[:, i]) for i in range(3)]
    latents = torch.cat([r["latent"] for r in rows], dim=0).unsqueeze(0)
    assert torch.allclose(seq["latent"], latents, atol=1e-6, rtol=1e-6)
    assert torch.allclose(rt.prev_latent, seq["latent"][:, -1], atol=1e-6, rtol=1e-6)
