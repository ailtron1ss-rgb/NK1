from __future__ import annotations

import torch
from torch import Tensor, nn


class GatedDeltaCell(nn.Module):
    """Compact channel-wise erase/write recurrent memory.

    Inspired by gated-delta style memory updates, but implemented here as a
    small research cell rather than claiming equivalence to any published
    implementation. The key distinction from the v0.3 cell is that forgetting
    and writing are independently learned per channel.
    """

    def __init__(self, d_model: int, state_size: int | None = None):
        super().__init__()
        self.d_model = d_model
        self.state_size = state_size or d_model
        h = self.state_size
        self.input = nn.Linear(d_model, 3 * h)
        self.state_read = nn.Linear(h, 2 * h, bias=False)
        self.cand = nn.Linear(d_model + h, h)
        self.out = nn.Linear(h, d_model)
        self.norm = nn.LayerNorm(h)
        self.h0 = nn.Parameter(torch.zeros(h))

    def initial_state(self, batch_size: int, device=None, dtype=None) -> Tensor:
        return self.h0.to(device=device, dtype=dtype).expand(batch_size, -1).clone()

    def forward(self, x: Tensor, h: Tensor) -> tuple[Tensor, Tensor]:
        i_erase, i_write, i_gain = self.input(x).chunk(3, dim=-1)
        s_erase, s_write = self.state_read(h).chunk(2, dim=-1)
        erase = torch.sigmoid(i_erase + s_erase)
        write = torch.sigmoid(i_write + s_write)
        gain = torch.sigmoid(i_gain)
        candidate = torch.tanh(self.cand(torch.cat([x, h], dim=-1)))
        # Explicit erase then residual write. No hidden external memory.
        h_new = erase * h + write * gain * (candidate - h)
        h_new = self.norm(h_new)
        return self.out(h_new), h_new
