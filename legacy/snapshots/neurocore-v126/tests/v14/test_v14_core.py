import torch
from src.neurocore.v14.neuroweave_v8 import NeuroWeaveV8
def test_forward_and_state():
 m=NeuroWeaveV8(8,12,4,8,2,3); o,s=m(torch.randn(2,5,8)); assert o["latent"].shape==(2,5,8); assert torch.all(s.step==5)
def test_no_parameter_write():
 m=NeuroWeaveV8(8,12,4,8,2,3); x=torch.randn(1,4,8); b={k:v.detach().clone() for k,v in m.named_parameters()}; m(x); assert all(torch.equal(b[k],v) for k,v in m.named_parameters())
def test_deep_path():
 m=NeuroWeaveV8(8,12,4,8,2,3); x=torch.randn(1,4,8); a,_=m(x); mask=torch.ones(1,4,dtype=torch.bool); b,_=m(x,deep_mask=mask); assert (a["latent"]-b["latent"]).abs().mean()>0
