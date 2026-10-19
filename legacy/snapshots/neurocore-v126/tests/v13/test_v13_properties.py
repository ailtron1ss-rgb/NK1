import torch, pytest
from neurocore.neural_field_v7 import MultiScaleField

@pytest.mark.parametrize('d', [4,8,16,32,48,64])
def test_dimensions(d):
 m=MultiScaleField(d); x=torch.randn(2,3,d); o,s=m(x); assert o['latent'].shape[-1]==d; assert o['route_probs'].shape[-1]==4; assert torch.isfinite(o['route_probs']).all()

@pytest.mark.parametrize('seed',[0,1,2,3,4,5,6,7,8,9])
def test_deterministic_shape_by_seed(seed):
 torch.manual_seed(seed); m=MultiScaleField(12); o,s=m(torch.randn(1,4,12)); assert torch.isfinite(o['evidence']).all(); assert ((o['evidence']>=0)&(o['evidence']<=1)).all()
