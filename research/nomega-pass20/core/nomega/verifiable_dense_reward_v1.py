from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple
import json, math, statistics

from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2
from .execution_trace_v1 import trace_tinyvm_v1

Program = List[Tuple[int, int, int]]

@dataclass(frozen=True)
class DenseRewardV1:
    reward: float
    pass_rate: float
    weighted_pass_rate: float
    output_closeness: float
    hvm_agreement: float
    termination: float
    efficiency: float
    complexity_penalty: float
    traces: int
    failures: Tuple[Dict[str, Any], ...]

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["failures"] = list(self.failures)
        return d

class VerifiableDenseRewardV1:
    """Dense, execution-grounded reward with adaptive test difficulty weights.

    No learned reward model participates: all reward components are derived from
    exact execution and independent HVM agreement, reducing reward-model drift.
    """
    VERSION = "verifiable-dense-reward-v1"
    def __init__(self, root: Path):
        self.root = Path(root)
        self.stats_path = self.root / "runtime" / "verifiable_reward_stats_v1.json"
        self.weights: Dict[str, float] = {}
        if self.stats_path.exists():
            try: self.weights = json.loads(self.stats_path.read_text()).get("test_weights", {})
            except Exception: self.weights = {}

    @staticmethod
    def _difficulty_key(tape: Sequence[int], expected: int) -> str:
        return repr((tuple(int(x) & 255 for x in tape), int(expected) & 255))

    @staticmethod
    def _closeness(got: Any, expected: int) -> float:
        if got is None: return 0.0
        a, b = int(got) & 255, int(expected) & 255
        d = min((a - b) & 255, (b - a) & 255)
        return 1.0 - (d / 128.0)

    def update_difficulty(self, rows: Sequence[Tuple[List[int], int]], observed_passes: Sequence[float]) -> Dict[str, float]:
        for (tape, expected), p in zip(rows, observed_passes):
            k = self._difficulty_key(tape, expected)
            old = self.weights.get(k, 1.0)
            # Harder examples receive larger weights, but cap prevents unstable reward spikes.
            target = 1.0 + 2.5 * (1.0 - float(max(0.0, min(1.0, p))))
            self.weights[k] = 0.8 * old + 0.2 * target
        self.stats_path.parent.mkdir(parents=True, exist_ok=True)
        self.stats_path.write_text(json.dumps({"version": self.VERSION, "test_weights": self.weights}, indent=2))
        return dict(self.weights)

    def score(self, code: Program, rows: Sequence[Tuple[List[int], int]]) -> DenseRewardV1:
        if not rows:
            return DenseRewardV1(0,0,0,0,0,0,1,0,0,())
        weighted_total = 0.0; weighted_pass = 0.0; passes = 0; agree = 0; close = []; term = 0; eff = []
        failures: List[Dict[str, Any]] = []
        weights=[]
        for tape, expected in rows:
            k=self._difficulty_key(tape,expected); w=float(self.weights.get(k,1.0)); weights.append(w)
            t=run_tiny_v2(code,tape,steps=512); h=run_hvm_compiled_v2(code,tape,max_steps=512)
            good=bool(t.get('ok') and t.get('result')==(expected & 255)); cross=bool(good and h.get('ok') and h.get('result')==t.get('result'))
            passes += int(good); agree += int(cross); weighted_total += w; weighted_pass += w*float(good)
            close.append(self._closeness(t.get('result'), expected))
            tr=trace_tinyvm_v1(code,tape,steps=512); term += int(tr.halted and tr.ok)
            eff.append(1.0 / (1.0 + max(0, tr.steps - 1) / 64.0))
            if not good and len(failures) < 8:
                failures.append({'tape':list(tape),'expected':int(expected),'got':t.get('result'),'error':t.get('error'),'trace_steps':tr.steps,'halted':tr.halted})
        n=float(len(rows)); mean_close=sum(close)/n; pass_rate=passes/n; weighted_pass_rate=weighted_pass/max(weighted_total,1e-9); hvm=agree/n; termination=term/n; efficiency=sum(eff)/n
        complexity_penalty=max(0.0,(len(code)-8)/48.0)*0.08
        reward=max(0.0,min(1.0,0.42*weighted_pass_rate + 0.18*pass_rate + 0.16*hvm + 0.10*mean_close + 0.08*termination + 0.06*efficiency - complexity_penalty))
        return DenseRewardV1(reward,pass_rate,weighted_pass_rate,mean_close,hvm,termination,efficiency,complexity_penalty,len(rows),tuple(failures))

    @staticmethod
    def pairwise_margin(pos: DenseRewardV1, neg: DenseRewardV1) -> float:
        return float(pos.reward - neg.reward)
