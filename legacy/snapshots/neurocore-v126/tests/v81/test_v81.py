from pathlib import Path
import tempfile
import torch
from neurocore.v81 import *
from neurocore.frontier import CURRENT_FRONTIER

def batch():
    return torch.randn(2,4,9), torch.randn(2,4,8)

def test_surface_and_contract():
    m=NeuroWeaveV81(mobile_v81_config(9)); r=m.learning_parameter_report_v81()
    assert CURRENT_FRONTIER>=81; assert r['active_fraction']>0.40; assert r['active_fraction']<0.60
    assert m.multiscale_v56 is not None and m.self_model_v55 is not None

def test_self_and_multiscale_paths_have_gradients():
    m=NeuroWeaveV81(mobile_v81_config(9)); x,g=batch(); out=m.forward_learning_v81(x,g); out['loss'].backward()
    names={n for n,p in m.named_parameters() if p.requires_grad and p.grad is not None and torch.isfinite(p.grad).all() and p.grad.abs().sum()>0}
    assert any(n.startswith('self_model_v55.') for n in names); assert any(n.startswith('multiscale_v56.') for n in names)
    assert any(n.startswith('cognitive_bridge_v81.') for n in names)

def test_learning_step_is_real():
    m=NeuroWeaveV81(mobile_v81_config(9)); t=OrganismTrainerV81(m,lr=5e-4); x,g=batch()
    before={n:p.detach().clone() for n,p in m.named_parameters() if p.requires_grad}; s=t.learning_step_v81(x,g)
    changed=sum(1 for n,p in m.named_parameters() if p.requires_grad and not torch.equal(before[n],p.detach()))
    assert changed>20 and s['gradient_coverage']>0.45 and s['steps']==1.0

def test_checkpoint_roundtrip():
    m=NeuroWeaveV81(mobile_v81_config(9)); t=OrganismTrainerV81(m); x,g=batch(); t.learning_step_v81(x,g)
    p=Path(tempfile.gettempdir())/'nc_v81.pt'; RuntimeStateStoreV81.save(p,m,t)
    m2=NeuroWeaveV81(mobile_v81_config(9)); t2=OrganismTrainerV81(m2); r=RuntimeStateStoreV81.load(p,m2,t2)
    assert r['version']==81 and r['optimizer_loaded'] and not r['shape_mismatch']; p.unlink(missing_ok=True)

def test_cognitive_bridge_changes_loss():
    torch.manual_seed(3); m=NeuroWeaveV81(mobile_v81_config(9)); x,g=batch(); o1=m.forward_learning_v81(x,g)['loss'].detach();
    for p in m.cognitive_bridge_v81.parameters(): p.data.add_(0.02)
    o2=m.forward_learning_v81(x,g)['loss'].detach()
    assert not torch.allclose(o1,o2)

def test_runtime_v81_integrates_cognition():
    m=NeuroWeaveV81(mobile_v81_config(9)); r=OrganismRuntimeV81(m, trainer=OrganismTrainerV81(m))
    o=r.step(torch.randn(9), torch.randn(8))
    assert o['v81_runtime_integrated'].item()==1.0
    assert torch.isfinite(o['v81_self_prediction']).all() and torch.isfinite(o['v81_multiscale_fused']).all()
    assert o['v81_action_correction'].abs().max().item()<=0.100001


def test_runtime_checkpoint_preserves_current_state():
    from pathlib import Path
    import tempfile
    m=NeuroWeaveV81(mobile_v81_config(9)); r=OrganismRuntimeV81(m, trainer=OrganismTrainerV81(m))
    r.step(torch.randn(9), torch.randn(8)); r.step(torch.randn(9), torch.randn(8))
    p=Path(tempfile.gettempdir())/'nc_v81_runtime.pt'; RuntimeStateStoreV81.save(p,m,r.trainer,r)
    m2=NeuroWeaveV81(mobile_v81_config(9)); t2=OrganismTrainerV81(m2); r2=OrganismRuntimeV81(m2,t2)
    rr=RuntimeStateStoreV81.load(p,m2,t2,r2)
    assert rr['version']==81 and r2.steps==2
    assert r2.self_state.self_state.device==next(m2.parameters()).device
    out=r2.step(torch.randn(9),torch.randn(8)); assert torch.isfinite(out['action']).all()
    p.unlink(missing_ok=True)
