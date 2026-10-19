import torch
from neurocore.v41 import NeuroWeaveV41,mobile_v41_config

def test_v41_forward_and_composition():
    torch.manual_seed(3); c=mobile_v41_config(); m=NeuroWeaveV41(c); x=torch.randn(2,4,9); y=torch.randn(2,4,9)
    out=m(x,target_sequence=y); assert out['composition_v41'].shape==(2,4,c.d); assert out['_final_state'].composition_probs.shape[-1]==c.skill_vector_count_v40

def test_v41_gradients():
    torch.manual_seed(5); c=mobile_v41_config(); m=NeuroWeaveV41(c); x=torch.randn(2,3,9); y=torch.randn(2,3,9); out=m(x,target_sequence=y); loss=m.training_loss(out,target_sequence=y); loss.backward();
    assert any(p.grad is not None and torch.isfinite(p.grad).all() for p in m.parameters() if p.requires_grad)

def test_v41_transition_update():
    torch.manual_seed(7); c=mobile_v41_config(); m=NeuroWeaveV41(c); s=m.initial_state(4); before=m.composer.transition_logits.detach().clone(); r=torch.tensor([[1.],[0.5],[-.5],[1.]])
    m.composer.transition_update(s.composition_probs,s.composition_probs,r,c.composition_transition_lr_v41,c.composition_transition_decay_v41)
    assert not torch.equal(before,m.composer.transition_logits.detach())

def test_v41_mobile_param_budget():
    c=mobile_v41_config(); m=NeuroWeaveV41(c); n=sum(p.numel() for p in m.parameters()); assert n<130000
