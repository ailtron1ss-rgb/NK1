from __future__ import annotations
from dataclasses import dataclass, asdict
import json, math, time
from typing import Callable, Dict, List, Tuple
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from ..v16.neuroweave_v10 import NeuroWeaveV10
from ..baselines_v11 import MemoryGRU, MatchedDelta

@dataclass
class TrainRun:
    model: str
    task: str
    seed: int
    initial_loss: float
    final_loss: float
    final_acc: float
    grad_nonzero_fraction: float
    grad_norm_mean: float
    param_delta_l2: float
    elapsed_s: float
    status: str


def _seq(seed: int, batch: int, steps: int, d: int) -> Tensor:
    g = torch.Generator().manual_seed(seed)
    return torch.randn(batch, steps, d, generator=g)


def make_task(name: str, seed: int, batch: int = 16, steps: int = 24, d: int = 8) -> Tuple[Tensor, Tensor]:
    x = _seq(seed, batch, steps, d)
    if name == "identity":
        y = x[:, -1]
    elif name == "running_mean":
        y = x.mean(1)
    elif name == "delayed_copy":
        delay = max(2, steps // 3)
        y = x[:, steps - delay - 1]
    elif name == "two_event_binding":
        y = x[:, 2] + 0.5 * x[:, -3]
    elif name == "change_point":
        a = x[:, :steps//2].mean((1,2), keepdim=False)
        b = x[:, steps//2:].mean((1,2), keepdim=False)
        y = (b > a).float().unsqueeze(-1).expand(batch, d)
    elif name == "temporal_sum_decay":
        weights = torch.linspace(0.1, 1.0, steps)
        y = (x * weights.view(1,-1,1)).sum(1) / weights.sum()
    else:
        raise ValueError(name)
    return x, y


class LatentRegressor(nn.Module):
    def __init__(self, core: nn.Module, d: int):
        super().__init__(); self.core = core; self.head = nn.Linear(d, d)
    def forward(self, x: Tensor) -> Tensor:
        out = self.core(x)
        if isinstance(out, tuple) and len(out) == 2 and isinstance(out[0], dict):
            return self.head(out[0]["latent"][:, -1])
        if isinstance(out, Tensor):
            return out[:, -1]
        raise TypeError(f"Unsupported baseline output type: {type(out)!r}")


def _core_model(name: str, d: int) -> nn.Module:
    if name == "NeuroWeaveV10":
        return NeuroWeaveV10(d=d, hidden=max(12, 2*d), action_dim=max(2, d//2), capacity=16, experts=4)
    if name == "MemoryGRU": return LatentRegressor(MemoryGRU(d), d)
    if name == "Delta": return LatentRegressor(MatchedDelta(d), d)
    raise ValueError(name)


def train_once(model_name: str, task: str, seed: int, steps: int = 20, d: int = 8) -> TrainRun:
    torch.manual_seed(seed)
    x, y = make_task(task, seed, d=d)
    if model_name == "NeuroWeaveV10":
        model = LatentRegressor(_core_model(model_name, d), d)
    else:
        model = _core_model(model_name, d)
    before = {n: p.detach().clone() for n,p in model.named_parameters() if p.requires_grad}
    opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-4)
    tic = time.perf_counter(); initial = None; last_grad = []
    for _ in range(steps):
        opt.zero_grad(set_to_none=True)
        pred = model(x)
        loss = F.mse_loss(pred, y)
        if initial is None: initial = float(loss.detach())
        loss.backward()
        norms = [p.grad.detach().norm().item() for p in model.parameters() if p.grad is not None]
        last_grad.extend(norms)
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
    with torch.no_grad():
        pred = model(x); final = float(F.mse_loss(pred,y)); acc = float((((pred-y).abs() < 0.25).float().mean()))
    delta_sq = 0.0; count = 0
    for n,p in model.named_parameters():
        if n in before:
            delta_sq += float((p.detach()-before[n]).pow(2).sum()); count += p.numel()
    nz = sum(v>1e-9 for v in last_grad)/max(1,len(last_grad))
    return TrainRun(model_name, task, seed, initial, final, acc, nz, sum(last_grad)/max(1,len(last_grad)), math.sqrt(delta_sq), time.perf_counter()-tic, "FUNCTIONAL INDICATOR")


def run_grid(seeds=(0,1,2), tasks=("identity","running_mean","delayed_copy","two_event_binding","change_point","temporal_sum_decay")) -> List[TrainRun]:
    rows=[]
    for task in tasks:
        for seed in seeds:
            for model in ("NeuroWeaveV10","MemoryGRU","Delta"):
                rows.append(train_once(model, task, seed))
    return rows


def summary(rows: List[TrainRun]) -> Dict[str,dict]:
    out={}
    for r in rows:
        out.setdefault(r.model, []).append(r)
    ans={}
    for model, rs in out.items():
        ans[model] = {
            "mean_initial": sum(r.initial_loss for r in rs)/len(rs),
            "mean_final": sum(r.final_loss for r in rs)/len(rs),
            "mean_reduction": sum((1-r.final_loss/max(r.initial_loss,1e-9)) for r in rs)/len(rs),
            "mean_accuracy": sum(r.final_acc for r in rs)/len(rs),
            "mean_grad_nonzero_fraction": sum(r.grad_nonzero_fraction for r in rs)/len(rs),
            "mean_param_delta_l2": sum(r.param_delta_l2 for r in rs)/len(rs),
            "mean_elapsed_s": sum(r.elapsed_s for r in rs)/len(rs),
            "runs": len(rs),
        }
    return ans


def save(rows, path):
    with open(path,'w',encoding='utf-8') as f:
        for r in rows: f.write(json.dumps(asdict(r), sort_keys=True)+'\n')

if __name__ == '__main__':
    rows=run_grid(); save(rows,'trainability_results.json'); print(json.dumps(summary(rows), indent=2, sort_keys=True))
