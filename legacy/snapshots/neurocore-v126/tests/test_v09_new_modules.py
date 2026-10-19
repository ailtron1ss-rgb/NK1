import torch
from neurocore.plasticity_v3 import EligibilityTrace,PlasticityController
from neurocore.binding_v3 import CrossModalBinder
from neurocore.counterfactual_v3 import LatentCounterfactual
from neurocore.energy_v3 import LatentEnergyModel
from neurocore.eval_v09 import classify

def test_eligibility_trace_is_bounded_and_stateful():
    m=EligibilityTrace(12); st=m.initial_state(2); x=torch.randn(2,12); e=torch.randn(2,1)
    a,st=m(x,e,st); b,st2=m(x,e,st)
    assert a.shape==(2,12) and b.shape==(2,12)
    assert torch.isfinite(b).all(); assert not torch.allclose(a,b)

def test_cross_modal_binding_normalizes_weights():
    m=CrossModalBinder(16,4); ev=[torch.randn(3,16) for _ in range(4)]
    z,w,a=m(ev); assert z.shape==(3,16); assert torch.allclose(w.sum(1),torch.ones(3),atol=1e-5)

def test_counterfactual_effect_changes_with_action():
    m=LatentCounterfactual(12); z=torch.randn(2,12); a=torch.randn(2,12); b=-a
    r1=m(z,a,b); r2=m(z,b,a); assert not torch.allclose(r1.effect,r2.effect)

def test_energy_model_and_margin_loss():
    m=LatentEnergyModel(8); z=torch.randn(2,8); mem=torch.randn(2,8); nxt=torch.randn(2,8)
    e=m(z,mem,nxt); assert e.shape==(2,1); assert m.margin_loss(e,e+1).item()==0

def test_evidence_policy():
    x=classify('memory',0.8,0.7,5); y=classify('memory',0.8,0.7,1)
    assert x.status=='PROVEN'; assert y.status=='FUNCTIONAL INDICATOR'
