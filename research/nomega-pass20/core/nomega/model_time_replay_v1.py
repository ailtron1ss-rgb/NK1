from __future__ import annotations

"""Replay scheduling from model evolution rather than fixed training steps."""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Sequence
import json, math, time


@dataclass
class ModelTimeReplayDecisionV1:
    step: int
    parameter_delta: float
    loss_delta: float
    uncertainty: float
    surprise: float
    trigger: bool
    reason: str


class ModelTimeReplayControllerV1:
    VERSION = "1.9.9"

    def __init__(self, root: Path, *, threshold: float = 0.15, cooldown_steps: int = 1, reference_parameter_delta: float = 0.001):
        self.root = Path(root)
        self.path = self.root / "runtime" / "nomega_model_time_replay_v1.json"
        self.threshold = float(threshold)
        self.cooldown_steps = max(0, int(cooldown_steps))
        self.reference_parameter_delta = max(1e-9, float(reference_parameter_delta))
        self.state = self._load()
        self.last_replay_step = int(self.state.get("last_replay_step", -10**9))
        self.previous_loss = self.state.get("previous_loss")

    def _load(self) -> Dict[str, Any]:
        default = {"version": self.VERSION, "events": [], "last_replay_step": -10**9, "previous_loss": None}
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
    def parameter_delta(model, previous_state: Dict[str, Any] | None) -> float:
        if previous_state is None:
            return 0.0
        num = 0.0
        den = 0.0
        state = model.state_dict()
        for name, tensor in state.items():
            prior = previous_state.get(name)
            if prior is None or not hasattr(tensor, "detach"):
                continue
            cur = tensor.detach().float().cpu()
            p = prior.detach().float().cpu() if hasattr(prior, "detach") else prior
            diff = float((cur - p).pow(2).sum().item())
            base = float(p.pow(2).sum().item()) if hasattr(p, "pow") else 0.0
            num += diff
            den += base
        return math.sqrt(num / max(1e-12, den + 1e-12))

    def decide(self, *, step: int, parameter_delta: float, loss: float | None = None, uncertainty: float = 0.0) -> ModelTimeReplayDecisionV1:
        loss_delta = 0.0 if self.previous_loss is None or loss is None else float(loss - float(self.previous_loss))
        loss_shock = min(1.0, abs(loss_delta))
        uncertainty = max(0.0, min(1.0, float(uncertainty)))
        parameter_signal = min(1.0, abs(float(parameter_delta)) / self.reference_parameter_delta)
        surprise = 0.55 * parameter_signal + 0.30 * loss_shock + 0.15 * uncertainty
        trigger = surprise >= self.threshold and int(step) - self.last_replay_step >= self.cooldown_steps
        reason = "model_evolution_event" if trigger else "below_threshold_or_cooldown"
        if loss is not None:
            self.previous_loss = float(loss)
        decision = ModelTimeReplayDecisionV1(int(step), float(parameter_delta), float(loss_delta), uncertainty, float(surprise), bool(trigger), reason)
        self.state.setdefault("events", []).append(asdict(decision))
        self.state["events"] = self.state["events"][-512:]
        if trigger:
            self.last_replay_step = int(step)
            self.state["last_replay_step"] = self.last_replay_step
        self.state["previous_loss"] = self.previous_loss
        self._save()
        return decision

    def record_hook_error(self, *, step: int, error_type: str) -> None:
        self.state.setdefault("events", []).append({"kind":"hook_error","step":int(step),"error_type":str(error_type)})
        self.state["events"] = self.state["events"][-512:]
        self._save()

    def snapshot(self) -> Dict[str, Any]:
        return json.loads(json.dumps(self.state))

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")
