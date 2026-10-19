from __future__ import annotations
"""One-command NΩ research cycle.

Runs: trace collection -> router training -> NeuralInvent supervised/RL steps ->
benchmark -> reproducible report. Every phase is optional and bounded so the same
entry point can run on a laptop or a medium phone.
"""
from pathlib import Path
from typing import Any, Dict
import json, time

from .trace_trainer import RouterTraceTrainer
from .route_lab import evaluate_router_policy


def run_system_cycle(root: Path, trace_episodes: int = 48, router_epochs: int = 4,
                     neural_steps: int = 4, neural_rl_steps: int = 2, seed: int = 41) -> Dict[str, Any]:
    root = Path(root)
    t0 = time.perf_counter()
    router = RouterTraceTrainer(root=root, seed=seed)
    collection = router.collect(trace_episodes)
    route_train = router.train(router_epochs, batch_size=12, collect_each_epoch=True)

    neural = None
    if neural_steps > 0 or neural_rl_steps > 0:
        try:
            from core.neural_invent import NeuralInventTrainer
            nt = NeuralInventTrainer(seed=seed, device="cpu")
            parts = []
            if neural_steps > 0:
                parts.append(nt.train_steps(neural_steps, batch_size=12))
            if neural_rl_steps > 0:
                parts.append(nt.train_rl(neural_rl_steps, batch_size=8))
            neural = {"parts": parts, "params": nt.net.count_params(), "steps": nt.steps, "rl_steps": nt.rl_steps}
        except Exception as exc:
            neural = {"error": str(exc)}

    try:
        from .bench import run_nomega_bench
        benchmark = run_nomega_bench()
    except Exception as exc:
        benchmark = {"error": str(exc)}

    holdout = []
    try:
        hcore = router.model
        hcore.cfg.bootstrap_routing = False
        holdout = evaluate_router_policy(hcore, [
            {"text": "calculate", "context": {"a": 11, "b": 8, "op": "sum", "expected": 19}},
            {"text": "calculate", "context": {"a": 13, "b": 4, "op": "xor", "expected": 9}},
            {"text": "calculate multiply", "context": {"a": 6, "b": 7, "op": "mul", "expected": 42}},
            {"text": "write a program to transform a list", "context": {}},
            {"text": "reason about an unfamiliar concept", "context": {}},
        ])
    except Exception as exc:
        holdout = {"error": str(exc)}

    report = {
        "version": "0.3.0",
        "seed": seed,
        "collection": collection,
        "router_training": route_train,
        "neural_invent": neural,
        "benchmark": benchmark,
        "route_holdout": holdout,
        "duration_s": round(time.perf_counter() - t0, 3),
    }
    path = root / "runtime" / "nomega_cycle_report.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    report["report_path"] = str(path)
    return report
