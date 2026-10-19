from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Callable, Dict, Sequence
import hashlib, json, time
from .experiment_registry_v2 import ExperimentRegistryV2

@dataclass(frozen=True)
class ExperimentRequestV1:
    id:str; bottleneck:str; hypothesis:str; intervention:str; seed:int; baseline_hash:str; dataset_fingerprint:str
@dataclass(frozen=True)
class EvaluationBundleV1:
    baseline:dict; candidate:dict; independent_runs:int; seeds:tuple; trajectory_hashes:tuple; holdout_id:str; ood_id:str; artifacts:tuple
    def to_dict(self): return asdict(self)
@dataclass(frozen=True)
class ComparisonResultV1:
    accepted:bool; gain:float; reasons:tuple; metrics:dict
    def to_dict(self): return asdict(self)

class LearningExperimentProtocolV1:
    VERSION='learning-experiment-protocol-v1'
    def __init__(self,root:Path): self.root=Path(root); self.registry=ExperimentRegistryV2(self.root); self.log=self.root/'runtime'/'experiments_v3.jsonl'
    @staticmethod
    def fingerprint(mapping:Dict[str,Any])->str:return hashlib.sha256(json.dumps(mapping,sort_keys=True,separators=(',',':'),default=str).encode()).hexdigest()
    def make_request(self,*,bottleneck:str,hypothesis:str,intervention:str,seed:int,baseline_hash:str,dataset_fingerprint:str)->ExperimentRequestV1:
        payload={'bottleneck':bottleneck,'hypothesis':hypothesis,'intervention':intervention,'seed':int(seed),'baseline_hash':baseline_hash,'dataset_fingerprint':dataset_fingerprint}
        return ExperimentRequestV1(self.fingerprint(payload)[:24],**payload)
    def compare(self,baseline:dict,candidate:dict,quorum:dict)->ComparisonResultV1:
        reasons=[]
        if not str(quorum.get('holdout_id','')).strip() or not str(quorum.get('ood_id','')).strip(): reasons.append('holdout_or_ood_identity')
        if int(quorum.get('independent_runs',0))<2: reasons.append('independent_runs')
        th=quorum.get('trajectory_hashes',()); th_count=int(th) if isinstance(th,(int,float)) else len(tuple(th))
        sd=quorum.get('seeds',()); seed_count=int(sd) if isinstance(sd,(int,float)) else len(tuple(sd))
        if th_count<3: reasons.append('trajectory_hashes')
        if seed_count<3: reasons.append('seeds')
        if float(candidate.get('holdout',0)) < float(baseline.get('holdout',0)) + .01: reasons.append('holdout_gain')
        if float(candidate.get('verified_rate',0)) < float(baseline.get('verified_rate',0)): reasons.append('verified_regression')
        if float(candidate.get('ood',0)) < float(baseline.get('ood',0))-.05: reasons.append('ood')
        if abs(float(candidate.get('restart_delta',0)))>1e-9: reasons.append('restart')
        if float(candidate.get('latency_ms',0)) > max(1e9,float(baseline.get('latency_ms',0))*1.25): reasons.append('latency')
        if float(candidate.get('memory_mb',0)) > max(1e9,float(baseline.get('memory_mb',0))*1.25): reasons.append('memory')
        return ComparisonResultV1(not reasons,float(candidate.get('holdout',0))-float(baseline.get('holdout',0)),tuple(reasons),{'baseline':baseline,'candidate':candidate})
    def run(self,request:ExperimentRequestV1,evaluator:Callable[[Any],dict],candidate_factory:Callable[[ExperimentRequestV1],Any])->ComparisonResultV1:
        candidate=candidate_factory(request); cand=evaluator(candidate); baseline=evaluator({'baseline':True}); q=cand.get('quorum',{}); result=self.compare(baseline,cand,q); artifact_paths=[Path(x) for x in cand.get('artifacts',[]) if Path(x).exists()]; arts=[str(x)+':'+self.registry.sha256(x) for x in artifact_paths]
        payload={'request':asdict(request),'result':result.to_dict(),'artifacts':arts,'timestamp':time.time()}; self.log.parent.mkdir(parents=True,exist_ok=True); self.log.open('a',encoding='utf-8').write(json.dumps(payload,sort_keys=True,default=str)+'\n'); self.registry.record(request.id,result.to_dict(),arts); return result
