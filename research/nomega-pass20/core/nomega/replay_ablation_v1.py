from __future__ import annotations

"""Deterministic component benchmark for replay selection quality.

This benchmark does not claim downstream learning improvement. It measures whether
transfer-aware scheduling selects experience with higher transfer utility than the
legacy recency/reward heuristic under identical candidate sets.
"""

from pathlib import Path
from typing import Any, Dict, List, Sequence
import json, tempfile

from .adaptive_experience_memory_v3 import AdaptiveExperienceMemoryV3


class ReplayAblationV1:
    VERSION = "1.9.8"

    def __init__(self, root: Path):
        self.root = Path(root)

    def _scenario(self, idx: int) -> Dict[str, Any]:
        root = self.root / f"scenario_{idx}"
        mem = AdaptiveExperienceMemoryV3(root)
        cases = []
        # Same candidate pool in both policies; only ranking differs.
        rows = [
            ("sum3", .80, f"anchor-{idx}", +0.0),
            ("positive", .95, f"positive-{idx}", +0.8),
            ("neutral", .93, f"neutral-{idx}", 0.0),
            ("negative", .99, f"negative-{idx}", -0.9),
            ("older_positive", .78, f"older-positive-{idx}", +0.7),
        ]
        keys = {}
        for family, reward, text, transfer in rows:
            code=[(1,0,0),(14,0,0)]
            keys[text]=mem.store_verified(family=family,text=text,code=code,reward=reward,source="ablation",cycle_id=f"s{idx}",confidence=.95,status="trusted")
            if family != "sum3":
                mem.observe_transfer(family,"target",transfer,cycle_id=f"s{idx}")
        # Make negative/neutral more recent than positive so static retrieval prefers them.
        now=1_000_000.0 + idx
        for row in mem.state['records']:
            row['created_at']=now
            row['last_used']=now
        mem._save()
        static = mem.retrieve_replay_mix(('sum3','positive','neutral','negative','older_positive'),max_items=3,current_family='target',anchor_families=('sum3',))
        # Fresh instance shares exactly the same memory state, but uses transfer-aware ranking.
        adaptive = mem.retrieve_replay_transfer_aware(('sum3','positive','neutral','negative','older_positive'),max_items=3,current_family='target',anchor_families=('sum3',))
        transfer = {"positive":0.8,"negative":-0.9,"neutral":0.0,"older_positive":0.7,"sum3":0.0}
        def utility(items):
            fams=[str(x['record']['family']) for x in items]
            return sum(transfer.get(f,0.0) for f in fams if f!='sum3') + (1.0 if 'sum3' in fams else 0.0)
        result={
            'static_families':[x['record']['family'] for x in static],
            'adaptive_families':[x['record']['family'] for x in adaptive],
            'static_utility':utility(static),
            'adaptive_utility':utility(adaptive),
            'anchor_preserved': 'sum3' in [x['record']['family'] for x in adaptive],
        }
        return result

    def run(self, scenarios:int=12)->Dict[str,Any]:
        results=[self._scenario(i) for i in range(max(1,int(scenarios)))]
        deltas=[float(r['adaptive_utility'])-float(r['static_utility']) for r in results]
        return {
            'version':self.VERSION,
            'scenarios':len(results),
            'results':results,
            'mean_utility_delta':sum(deltas)/len(deltas),
            'all_anchor_preserved':all(r['anchor_preserved'] for r in results),
            'adaptive_better_count':sum(d>0 for d in deltas),
            'static_better_count':sum(d<0 for d in deltas),
            'tie_count':sum(d==0 for d in deltas),
            'interpretation':'component-selection evidence only; not a downstream learning gain',
        }
