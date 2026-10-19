import os,sys
sys.path.insert(0,os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','src')))
import torch
from neurocore.v38 import NeuroWeaveV38, mobile_v38_config, LiveOrganismV38

def build():
    torch.manual_seed(23); return NeuroWeaveV38(mobile_v38_config(raw_observation_dim=9))

def obs_for(target, state=None):
    state = torch.zeros(3) if state is None else state
    return torch.cat([state, target, torch.tensor([1.0,0.0,0.0])]).float().unsqueeze(0)

def test_task_prototype_and_difficulty_feed_selection():
    m=build(); st=m.initial_state(1); x=obs_for(torch.tensor([0.4,-0.2,0.1]))
    o,st=m.step(x,st,commit_memory=True)
    before=o['development_task_probs_v38'].clone()
    slot=int(o['development_task_index_v38'].item())
    st.task_prototypes[0,slot].fill_(0.9); st.task_difficulty[0,slot]=0.95; st.task_competence[0,slot]=0.2
    o2,_=m.step(x,st,commit_memory=True)
    assert (o2['development_task_probs_v38']-before).abs().max()>1e-7

def test_failure_updates_recovery_and_difficulty():
    m=build(); st=m.initial_state(1); x=obs_for(torch.tensor([0.4,-0.2,0.1])); o,st=m.step(x,st,commit_memory=True)
    idx=o['development_task_index_v38']; before=st.task_difficulty.clone();
    _,st2=m.observe_outcome(st,o,x,torch.tensor([[-1.0]]),torch.zeros(1,1))
    j=int(idx.item())
    assert torch.isfinite(st2.recovery_bias).all(); assert st2.task_difficulty[0,j] <= before[0,j] + 1e-6

def test_online_runtime_update_changes_weights():
    cfg=mobile_v38_config(raw_observation_dim=9); cfg.development_online_update_interval_v38=1; cfg.development_admission_threshold_v38=0.0; rt=LiveOrganismV38.create(cfg,with_trainer=True)
    rt.reset(1); before={n:p.detach().clone() for n,p in rt.model.named_parameters() if p.requires_grad}
    target=torch.tensor([0.4,-0.2,0.1]); state=torch.zeros(3)
    for _ in range(2):
        obs=obs_for(target,state); out=rt.act(obs); act=out['chosen_action_v37'].detach().squeeze(0)
        state=(state+0.1*act).clamp(-1,1)
        next_obs=obs_for(target,state)
        reward=-((state-target)**2).mean().view(1,1)
        rt.observe_outcome(next_obs,reward,torch.zeros(1,1))
    changed=any((before[n]-p.detach()).abs().sum()>0 for n,p in rt.model.named_parameters() if p.requires_grad)
    assert rt.trainer.steps > 0 and changed
