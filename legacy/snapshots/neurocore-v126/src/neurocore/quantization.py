from __future__ import annotations
import copy
import torch
from torch import Tensor, nn


def symmetric_fake_quant(x: Tensor, bits: int = 8) -> Tensor:
    if bits < 2 or bits > 8:
        raise ValueError('bits must be in [2,8]')
    qmax = float(2 ** (bits - 1) - 1)
    scale = x.detach().abs().amax().clamp_min(1e-8) / qmax
    q = torch.clamp(torch.round(x / scale), -qmax - 1, qmax)
    return x + (q * scale - x).detach()


class FakeQuantLinear(nn.Module):
    def __init__(self, src: nn.Linear, bits: int = 8):
        super().__init__()
        self.in_features = src.in_features
        self.out_features = src.out_features
        self.bits = bits
        self.weight = nn.Parameter(src.weight.detach().clone())
        self.bias = nn.Parameter(src.bias.detach().clone()) if src.bias is not None else None

    def forward(self, x: Tensor) -> Tensor:
        w = symmetric_fake_quant(self.weight, self.bits)
        return torch.nn.functional.linear(x, w, self.bias)


def quantized_clone(model: nn.Module, bits: int = 8) -> nn.Module:
    """Research-only weight fake-quant clone; does not claim hardware quantization."""
    out = copy.deepcopy(model)
    replaced = 0
    for parent in out.modules():
        for name, child in list(parent.named_children()):
            if isinstance(child, nn.Linear):
                setattr(parent, name, FakeQuantLinear(child, bits=bits))
                replaced += 1
    out._fake_quant_linear_count = replaced
    return out
