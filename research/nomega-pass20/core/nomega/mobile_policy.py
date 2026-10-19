from __future__ import annotations
"""Runtime policy turning device state into conservative NΩ settings."""
from dataclasses import dataclass, asdict

@dataclass
class MobileDecision:
    profile:str; max_steps:int; max_experts:int; max_candidates:int; use_audio:bool; use_vision:bool; reason:str
    def to_dict(self): return asdict(self)

class MobilePolicy:
    def choose(self,ram_gb=4.0,battery=.8,thermal=.2,has_npu=False,request_modality='text'):
        if thermal>.85 or battery<.15: profile='low'; steps=1; experts=1; candidates=1
        elif ram_gb<3 or battery<.30: profile='low'; steps=2; experts=1; candidates=2
        elif ram_gb<6: profile='medium'; steps=3; experts=2 if has_npu else 1; candidates=3
        else: profile='high'; steps=5; experts=2; candidates=4
        return MobileDecision(profile,steps,experts,candidates,request_modality=='audio' and profile!='low',request_modality=='vision' and profile!='low',f'profile={profile}; battery={battery:.2f}; thermal={thermal:.2f}')
