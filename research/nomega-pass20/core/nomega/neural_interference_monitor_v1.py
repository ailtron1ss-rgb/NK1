from __future__ import annotations
from typing import Sequence
import math

class NeuralInterferenceMonitorV1:
    VERSION='neural-interference-monitor-v1'
    @staticmethod
    def gradient_cosine(g1:Sequence[float], g2:Sequence[float])->float:
        a=[float(x) for x in g1]; b=[float(x) for x in g2];
        na=math.sqrt(sum(x*x for x in a)); nb=math.sqrt(sum(x*x for x in b))
        if na==0.0 or nb==0.0: return 0.0
        return max(-1.0,min(1.0,sum(x*y for x,y in zip(a,b))/(na*nb)))
    def analyze(self, proposed:Sequence[Sequence[float]], anchors:Sequence[Sequence[float]])->dict:
        vals=[]
        for g in proposed:
            for a in anchors:
                vals.append(self.gradient_cosine(g,a))
        if not vals:
            return {'mean_alignment':0.0,'conflict_rate':0.0,'worst_conflict':0.0,'expected_anchor_delta':0.0,'measured_anchor_delta':0.0}
        neg=[v for v in vals if v<0]
        return {'mean_alignment':float(sum(vals)/len(vals)),'conflict_rate':float(len(neg)/len(vals)),'worst_conflict':float(min(vals)),'expected_anchor_delta':float(max(0.0,-sum(vals)/len(vals))),'measured_anchor_delta':0.0}
