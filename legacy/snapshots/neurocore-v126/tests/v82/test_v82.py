from pathlib import Path
import tempfile
import time
import torch

from neurocore.frontier import CURRENT_FRONTIER
from neurocore.v82 import (
    NeuroWeaveV82,
    OrganismTrainerV82,
    OrganismRuntimeV82,
    RuntimeStateStoreV82,
    SelectiveDeltaSpineV82,
    mobile_v82_config,
)


def batch(seed=0):
    g=torch.Generator().manual_seed(seed)
    return torch.randn(2,5,9,generator=g), torch.randn(2,5,8,generator=g)


def test_surface_and_parameter_contract():
    m=NeuroWeaveV82(mobile_v82_config(9)); rep=m.learning_parameter_report_v82()
    assert CURRENT_FRONTIER>=82
    assert 0.40 < rep['active_fraction'] < 0.55
    assert rep['replaced_v80_spine_parameters'] > 0


def test_delta_spine_matches_public_state_contract():
    s=SelectiveDeltaSpineV82(141,64,54,20,rank=8)
    x=torch.randn(2,141)
    o=s.step(x)
    assert o['state'].shape==(2,64)
    assert o['memory_context'].shape==(2,54)
    assert o['next_latent'].shape==(2,20)
    assert torch.isfinite(o['state']).all()


def test_learning_step_is_real_and_balanced():
    m=NeuroWeaveV82(mobile_v82_config(9)); t=OrganismTrainerV82(m,lr=3e-4); x,g=batch(1)
    before={n:p.detach().clone() for n,p in m.named_parameters() if p.requires_grad}
    r=t.learning_step_v82(x,g)
    changed=sum(1 for n,p in m.named_parameters() if p.requires_grad and not torch.equal(before[n],p.detach()))
    assert changed>30
    assert r['gradient_coverage']>0.45
    assert 0.30 <= r['objective_weight_min'] <= 3.0
    assert 0.30 <= r['objective_weight_max'] <= 3.0


def test_stateful_recurrence_changes_state_over_sequence():
    m=NeuroWeaveV82(mobile_v82_config(9)); x,g=batch(2)
    out=m.forward_learning_v82(x,g)
    states=out['spine_state']
    assert states.shape[1]==x.size(1)
    assert (states[:,1:]-states[:,:-1]).abs().sum().item()>0


def test_adaptive_objective_changes_with_scale():
    m=NeuroWeaveV82(mobile_v82_config(9)); t=OrganismTrainerV82(m); x,g=batch(3)
    out=m.forward_learning_v82(x,g)
    _,w1=t._balanced_total_v82(out)
    out2=dict(out)
    for k in t.LOSS_KEYS:
        out2[k]=out[k]*(10.0 if k=='predictive_loss' else 1.0)
    _,w2=t._balanced_total_v82(out2)
    assert w2['predictive_loss'] < w1['predictive_loss']


def test_runtime_and_checkpoint():
    m=NeuroWeaveV82(mobile_v82_config(9)); t=OrganismTrainerV82(m); r=OrganismRuntimeV82(m,t)
    for i in range(3):
        o=r.step(torch.randn(9),torch.randn(8))
        assert torch.isfinite(o['action']).all()
        assert o['v82_spine_state'].shape[-1]==64
    p=Path(tempfile.gettempdir())/'nc_v82.pt'
    RuntimeStateStoreV82.save(p,m,t,r)
    m2=NeuroWeaveV82(mobile_v82_config(9)); t2=OrganismTrainerV82(m2); r2=OrganismRuntimeV82(m2,t2)
    rep=RuntimeStateStoreV82.load(p,m2,t2,r2)
    assert rep['version']==82 and rep['optimizer_loaded']
    assert r2.steps==3
    assert torch.isfinite(r2.step(torch.randn(9),torch.randn(8))['action']).all()
    p.unlink(missing_ok=True)


def test_runtime_latency_smoke():
    m=NeuroWeaveV82(mobile_v82_config(9)); r=OrganismRuntimeV82(m,OrganismTrainerV82(m))
    for _ in range(4): r.step(torch.randn(9),torch.randn(8))
    t0=time.perf_counter()
    for _ in range(16): r.step(torch.randn(9),torch.randn(8))
    ms=(time.perf_counter()-t0)/16*1000
    assert ms < 80.0
