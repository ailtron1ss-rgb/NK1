import torch
from torch import nn
from neurocore.model_v07 import NeuroWeaveCore

class ExportWrapper(nn.Module):
    def __init__(self,m): super().__init__(); self.m=m
    def forward(self,x): return self.m.export_forward(x)

def test_static_export_graph_is_torch_exportable():
    torch.manual_seed(41); m=NeuroWeaveCore(d_model=16,fast_state=20,slow_state=20,memory_capacity=8,n_experts=2,top_k=1,attention_heads=2).eval()
    example=torch.randn(1,4,16)
    ep=torch.export.export(ExportWrapper(m),(example,))
    outputs=ep.module()(example)
    assert len(outputs)==4 and all(torch.isfinite(x).all() for x in outputs)
