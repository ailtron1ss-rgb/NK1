from __future__ import annotations
import math
from typing import Any, Dict, Iterable, List, Sequence, Tuple

class ConfidenceCalibratorV2:
    """Post-hoc reliability calibration for bounded verified/unverified events."""
    def __init__(self, temperature: float = 1.0):
        self.temperature=float(max(0.1,temperature))
        self.bias=0.0
        self.fitted=False

    def fit(self, probs: Sequence[float], labels: Sequence[int]) -> Dict[str,float]:
        if not probs or len(probs)!=len(labels):
            return {'temperature':self.temperature,'bias':self.bias,'count':0}
        p=[min(.999,max(.001,float(x))) for x in probs]
        y=[int(x) for x in labels]
        # Small deterministic coordinate-descent fit; avoids a heavy optimizer for mobile.
        best=(1e9,self.temperature,self.bias)
        for t in [0.5,0.7,0.85,1.0,1.2,1.5,2.0]:
            for b in [-0.2,-0.1,0.0,0.1,0.2]:
                loss=0.0
                for pi,yi in zip(p,y):
                    z=math.log(pi/(1-pi))/t+b
                    q=1/(1+math.exp(-z))
                    loss += -(yi*math.log(max(q,1e-8))+(1-yi)*math.log(max(1-q,1e-8)))
                if loss<best[0]: best=(loss,t,b)
        _,self.temperature,self.bias=best; self.fitted=True
        return {'temperature':self.temperature,'bias':self.bias,'count':len(p)}

    def calibrate(self, p: float) -> float:
        p=min(.999,max(.001,float(p)))
        z=math.log(p/(1-p))/self.temperature+self.bias
        return 1/(1+math.exp(-z))

    def metrics(self, probs: Sequence[float], labels: Sequence[int], bins:int=10)->Dict[str,float]:
        if not probs: return {'brier':1.0,'ece':1.0,'accuracy':0.0}
        preds=[self.calibrate(p) for p in probs]
        y=[int(x) for x in labels]
        brier=sum((p-t)**2 for p,t in zip(preds,y))/len(y)
        acc=sum(int((p>=.5)==bool(t)) for p,t in zip(preds,y))/len(y)
        ece=0.0
        for i in range(bins):
            lo=i/bins; hi=(i+1)/bins
            bucket=[j for j,p in enumerate(preds) if lo <= p < hi or (i==bins-1 and p<=hi)]
            if bucket:
                conf=sum(preds[j] for j in bucket)/len(bucket); rate=sum(y[j] for j in bucket)/len(bucket)
                ece += len(bucket)/len(y)*abs(conf-rate)
        return {'brier':brier,'ece':ece,'accuracy':acc}
