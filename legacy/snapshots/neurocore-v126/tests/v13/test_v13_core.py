import torch
from neurocore.neuroweave_v7 import NeuroWeaveV7
from neurocore.causal_probe_v7 import LatentCausalProbe
from neurocore.active_policy_v7 import ActiveInformationPolicy
from neurocore.drift_recovery_v7 import DriftRecoveryController
from neurocore.local_plasticity_v7 import EligibilityPlasticity

def test_forward_shapes_and_finite():
 m=NeuroWeaveV7(16,6,capacity=16); x=torch.randn(2,8,16); o,s=m(x)
 assert o['latent'].shape==(2,8,16); assert torch.isfinite(o['latent']).all(); assert torch.isfinite(o['energy']).all()
 assert s.field.step.shape==(2,1)

def test_memory_changes_latent_after_write():
 m=NeuroWeaveV7(8,4,capacity=8); x=torch.randn(1,3,8); o,s=m(x); before=o['latent'][:,-1]
 o2,s2=m(x[:,-1:],s); assert torch.isfinite(o2['latent_with_memory']).all(); assert not torch.equal(before,o2['latent_with_memory'][:,-1])

def test_causal_probe_intervention_positive():
 p=LatentCausalProbe(8,4); z=torch.randn(3,8); a=torch.randn(3,4); b=torch.randn(3,4); g=p.intervention_gap(z,a,b); assert (g>=0).all()

def test_active_policy_normalizes():
 p=ActiveInformationPolicy(8,4); z=torch.randn(2,8); a=torch.randn(2,5,4); prob,u,ig=p(z,a); assert torch.allclose(prob.sum(-1),torch.ones(2)); assert (ig>=0).all()

def test_recovery_bounded():
 c=DriftRecoveryController(); g=c(torch.tensor([[0.9]]),torch.tensor([[0.8]])); assert float(g.item())<=0.5+1e-6

def test_local_plasticity_trace_shape():
 p=EligibilityPlasticity(8); old=torch.zeros(2,8); tr=p.trace(torch.randn(2,8),torch.randn(2,8),torch.ones(2,1),old); assert tr.shape==(2,8)
