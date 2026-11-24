from __future__ import annotations

import json
import sys
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from neurocore.current import NeuroCoreCurrent

LOSS_KEYS = (
    "memory_loss", "predictive_loss", "world_loss", "spine_loss",
    "self_loss", "multiscale_loss", "confidence_loss", "temporal_loss",
)

def flat_grad(model: torch.nn.Module) -> torch.Tensor:
    parts = []
    for p in model.parameters():
        if not p.requires_grad:
            continue
        parts.append(torch.zeros_like(p).reshape(-1) if p.grad is None else p.grad.detach().reshape(-1))
    return torch.cat(parts)

def cosine(a: torch.Tensor, b: torch.Tensor) -> float:
    return float(torch.nn.functional.cosine_similarity(a.unsqueeze(0), b.unsqueeze(0), dim=-1, eps=1e-8).item())

def main() -> int:
    torch.manual_seed(108)
    model = NeuroCoreCurrent().train()
    x = torch.randn(4, 20, 9)
    goals = torch.randn(4, 20, 8)
    target = torch.randn(4, 19, 20)
    out = model.forward_learning(x, goals, target_latent_sequence=target)

    vectors: dict[str, torch.Tensor] = {}
    coverage: dict[str, float] = {}
    norms: dict[str, float] = {}
    for key in LOSS_KEYS:
        model.zero_grad(set_to_none=True)
        out[key].backward(retain_graph=True)
        g = flat_grad(model)
        vectors[key] = g
        norms[key] = float(g.norm().item())
        coverage[key] = float((g.abs() > 1e-10).to(torch.float32).mean().item())

    pairwise = {}
    for i, a in enumerate(LOSS_KEYS):
        for b in LOSS_KEYS[i + 1:]:
            pairwise[f"{a}__{b}"] = cosine(vectors[a], vectors[b])

    signs = list(pairwise.values())
    conflict_rate = float(sum(v < 0.0 for v in signs) / max(1, len(signs)))
    mean_cos = float(sum(signs) / max(1, len(signs)))
    model.zero_grad(set_to_none=True)
    report = {
        "version": 108,
        "loss_gradient": {k: {"norm": norms[k], "parameter_element_fraction_nonzero": coverage[k]} for k in LOSS_KEYS},
        "pairwise_cosine": pairwise,
        "mean_pairwise_cosine": mean_cos,
        "negative_pair_fraction": conflict_rate,
        "interpretation": "Descriptive evidence only. Low/negative cosine indicates objective interaction or conflict; it is not evidence that a head should be removed by itself.",
    }
    path = ROOT / "evidence" / "V108_LOSS_SYNERGY.json"
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
