import torch
from src.neurocore.v14.neuroweave_v8 import NeuroWeaveV8
from src.neurocore.v14.quantization_v14 import model_output_drift
def test_quant_drift():
 d=model_output_drift(NeuroWeaveV8(8,12,4,8,2,3),torch.randn(1,4,8)); assert all(v>=0 for v in d.values())
