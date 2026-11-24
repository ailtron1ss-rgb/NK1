from __future__ import annotations
"""Controlled evolution loop for NΩ configurations and skills.

This is an experiment manager, not autonomous self-rewriting source code.
"""
from dataclasses import dataclass, asdict
from typing import Any, Dict, List
import copy

@dataclass
class CandidateConfig:
    name:str; overrides:Dict[str,Any]; score:float=0.0; verified_rate:float=0.0; latency_ms:float=0.0
    def to_dict(self): return asdict(self)

class EvolutionController:
    def propose(self):
        return [CandidateConfig('mobile_light',{'latent_dim':32,'router_hidden':24,'top_k':1,'max_reason_steps':2}),CandidateConfig('mobile_balanced',{'latent_dim':48,'router_hidden':32,'top_k':1,'max_reason_steps':3}),CandidateConfig('reasoning',{'latent_dim':64,'router_hidden':48,'top_k':2,'max_reason_steps':4})]
    @staticmethod
    def rank(rows): return sorted(rows,key=lambda x:(x.verified_rate,-x.latency_ms),reverse=True)
