from __future__ import annotations
"""Execution-grounded replay ranking by actual gradient alignment.

This module is deliberately research-only until an equal-budget multi-seed
experiment demonstrates downstream gain. It measures whether a candidate replay
example pushes parameters in a direction compatible with the current target.
"""
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple
import json, math, time
import torch
import torch.nn.functional as F

ProgramRow = Tuple[str, List[Tuple[int, int, int]], int]


class GradientAlignmentReplayV1:
    VERSION = "1.10.0"

    def __init__(self, root: Path, *, epsilon: float = 1e-8):
        self.root = Path(root)
        self.path = self.root / "runtime" / "nomega_gradient_alignment_replay_v1.json"
        self.epsilon = float(epsilon)
        self.state = self._load()

    def _load(self) -> Dict[str, Any]:
        default = {"version": self.VERSION, "events": [], "stats": {"calls": 0, "positive": 0, "negative": 0, "neutral": 0}}
        if not self.path.exists():
            return default
        try:
            blob = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(blob, dict):
                return default
            for k, v in default.items():
                blob.setdefault(k, v)
            blob["version"] = self.VERSION
            return blob
        except Exception as exc:
            return {**default, "events": [{"kind": "load_fallback", "reason": type(exc).__name__}]}

    @staticmethod
    def _loss(model, row: ProgramRow) -> torch.Tensor:
        text, code, fid = row
        out = model.forward_teacher(text, code, fid)
        lo = F.cross_entropy(out["op"].reshape(-1, out["op"].size(-1)), out["op_y"])
        la = F.cross_entropy(out["a"].reshape(-1, out["a"].size(-1)), out["a_y"])
        lb = F.cross_entropy(out["b"].reshape(-1, out["b"].size(-1)), out["b_y"])
        return lo + 0.5 * la + 0.5 * lb

    def _gradient(self, model, row: ProgramRow) -> torch.Tensor:
        model.zero_grad(set_to_none=True)
        loss = self._loss(model, row)
        loss.backward()
        chunks = []
        for param in model.parameters():
            if param.grad is not None:
                chunks.append(param.grad.detach().float().reshape(-1).cpu())
        if not chunks:
            raise RuntimeError("gradient_alignment_empty_gradient")
        return torch.cat(chunks)

    def rank(self, model, context_rows: Sequence[ProgramRow], candidate_rows: Sequence[ProgramRow], *, limit: int = 8) -> List[ProgramRow]:
        if not context_rows or not candidate_rows:
            return []
        model_was_training = bool(model.training)
        model.eval()
        with torch.enable_grad():
            context_grads = [self._gradient(model, r) for r in list(context_rows)[:2]]
            context = torch.stack(context_grads, 0).mean(0)
            context_norm = float(context.norm().item())
            scored = []
            for idx, row in enumerate(candidate_rows):
                try:
                    grad = self._gradient(model, row)
                    denom = max(self.epsilon, context_norm * float(grad.norm().item()))
                    cosine = float(torch.dot(context, grad).item()) / denom
                    scored.append((cosine, idx, row))
                except Exception as exc:
                    scored.append((-1.0, idx, row))
                    self.state.setdefault("events", []).append({"kind": "candidate_error", "index": idx, "error": type(exc).__name__})
        if model_was_training:
            model.train()
        scored.sort(key=lambda x: (-x[0], x[1]))
        top = scored[: max(0, int(limit))]
        for cosine, _, _ in top:
            bucket = "positive" if cosine > 0.1 else "negative" if cosine < -0.1 else "neutral"
            self.state["stats"][bucket] = int(self.state["stats"].get(bucket, 0)) + 1
        self.state["stats"]["calls"] = int(self.state["stats"].get("calls", 0)) + 1
        self.state.setdefault("events", []).append({
            "ts": time.time(), "kind": "gradient_alignment_selection",
            "context_size": min(2, len(context_rows)), "candidate_size": len(candidate_rows),
            "selected": len(top), "scores": [float(x[0]) for x in top],
        })
        self.state["events"] = self.state["events"][-512:]
        self._save()
        return [x[2] for x in top]

    def snapshot(self) -> Dict[str, Any]:
        return json.loads(json.dumps(self.state))

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")
