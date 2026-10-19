import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.nomega import NOMEGAConfig, NOmegaCore, RouterTraceTrainer, best_expert, evaluate_experts, evaluate_router_policy

def test_counterfactual_math_prefers_symbolic(tmp_path):
    c = NOmegaCore(NOMEGAConfig(latent_dim=32, router_hidden=24, memory_dim=32, max_reason_steps=2))
    rows = evaluate_experts(c, "calculate", {"a": 8, "b": 7, "op": "sum", "expected": 15})
    best = best_expert(rows)
    assert best["expert"] == "symbolic"
    assert best["reward"] > 0.75


def test_learned_checkpoint_disables_bootstrap(tmp_path):
    t = RouterTraceTrainer(tmp_path, cfg=NOMEGAConfig(latent_dim=32, router_hidden=24, memory_dim=32), seed=7)
    t.collect(8, counterfactual=True)
    r = t.train(epochs=1, batch_size=4, collect_each_epoch=False)
    assert r["bootstrap_routing"] is False
    t2 = RouterTraceTrainer(tmp_path, cfg=NOMEGAConfig(latent_dim=32, router_hidden=24, memory_dim=32), seed=7)
    assert t2.model.cfg.bootstrap_routing is False


def test_router_can_execute_learned_mode(tmp_path):
    t = RouterTraceTrainer(tmp_path, cfg=NOMEGAConfig(latent_dim=32, router_hidden=24, memory_dim=32), seed=9)
    t.collect(12, counterfactual=True)
    t.train(epochs=1, batch_size=4, collect_each_epoch=False)
    out = t.model.run("calculate", {"a": 10, "b": 2, "op": "mul", "expected": 20})
    assert out["verified"] is True


def test_route_holdout_is_bounded():
    c = NOmegaCore(NOMEGAConfig(latent_dim=32, router_hidden=24, memory_dim=32, max_reason_steps=2, bootstrap_routing=False))
    r = evaluate_router_policy(c, [
        {"text": "calculate", "context": {"a": 3, "b": 4, "op": "sum", "expected": 7}},
        {"text": "write a program", "context": {}},
    ])
    assert 0.0 <= r["agreement"] <= 1.0
    assert r["n"] == 2
