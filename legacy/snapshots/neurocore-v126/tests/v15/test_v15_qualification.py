import torch
from neurocore.v15.neuroweave_v9 import NeuroWeaveV9
from neurocore.v15.qualification_v15 import params

def test_param_counter(): assert params(NeuroWeaveV9())>0

def test_cpu_smoke():
    m=NeuroWeaveV9(); x=torch.randn(1,3,16); y,_=m(x); assert torch.isfinite(y['evidence']).all()
