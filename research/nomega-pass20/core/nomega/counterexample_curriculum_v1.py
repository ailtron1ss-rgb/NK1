from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, List, Sequence
import json, random
class CounterexampleCurriculumV1:
    """Promotes hard failures to a compact curriculum, weighted by novelty and disagreement."""
    def __init__(self,root:Path,seed:int=1950): self.root=Path(root); self.seed=seed; self.rng=random.Random(seed)
    def build(self,failures:Sequence[Dict[str,Any]],limit:int=128)->Dict[str,Any]:
        seen=set(); rows=[]
        for f in failures:
            key=json.dumps((f.get('tape'),f.get('expected'),f.get('got')),sort_keys=True)
            if key in seen: continue
            seen.add(key); novelty=1.0/(1+len(rows)); rows.append({'tape':f.get('tape',[]),'expected':f.get('expected'),'got':f.get('got'),'weight':1.0+novelty,'source':'counterexample'})
        self.rng.shuffle(rows); rows=rows[:limit]
        out={'version':'1.9.0','items':rows,'count':len(rows)}; p=self.root/'runtime'/'nomega_counterexample_curriculum_v1.json'; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(out,indent=2)); return out
