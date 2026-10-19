from __future__ import annotations
from typing import Any, Dict
import random
from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2

class ProgramEquivalenceV2:
    """Bounded behavioral equivalence checker using the canonical v2 runtime path.

    Equivalence is never treated as a formal proof: absence of sampled counterexamples
    only certifies sampled behavioral agreement.
    """
    def __init__(self, seed:int=91, trials:int=64): self.seed=seed; self.trials=trials
    def check(self, left, right, width:int=8)->Dict[str,Any]:
        rng=random.Random(self.seed); mismatches=[]; hvm_mismatches=[]
        for _ in range(self.trials):
            tape=[rng.randrange(256) for _ in range(width)]
            a=run_tiny_v2(left,tape); b=run_tiny_v2(right,tape)
            av=a.get('result'); bv=b.get('result')
            if not a.get('ok') or not b.get('ok') or av!=bv:
                mismatches.append({'tape':tape,'left':a,'right':b})
                if len(mismatches)>=8: break
            if a.get('ok') and b.get('ok'):
                ha=run_hvm_compiled_v2(left,tape); hb=run_hvm_compiled_v2(right,tape)
                if ha.get('ok') and hb.get('ok') and ha.get('result')!=hb.get('result'):
                    hvm_mismatches.append({'tape':tape,'left':ha.get('result'),'right':hb.get('result')})
        return {'equivalent':len(mismatches)==0,'trials':self.trials,
                'counterexamples':mismatches,'counterexample_count':len(mismatches),
                'hvm_mismatches':hvm_mismatches,'hvm_counterexample_count':len(hvm_mismatches)}
