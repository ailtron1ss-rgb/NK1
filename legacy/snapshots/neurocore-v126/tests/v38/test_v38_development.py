import os,sys
sys.path.insert(0,os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','src')))
import torch
from neurocore.v38 import NeuroWeaveV38,mobile_v38_config,OrganismTrainerV38,RuntimeStateStoreV38

def build():
    torch.manual_seed(19); return NeuroWeaveV38(mobile_v38_config(raw_observation_dim=9))

def test_forward_outputs_finite():
    m=build(); x=torch.randn(1,4,9); y=torch.randn(1,4,9); out=m(x,target_sequence=y,commit_memory=False)
    for k in ['development_task_probs_v38','development_goal_v38','development_admission_v38','planning_goal_v37']:
        assert k in out and torch.isfinite(out[k]).all()

def test_development_gradient_paths():
    m=build(); x=torch.randn(2,4,9); y=torch.randn(2,4,9); r=torch.randn(2,4,1).clamp(-1,1)
    out=m(x,target_sequence=y,reward_sequence=r,commit_memory=False)
    loss=m.training_loss(out,target_sequence=y,reward_sequence=r); loss.backward()
    mods=[m.development,m.development_goal_blend]
    assert all(any(p.grad is not None and p.grad.abs().sum()>0 for p in mod.parameters()) for mod in mods)

def test_real_outcome_updates_competence_and_visits():
    m=build(); st=m.initial_state(1); o,st=m.step(torch.randn(1,9),st,commit_memory=True)
    before=st.task_visits.clone(); _,st2=m.observe_outcome(st,o,torch.randn(1,9),torch.ones(1,1),torch.zeros(1,1))
    assert st2.task_visits.sum()>before.sum(); assert torch.isfinite(st2.task_competence).all(); assert torch.isfinite(st2.task_progress).all()

def test_development_changes_goal_after_outcome():
    m=build(); st=m.initial_state(1); x=torch.randn(1,9); o,st=m.step(x,st,commit_memory=True); _,st=m.observe_outcome(st,o,torch.randn(1,9),torch.ones(1,1),torch.zeros(1,1));
    o2,st2=m.step(x,st,commit_memory=True); assert (o2['development_goal_v38']-o['development_goal_v38']).abs().max()>1e-7

def test_trainer_updates_parameters():
    m=build(); tr=OrganismTrainerV38(m,warmup_steps=99); x=torch.randn(1,4,9); y=torch.randn(1,4,9); r=torch.randn(1,4,1).clamp(-1,1)
    before={n:p.detach().clone() for n,p in m.named_parameters() if p.requires_grad}; loss,out=tr.step(x,target_sequence=y,reward_sequence=r)
    changed=any((before[n]-p.detach()).abs().sum()>0 for n,p in m.named_parameters() if p.requires_grad)
    assert torch.isfinite(loss) and changed

def test_checkpoint_roundtrip(tmp_path):
    m=build(); st=m.initial_state(1); _,st=m.step(torch.randn(1,9),st,commit_memory=True); p=tmp_path/'s.pt'; RuntimeStateStoreV38.save(p,st); ld=RuntimeStateStoreV38.load(p); assert torch.allclose(st.task_visits,ld.task_visits)
