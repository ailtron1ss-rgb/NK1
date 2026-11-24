from __future__ import annotations
from dataclasses import asdict, dataclass
import json, time
import torch
import torch.nn.functional as F
from .core import NeuroWeaveV15, V15Config, LifeCycleTrainerV15


@dataclass
class Qualification:
    name: str
    value: float
    passed: bool


def _model(seed=0):
    torch.manual_seed(seed)
    return NeuroWeaveV15(V15Config(d=8, hidden=16, action_dim=3, memory_capacity=6, replay_capacity=7,
                                   semantic_capacity=5, max_experts=4, top_k=1, world_candidates=3,
                                   max_horizon=3, deep_threshold=0.2))


def run_qualification():
    rows=[]
    torch.manual_seed(1501)
    m=_model(1501)
    x=torch.randn(4,12,8)
    t=time.perf_counter(); y=m(x,commit_memory=True); ms=(time.perf_counter()-t)*1000
    rows.append(Qualification("forward_finite", float(torch.isfinite(y["latent_v15"]).all()), bool(torch.isfinite(y["latent_v15"]).all())))
    s=y["_final_state"]
    rows.append(Qualification("semantic_bounded", float(s.semantic_keys.shape[1]), s.semantic_keys.shape[1]==5))
    rows.append(Qualification("successor_finite", float(torch.isfinite(s.successor).all()), bool(torch.isfinite(s.successor).all())))
    rows.append(Qualification("counterfactual_present", float(torch.isfinite(y["counterfactual_advantage_v15"]).all()), bool(torch.isfinite(y["counterfactual_advantage_v15"]).all())))
    rows.append(Qualification("selective_learning_signal", float(y["learn_taken_v15"].sum()), bool((y["learn_taken_v15"] >= 0).all())))
    trainer=LifeCycleTrainerV15(m, lr=2e-3)
    before=float(trainer.step(s,6).item())
    after=float(trainer.step(s,6).item())
    rows.append(Qualification("life_cycle_finite", after, bool(torch.isfinite(torch.tensor(after)))))
    rows.append(Qualification("life_cycle_stable", after/before if before else 1.0, bool(after <= before*1.2)))
    rows.append(Qualification("latency_ms", ms, ms < 3000))
    return rows


def main(path="reports/v20/qualification_v15.json"):
    rows=run_qualification()
    payload={"passed": sum(r.passed for r in rows), "total": len(rows), "results":[asdict(r) for r in rows]}
    with open(path,"w",encoding="utf-8") as f: json.dump(payload,f,indent=2)
    print(json.dumps(payload,indent=2))
    return payload

if __name__ == "__main__":
    main()
