from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Callable, Dict
import hashlib, json, time
from .developmental_bottleneck_detector_v1 import DevelopmentalBottleneckDetectorV1
from .learning_experiment_protocol_v1 import LearningExperimentProtocolV1
from .metaproductivity_v1 import MetaproductivityTrackerV1
from .self_evolution_control_plane_v2 import SelfEvolutionControlPlaneV2

@dataclass(frozen=True)
class SelfImprovementCycleV1:
    bottleneck:str; hypothesis:str; intervention:str; experiment_id:str
@dataclass(frozen=True)
class SelfImprovementResultV1:
    accepted:bool; gain:float; bottleneck:str; experiment_id:str; decision:str; evidence:dict
    def to_dict(self):return asdict(self)

class SelfImprovementLoopV1:
    VERSION='self-improvement-loop-v1'
    def __init__(self,root:Path,seed:int=51):
        self.root=Path(root); self.seed=int(seed); self.detector=DevelopmentalBottleneckDetectorV1(self.root); self.protocol=LearningExperimentProtocolV1(self.root); self.control=SelfEvolutionControlPlaneV2(self.root); self.meta=MetaproductivityTrackerV1(self.root); self.path=self.root/'runtime'/'self_improvement_cycles_v1.jsonl'
    def run_cycle(self,metrics:dict,candidate_factory:Callable,evaluator:Callable)->SelfImprovementResultV1:
        analysis=self.detector.analyze(metrics); primary=analysis.get('primary') or {'name':'unknown','action':'measure_bottleneck'}; bottleneck=str(primary['name']); intervention=str(primary['action']); hypothesis=f'Intervention {intervention} reduces bottleneck {bottleneck} under independent evaluation.'
        request=self.protocol.make_request(bottleneck=bottleneck,hypothesis=hypothesis,intervention=intervention,seed=self.seed,baseline_hash=hashlib.sha256(json.dumps(metrics,sort_keys=True).encode()).hexdigest()[:24],dataset_fingerprint=hashlib.sha256(json.dumps(sorted(metrics.keys())).encode()).hexdigest()[:24])
        candidate=candidate_factory(request)
        candidate_eval=dict(evaluator(candidate))
        baseline_eval={'holdout':float(metrics.get('baseline_holdout',0.0)),'ood':float(metrics.get('baseline_ood',0.0)),'verified_rate':float(metrics.get('baseline_verified_rate',0.0)),'latency_ms':float(metrics.get('baseline_latency_ms',10.0)),'memory_mb':float(metrics.get('baseline_memory_mb',10.0)),'restart_delta':0.0}
        candidate_eval.setdefault('quorum',{})
        result=self.protocol.compare(baseline_eval,candidate_eval,candidate_eval.get('quorum',{}))
        decision='accepted' if result.accepted else ';'.join(result.reasons)
        cycle=SelfImprovementCycleV1(bottleneck,hypothesis,intervention,request.id)
        candidate_hash=hashlib.sha256(json.dumps(candidate,sort_keys=True,default=str).encode()).hexdigest()[:24]
        self.meta.record(candidate_hash=candidate_hash,parent_hash=request.baseline_hash,cycle_id=request.id,verified_gain=result.gain,compute_cost=max(1.0,float(candidate_eval.get('latency_ms',1.0))),repair_success=bool(candidate_eval.get('repair_success',False)),transfer_gain=float(candidate_eval.get('transfer_gain',0.0)))
        payload={'cycle':asdict(cycle),'result':result.to_dict(),'candidate_hash':candidate_hash,'timestamp':time.time()}
        self.path.parent.mkdir(parents=True,exist_ok=True); self.path.open('a',encoding='utf-8').write(json.dumps(payload,sort_keys=True,default=str)+'\n')
        return SelfImprovementResultV1(result.accepted,result.gain,bottleneck,request.id,decision,payload)
