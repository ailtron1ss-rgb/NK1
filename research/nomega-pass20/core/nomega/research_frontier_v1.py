from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, Sequence
import json, statistics, time
class ResearchFrontierV1:
    """Aggregates pure-neural, hybrid, and deterministic evidence without collapsing them into one score."""
    def __init__(self,root:Path): self.root=Path(root)
    def summarize(self,pure:float,hybrid:float,deterministic:float,ood:float,mobile:Dict[str,Any])->Dict[str,Any]:
        out={'version':'1.9.0','pure_neural_pct':100*pure,'hybrid_verified_pct':100*hybrid,'deterministic_pct':100*deterministic,'ood_pct':100*ood,'mobile':mobile,'interpretation':{'pure_neural':'learned generator only','hybrid_verified':'learned proposals plus execution-guided search','deterministic':'verified program library','ood':'independent language/composition holdout'}}
        p=self.root/'runtime'/'nomega_1_9_frontier_summary.json'; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(out,indent=2,default=str)); return out
