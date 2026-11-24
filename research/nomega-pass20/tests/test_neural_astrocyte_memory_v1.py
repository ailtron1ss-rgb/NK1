import torch
from core.nomega.neural_astrocyte_memory_v1 import AstrocyteMemoryControllerV1

def test_sparse_astrocyte_sequence_and_memory():
    a=AstrocyteMemoryControllerV1(16,astrocytes=8,top_k=2)
    x=torch.randn(6,16)
    y=a(x,rewards=torch.linspace(0,1,6))
    assert y['gates'].shape==(6,16)
    assert y['contexts'].shape==(6,8)
    m=a.metrics().to_dict(); assert 0<=m['active_fraction']<=1
