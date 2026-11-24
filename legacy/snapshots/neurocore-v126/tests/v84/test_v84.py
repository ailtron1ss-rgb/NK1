from pathlib import Path
import tempfile, torch
from neurocore.v82 import NeuroWeaveV82
from neurocore.v84 import NeuroWeaveV84, OrganismTrainerV84, OrganismRuntimeV84, RuntimeStateStoreV84, mobile_v84_config

def batch(seed=0,batch_size=2,steps=4):
 g=torch.Generator().manual_seed(seed); return torch.randn(batch_size,steps,9,generator=g),torch.randn(batch_size,steps,8,generator=g)

def test_frontier_and_zero_model_parameter_delta():
 m82=NeuroWeaveV82(); m84=NeuroWeaveV84(); assert sum(p.numel() for p in m82.parameters())==sum(p.numel() for p in m84.parameters()); assert m84.learning_parameter_report_v84()['replay_controller_parameter_delta']==0

def test_controller_has_fast_and_diagnostic_modes():
 c=mobile_v84_config(9); c.replay_interval_init_v84=1; c.replay_interval_min_v84=1; c.replay_interval_max_v84=1
 m=NeuroWeaveV84(c); t=OrganismTrainerV84(m); x,g=batch(1); modes=[]
 for i in range(7): modes.append(t.learning_step_v84(x*(1+0.02*i),g)['replay_mode_v84'])
 assert 'fast_combined' in modes and 'diagnostic_surgery' in modes

def test_interval_bounded():
 c=mobile_v84_config(9); c.replay_interval_max_v84=4; m=NeuroWeaveV84(c); t=OrganismTrainerV84(m); x,g=batch(2)
 for _ in range(8): assert 1<=t.learning_step_v84(x,g)['replay_interval_v84']<=4

def test_diagnostic_replay_still_has_full_trunk_gradient_coverage():
 c=mobile_v84_config(9); c.replay_interval_init_v84=1; c.replay_interval_min_v84=1; c.replay_interval_max_v84=1
 m=NeuroWeaveV84(c); t=OrganismTrainerV84(m); x,g=batch(3); last=None
 for _ in range(6): last=t.learning_step_v84(x,g)
 assert last['replay_diagnostic_events_v84']>=1 and last['replay_gradient_coverage']>0.50 and last['replay_cosine_exact_v84']==1.0

def test_checkpoint_controller():
 m=NeuroWeaveV84(); t=OrganismTrainerV84(m); r=OrganismRuntimeV84(m,t); x,g=batch(4)
 for _ in range(3): t.learning_step_v84(x,g)
 p=Path(tempfile.gettempdir())/'nc_v84.pt'; RuntimeStateStoreV84.save(p,m,t,r); m2=NeuroWeaveV84(); t2=OrganismTrainerV84(m2); r2=OrganismRuntimeV84(m2,t2); rep=RuntimeStateStoreV84.load(p,m2,t2,r2); assert rep['version']==84 and rep['optimizer_loaded']; assert t2.replay_events_v84==t.replay_events_v84; p.unlink(missing_ok=True)

def test_runtime_finite():
 m=NeuroWeaveV84(); t=OrganismTrainerV84(m); r=OrganismRuntimeV84(m,t); out=r.step(torch.randn(9),torch.randn(8)); assert torch.isfinite(out['action']).all()

def test_adaptive_scheduler_reduces_replay_when_pressure_is_stable():
 c=mobile_v84_config(9); c.replay_interval_init_v84=2; c.replay_interval_max_v84=6
 m=NeuroWeaveV84(c); t=OrganismTrainerV84(m); x,g=batch(7); logs=[t.learning_step_v84(x*(1+0.03*i),g) for i in range(10)]
 assert sum(r['replay_executed'] for r in logs) <= 5
 assert logs[-1]['replay_interval_v84'] >= 3

def test_external_supervised_target_is_preserved_in_replay():
    c=mobile_v84_config(9); c.replay_policy_v84='current_only'
    m=NeuroWeaveV84(c); t=OrganismTrainerV84(m)
    x=torch.randn(2,2,9); g=torch.zeros(2,2,8)
    target=torch.randn(2,1,20); target=torch.nn.functional.normalize(target,dim=-1)
    t.learning_step_v84(x,g,target_latent_sequence=target)
    mem=m.neural_memory_v61
    assert int(mem.learning_replay_valid_v83.sum().item())==2
    stored=mem.learning_replay_targets_v83[:2]
    assert torch.allclose(stored,target[:,0],atol=1e-6)
