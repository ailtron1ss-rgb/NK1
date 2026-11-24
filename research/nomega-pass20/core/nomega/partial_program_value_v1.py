from __future__ import annotations

"""Execution-grounded partial-program value model.

The model estimates the eventual verifier score of a program prefix.  Training targets
come from actually executed complete candidates, so each prefix is a Monte-Carlo return
rather than a teacher-written heuristic.  A small bootstrap ensemble provides uncertainty
for search-time exploration.
"""
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Sequence, Tuple, Optional
import json, random, math

import torch
import torch.nn as nn
import torch.nn.functional as F

from .program_contract_v1 import ProgramContractV1, Program
from .execution_trace_v1 import trace_tinyvm_v1

@dataclass(frozen=True)
class ValueObservationV1:
    family_id: int
    code: Program
    target: float
    depth: int
    source: str = "execution"
    def to_dict(self):
        return {"family_id": int(self.family_id), "code": [list(x) for x in self.code],
                "target": float(self.target), "depth": int(self.depth), "source": self.source}

@dataclass(frozen=True)
class ValueFitReportV1:
    version: str
    samples: int
    unique_prefixes: int
    ensemble: int
    epochs: int
    loss: float
    target_mean: float
    target_std: float
    uncertainty_mean: float
    elapsed_s: float
    checkpoint: str
    def to_dict(self): return asdict(self)

class _ValueNet(nn.Module):
    def __init__(self, dim: int, hidden: int = 64):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(dim, hidden), nn.ReLU(), nn.Linear(hidden, hidden // 2), nn.ReLU(), nn.Linear(hidden // 2, 1))
    def forward(self, x):
        return self.net(x).squeeze(-1)

class PartialProgramValueV1:
    VERSION = "partial-program-value-v1"
    FAMILY_COUNT = 64
    def __init__(self, root: Path, seed: int = 9721, ensemble: int = 3):
        self.root = Path(root); self.seed = int(seed); self.ensemble_n = max(2, int(ensemble))
        self.contract = ProgramContractV1()
        self.obs: List[ValueObservationV1] = []
        self.models: List[_ValueNet] = []
        self.mean_loss = 0.0
        self._dim = 20 + 8 + 13 + self.FAMILY_COUNT
        self.checkpoint = self.root / "runtime" / "partial_program_value_v1.pt"
        self.dataset_path = self.root / "runtime" / "partial_program_value_dataset_v1.jsonl"
        self.meta_path = self.root / "runtime" / "partial_program_value_meta_v1.json"
        self._load()

    @property
    def ready(self) -> bool:
        return len(self.obs) >= 24 and bool(self.models)

    def _features(self, code: Program, family_id: int, *, dynamic: bool = False) -> List[float]:
        code = [tuple(map(int, x)) for x in code]
        hist = [0.0] * 20
        reg_a = [0.0] * 4
        reg_b = [0.0] * 4
        for op, a, b in code:
            hist[op % 20] += 1.0; reg_a[a % 4] += 1.0; reg_b[b % 4] += 1.0
        n = max(1, len(code))
        hist = [x / n for x in hist]
        reg_a = [x / n for x in reg_a]
        reg_b = [x / n for x in reg_b]
        c = self.contract.check(code)
        if dynamic and code:
            probes = ([0, 1, 2, 3, 5, 8, 13, 21], [17, 31, 47, 63, 79, 95, 111, 127])
            traces = [trace_tinyvm_v1(code, list(t), steps=96) for t in probes]
            halt_rate = sum(int(t.halted and t.ok) for t in traces) / max(1, len(traces))
            ok_rate = sum(int(t.ok) for t in traces) / max(1, len(traces))
            mean_steps = sum(t.steps for t in traces) / max(1, len(traces))
            mean_out = sum(int(t.result) & 255 for t in traces) / max(1, len(traces))
        else:
            # Search-time features stay static: execution feedback enters through the target,
            # avoiding a second interpreter pass for every child being ranked.
            halt_rate = float(c.halt_reachable)
            ok_rate = float(c.runnable)
            mean_steps = float(len(code))
            mean_out = 0.0
        last_op = (code[-1][0] % 20) / 19.0 if code else 0.0
        scalars = [
            min(1.0, len(code) / 48.0), c.score, c.reachable_instructions / max(1, len(code)),
            float(c.halt_reachable), last_op, sum(hist[i] for i in (1,2)),
            sum(hist[i] for i in (3,4,5,6,7,15,16,17,18,19)),
            sum(hist[i] for i in (11,12)), sum(hist[i] for i in (1,2)),
            halt_rate, ok_rate, min(1.0, mean_steps / 96.0), mean_out / 255.0,
        ]
        fam = [0.0] * self.FAMILY_COUNT
        if 0 <= int(family_id) < self.FAMILY_COUNT: fam[int(family_id)] = 1.0
        return hist + reg_a + reg_b + scalars + fam

    def observe(self, family_id: int, code: Program, target: float, *, source: str = "execution", all_prefixes: bool = True) -> int:
        code = [tuple(map(int, x)) for x in code]
        if not code: return 0
        target = float(max(0.0, min(1.0, target)))
        added = 0
        starts = range(1, len(code) + 1) if all_prefixes else [len(code)]
        for k in starts:
            prefix = code[:k]
            # Avoid excessive repetition while preserving different targets/sources.
            key = (int(family_id), tuple(prefix), round(target, 4))
            if any((o.family_id, tuple(o.code), round(o.target, 4)) == key for o in self.obs):
                continue
            self.obs.append(ValueObservationV1(int(family_id), prefix, target, k, source)); added += 1
        return added

    def observe_node(self, family_id: int, code: Program, score: float, source: str = "search") -> int:
        return self.observe(family_id, code, score, source=source, all_prefixes=True)

    def _save_dataset(self):
        self.dataset_path.parent.mkdir(parents=True, exist_ok=True)
        with self.dataset_path.open("w", encoding="utf-8") as fh:
            for o in self.obs[-5000:]: fh.write(json.dumps(o.to_dict(), sort_keys=True) + "\n")

    def fit(self, *, epochs: int = 24, batch_size: int = 32, lr: float = 7e-4) -> Optional[ValueFitReportV1]:
        if len(self.obs) < 24: return None
        import time
        t0=time.perf_counter()
        rng=random.Random(self.seed + len(self.obs))
        rows=list(self.obs[-4000:]); rng.shuffle(rows)
        xs=torch.tensor([self._features(o.code,o.family_id,dynamic=False) for o in rows],dtype=torch.float32)
        ys=torch.tensor([o.target for o in rows],dtype=torch.float32)
        self.models=[]; losses=[]
        for m in range(self.ensemble_n):
            torch.manual_seed(self.seed + 101*m + len(rows))
            model=_ValueNet(self._dim)
            opt=torch.optim.AdamW(model.parameters(),lr=float(lr),weight_decay=1e-4)
            # Bootstrap resampling encourages useful predictive disagreement.
            idx=[rng.randrange(len(rows)) for _ in range(len(rows))]
            bx,by=xs[idx],ys[idx]
            model.train(); last=0.0
            for _ in range(max(1,int(epochs))):
                perm=torch.randperm(len(by))
                for j in range(0,len(by),max(1,int(batch_size))):
                    k=perm[j:j+batch_size]
                    pred=model(bx[k]); loss=F.smooth_l1_loss(pred,by[k])
                    opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); opt.step(); last=float(loss.detach())
            self.models.append(model.eval()); losses.append(last)
        self.mean_loss=sum(losses)/max(1,len(losses))
        self._save_dataset(); self._save_models()
        with torch.no_grad():
            pred=torch.stack([m(xs) for m in self.models],0)
            unc=float(pred.std(0).mean())
        report=ValueFitReportV1(self.VERSION,len(rows),len(rows),len(self.models),max(1,int(epochs)),self.mean_loss,float(ys.mean()),float(ys.std()),unc,time.perf_counter()-t0,str(self.checkpoint))
        self.meta_path.write_text(json.dumps(report.to_dict(),indent=2))
        return report

    @torch.no_grad()
    def predict(self, family_id: int, code: Program, *, exploration: float = 0.20) -> Tuple[float,float]:
        if not self.models: return (0.0,1.0)
        x=torch.tensor([self._features(code,family_id,dynamic=False)],dtype=torch.float32)
        vals=torch.stack([m(x)[0] for m in self.models])
        mean=float(vals.mean()); std=float(vals.std()) if len(vals)>1 else 0.0
        return max(0.0,min(1.0,mean + float(exploration)*std)), max(0.0,min(1.0,std))

    def _save_models(self):
        self.checkpoint.parent.mkdir(parents=True,exist_ok=True)
        torch.save({'version':self.VERSION,'seed':self.seed,'dim':self._dim,'models':[m.state_dict() for m in self.models]},self.checkpoint)

    def _load(self):
        if self.dataset_path.exists():
            try:
                rows=[]
                for line in self.dataset_path.read_text(encoding='utf-8').splitlines()[-5000:]:
                    d=json.loads(line); rows.append(ValueObservationV1(int(d['family_id']),[tuple(x) for x in d['code']],float(d['target']),int(d.get('depth',len(d['code']))),d.get('source','disk')))
                self.obs=rows
            except Exception:
                self.obs=[]
        if self.checkpoint.exists():
            try:
                blob=torch.load(self.checkpoint,map_location='cpu',weights_only=False)
                if blob.get('version')==self.VERSION and int(blob.get('dim',self._dim))==self._dim:
                    self.models=[]
                    for state in blob.get('models',[]):
                        m=_ValueNet(self._dim); m.load_state_dict(state); m.eval(); self.models.append(m)
            except Exception:
                self.models=[]
