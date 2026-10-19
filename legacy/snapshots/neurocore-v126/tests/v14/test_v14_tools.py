import torch
from src.neurocore.v14.neuroweave_v8 import NeuroWeaveV8
from src.neurocore.v14.interventions_v14 import lesion
from src.neurocore.v14.causal_v14 import rank_lesions
def test_lesion_restores():
 m=NeuroWeaveV8(8,12,4,8,2,3); b=[p.detach().clone() for p in m.parameters()];
 with lesion(m,"evidence.net"): pass
 assert all(torch.equal(a,b) for a,b in zip(m.parameters(),b))
def test_rank():
 m=NeuroWeaveV8(8,12,4,8,2,3); r=rank_lesions(m,torch.randn(1,5,8),["evidence.net","route.0","predictor.0"]); assert r
