from __future__ import annotations
from typing import Sequence,Dict,Any
import math

def brier(probs:Sequence[float],labels:Sequence[int])->float:
    return sum((float(p)-float(y))**2 for p,y in zip(probs,labels))/max(1,len(labels))

def ece(probs:Sequence[float],labels:Sequence[int],bins:int=10)->float:
    n=len(labels); total=0.0
    if n==0:return 0.0
    for i in range(bins):
        lo=i/bins; hi=(i+1)/bins
        idx=[j for j,p in enumerate(probs) if (p>=lo and (p<hi or i==bins-1))]
        if not idx: continue
        conf=sum(float(probs[j]) for j in idx)/len(idx); acc=sum(int(labels[j]) for j in idx)/len(idx); total += len(idx)/n*abs(conf-acc)
    return total

def abstention_report(probs:Sequence[float],labels:Sequence[int],threshold:float=.5)->Dict[str,float]:
    kept=[i for i,p in enumerate(probs) if float(p)>=threshold]
    abstain=1-len(kept)/max(1,len(labels)); acc=sum(int(labels[i]) for i in kept)/max(1,len(kept))
    return {'threshold':threshold,'coverage':1-abstain,'abstention_rate':abstain,'selective_accuracy':acc}
