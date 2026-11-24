import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'src')))
import torch
from neurocore.v37 import NeuroWeaveV37, V37Config, OrganismTrainerV37, mobile_v37_config, RuntimeStateStoreV37


def build():
    torch.manual_seed(7)
    return NeuroWeaveV37(mobile_v37_config(raw_observation_dim=9))


def test_v37_forward_and_outputs_are_finite():
    m=build(); x=torch.randn(2,5,9); out=m(x, commit_memory=False, force_planning=False)
    for k in ['task_context_v37','search_candidate_scores_v37','autobiographical_summary_v37','planning_goal_v37','chosen_action_v37']:
        assert k in out and torch.isfinite(out[k]).all()


def test_v37_gradient_paths_are_real():
    m=build(); x=torch.randn(2,4,9); y=torch.randn(2,4,9); r=torch.randn(2,4,1).clamp(-1,1)
    out=m(x,target_sequence=y,reward_sequence=r,commit_memory=False,force_planning=False)
    loss=m.training_loss(out,target_sequence=y,reward_sequence=r)
    loss.backward()
    names=['autobio','transfer_v37','search_v37']
    grads=[]
    for n in names:
        module=getattr(m,n)
        grads.append(any(p.grad is not None and torch.isfinite(p.grad).all() and p.grad.abs().sum()>0 for p in module.parameters()))
    assert all(grads)


def test_v37_persistent_context_changes_next_goal():
    m=build(); st=m.initial_state(1)
    x=torch.randn(1,9); o,st=m.step(x,st,goal=None,commit_memory=True,force_planning=False)
    base_goal=o['planning_goal_v37'].detach().clone()
    st.task_context.fill_(0.9); st.identity_trajectory.fill_(0.7)
    o2,st2=m.step(x,st,goal=None,commit_memory=True,force_planning=False)
    assert (o2['planning_goal_v37']-base_goal).abs().max()>1e-6


def test_v37_real_outcome_updates_transfer_and_autobiography():
    m=build(); st=m.initial_state(1); x=torch.randn(1,9)
    o,st=m.step(x,st,goal=None,commit_memory=True,force_planning=False)
    before=st.task_visits.clone();
    _,st2=m.observe_outcome(st,o,torch.randn(1,9),torch.ones(1,1),torch.zeros(1,1))
    assert st2.task_visits.sum()>before.sum()
    assert torch.isfinite(st2.autobiographical_index).all()


def test_v37_checkpoint_roundtrip(tmp_path):
    m=build(); st=m.initial_state(1); _,st=m.step(torch.randn(1,9),st,commit_memory=True,force_planning=False)
    path=tmp_path/'state.pt'; RuntimeStateStoreV37.save(path,st); loaded=RuntimeStateStoreV37.load(path)
    assert torch.allclose(st.identity_trajectory,loaded.identity_trajectory)
    assert torch.allclose(st.task_visits,loaded.task_visits)


def test_v37_trainer_updates_parameters():
    m=build(); tr=OrganismTrainerV37(m,warmup_steps=99)
    x=torch.randn(2,5,9); y=torch.randn(2,5,9); r=torch.randn(2,5,1).clamp(-1,1)
    before={n:p.detach().clone() for n,p in m.named_parameters() if p.requires_grad}
    loss,out=tr.step(x,target_sequence=y,reward_sequence=r)
    changed=any((before[n]-p.detach()).abs().sum()>0 for n,p in m.named_parameters() if p.requires_grad)
    assert torch.isfinite(loss) and changed
