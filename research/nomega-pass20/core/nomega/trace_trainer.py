from __future__ import annotations
import random, time
from pathlib import Path
from typing import Any, Dict, List, Tuple
import torch
import torch.nn.functional as F

from .config import NOMEGAConfig
from .core import NOmegaCore
from .task_policy import bootstrap_target, classify_task, reward_from_result
from .route_lab import evaluate_experts, best_expert
from .trace import TraceStore
from .governance_runtime import record_degraded_mode

TASKS = [
    ("calculate", {"a": 2, "b": 7, "op": "sum", "expected": 9}, "math"),
    ("calculate xor", {"a": 37, "b": 13, "op": "xor", "expected": 40}, "math"),
    ("calculate multiply", {"a": 9, "b": 4, "op": "mul", "expected": 36}, "math"),
    ("calculate min", {"a": 5, "b": 17, "op": "min", "expected": 5}, "math"),
    ("calculate max", {"a": 5, "b": 17, "op": "max", "expected": 17}, "math"),
    ("write a program to transform a list", {}, "program"),
    ("explain a new concept", {}, "general"),
    ("inspect this image", {}, "vision"),
]

class RouterTraceTrainer:
    """Train NΩ's executive from actual closed-loop traces.

    The target is derived from observed/verified utility, with a conservative
    bootstrap prior for tasks that have a deterministic specialist. This keeps
    the first learned policy grounded in real execution instead of synthetic
    class labels alone.
    """
    def __init__(self, root: Path, cfg: NOMEGAConfig | None = None, seed: int = 41):
        self.root = Path(root)
        self.cfg = cfg or NOMEGAConfig(seed=seed)
        self.seed = seed
        self.rng = random.Random(seed)
        self.model = NOmegaCore(self.cfg)
        self.trace_store = TraceStore(self.root / "runtime" / "nomega_traces.jsonl")
        self.ckpt = self.root / "runtime" / "nomega_router.pt"
        self.steps = 0
        self._load()

    def _load(self):
        if not self.ckpt.exists():
            return
        try:
            blob = torch.load(self.ckpt, map_location="cpu", weights_only=False)
            self.model.router.load_state_dict(blob.get("router", {}), strict=False)
            self.model.cfg.bootstrap_routing = bool(blob.get("bootstrap_routing", self.model.cfg.bootstrap_routing))
            self.steps = int(blob.get("steps", 0))
        except Exception as exc:
            record_degraded_mode("RouterTraceTrainer", "TRACE_CHECKPOINT_LOAD_DEGRADED", exc, ledger_path=self.root/"runtime"/"nomega_governance_events.jsonl")

    def save(self):
        self.ckpt.parent.mkdir(parents=True, exist_ok=True)
        torch.save({"router": self.model.router.state_dict(), "steps": self.steps, "cfg": self.cfg.to_dict(), "bootstrap_routing": False}, self.ckpt)

    @torch.no_grad()
    def collect(self, episodes: int = 64, counterfactual: bool = True) -> Dict[str, Any]:
        self.model.eval()
        rows = []
        for i in range(episodes):
            text, context, task_type = self.rng.choice(TASKS)
            t0 = time.perf_counter()
            result = self.model.run(text, context)
            latency = (time.perf_counter() - t0) * 1000.0
            rt = reward_from_result(result, self.cfg.reward_verification_weight,
                                    self.cfg.reward_efficiency_weight,
                                    1.0 - self.cfg.reward_verification_weight - self.cfg.reward_efficiency_weight)
            cf = evaluate_experts(self.model, text, context) if counterfactual else []
            best = best_expert(cf) if cf else {"expert": bootstrap_target(task_type, bool(result.get("verified")), self.model.expert_bank.names()), "reward": rt, "margin": 0.0}
            names = self.model.expert_bank.names()
            target = best["expert"] if best["expert"] in names else names[0]
            target_idx = names.index(target)
            row = {
                "text": text, "task_type": task_type,
                "target": target, "target_idx": target_idx,
                "reward": rt, "best_reward": float(best.get("reward", rt)),
                "best_margin": float(best.get("margin", 0.0)),
                "counterfactual": cf,
                "verified": bool(result.get("verified")),
                "latency_ms": latency,
                "selected_experts": result.get("experts", []),
                "state": result.get("state", {}),
            }
            self.trace_store.append(row)
            rows.append(row)
        return {"episodes": episodes, "verified": sum(x["verified"] for x in rows),
                "mean_reward": sum(x["reward"] for x in rows) / max(1, episodes),
                "mean_best_reward": sum(x["best_reward"] for x in rows) / max(1, episodes),
                "trace_file": str(self.trace_store.path),
                "counterfactual": counterfactual}

    def train(self, epochs: int = 5, batch_size: int = 16, collect_each_epoch: bool = True) -> Dict[str, Any]:
        opt = torch.optim.AdamW(self.model.router.parameters(), lr=3e-4, weight_decay=1e-4)
        self.model.train()
        history = []
        names = self.model.expert_bank.names()
        for epoch in range(epochs):
            if collect_each_epoch:
                self.model.cfg.bootstrap_routing = True if epoch == 0 and self.steps == 0 else False
                self.collect(max(batch_size * 2, 16), counterfactual=True)
            rows = self.trace_store.read(limit=1024)
            self.rng.shuffle(rows)
            if not rows:
                continue
            losses = []
            for start in range(0, len(rows), batch_size):
                batch = rows[start:start + batch_size]
                texts = [r["text"] for r in batch]
                z = self.model.encoder(texts)
                out = self.model.router(z)
                targets = torch.tensor([names.index(r["target"]) for r in batch], dtype=torch.long)
                utility = torch.tensor([float(r.get("best_reward", r.get("reward", 0.0))) for r in batch], dtype=torch.float32)
                margin = torch.tensor([float(r.get("best_margin", 0.0)) for r in batch], dtype=torch.float32)
                ce = F.cross_entropy(out["probs"].log(), targets)
                logp = out["probs"].gather(1, targets.unsqueeze(1)).squeeze(1)
                advantage = (utility - utility.mean()).detach()
                policy_loss = -(advantage * torch.log(logp.clamp_min(1e-8))).mean()
                # Encourage compute only where observed utility actually justifies it.
                target_compute = torch.clamp(0.25 + 0.75 * utility, 0.0, 1.0)
                compute_loss = F.smooth_l1_loss(out["compute"], target_compute)
                confidence_target = torch.clamp(1.0 - margin.abs(), 0.0, 1.0)
                uncertainty_loss = F.smooth_l1_loss(out["uncertainty"], confidence_target)
                loss = ce + 0.35 * policy_loss + 0.08 * compute_loss + 0.04 * uncertainty_loss
                opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(self.model.router.parameters(), 1.0); opt.step()
                self.steps += 1
                losses.append(float(loss.detach()))
            history.append({"epoch": epoch + 1, "loss": sum(losses) / max(1, len(losses)), "steps": self.steps})
        self.model.cfg.bootstrap_routing = False
        self.save()
        return {"epochs": epochs, "steps": self.steps, "history": history,
                "checkpoint": str(self.ckpt), "traces": len(self.trace_store.read(limit=None)),
                "bootstrap_routing": False}

