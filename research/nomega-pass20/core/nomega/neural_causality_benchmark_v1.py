from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Callable, Dict, Sequence
import json

@dataclass(frozen=True)
class NeuralAblationReportV1:
    baseline:dict; neural:dict; frozen:dict; delta:dict; causal:bool
    def to_dict(self):return asdict(self)

class NeuralCausalityBenchmarkV1:
    VERSION='neural-causality-benchmark-v1'
    def __init__(self,root:Path,seed:int=61):self.root=Path(root);self.seed=int(seed)
    def compare(self,baseline:dict,neural:dict,frozen:dict,tolerance:float=0.02)->NeuralAblationReportV1:
        metrics=set(baseline)|set(neural)|set(frozen); delta={k:float(neural.get(k,0))-float(frozen.get(k,0)) for k in metrics}; delta['neural_vs_frozen']=float(neural.get('verified_rate',neural.get('score',0)))-float(frozen.get('verified_rate',frozen.get('score',0))); delta['neural_vs_baseline']=float(neural.get('verified_rate',neural.get('score',0)))-float(baseline.get('verified_rate',baseline.get('score',0))); causal=abs(float(delta.get('verified_rate',0)))>=float(tolerance) or abs(float(delta.get('score',0)))>=float(tolerance)
        return NeuralAblationReportV1(dict(baseline),dict(neural),dict(frozen),delta,causal)
    def run_ablation(self,families:Sequence[str],trainer_factory:Callable,evaluator:Callable)->NeuralAblationReportV1:
        baseline=evaluator(mode='baseline',families=families); frozen=evaluator(mode='frozen',families=families); neural=evaluator(mode='neural',families=families); report=self.compare(baseline,neural,frozen); (self.root/'runtime').mkdir(parents=True,exist_ok=True); (self.root/'runtime'/'neural_causality_benchmark_v1.json').write_text(json.dumps(report.to_dict(),indent=2)); return report
    def milestone(self,report:NeuralAblationReportV1,*,holdout_gain:float=0,unseen_gain:float=0,efficiency_gain:float=0,autonomous_cycles:int=0,rollback_ok:bool=False)->str:
        if autonomous_cycles>=2 and efficiency_gain>0 and unseen_gain>0 and holdout_gain>0 and report.causal and rollback_ok:return 'N5'
        if efficiency_gain>0 and unseen_gain>0 and holdout_gain>0 and report.causal:return 'N4'
        if unseen_gain>0 and holdout_gain>0 and report.causal:return 'N3'
        if holdout_gain>0 and report.causal:return 'N2'
        if report.causal:return 'N1'
        return 'N0'
