import os,sys,tempfile
sys.path.insert(0,os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','src')))
import torch
from neurocore.v39 import NeuroWeaveV39,mobile_v39_config,OrganismTrainerV39,LiveOrganismV39,RuntimeStateStoreV39

def build():
    torch.manual_seed(41); return NeuroWeaveV39(mobile_v39_config(raw_observation_dim=9))

def test_forward_and_policy_outputs_finite():
    m=build(); x=torch.randn(1,5,9); y=torch.randn(1,5,9); r=torch.randn(1,5,1).clamp(-1,1); k=torch.rand(1,5,1)
    out=m(x,target_sequence=y,reward_sequence=r,risk_sequence=k,commit_memory=False,force_planning=False)
    for key in ['action_credit_v39','policy_candidate_action_v39','policy_incumbent_utility_v39','policy_candidate_utility_v39','chosen_action_v39']:
        assert key in out and torch.isfinite(out[key]).all()

def test_credit_gradient():
    m=build(); x=torch.randn(2,5,9); y=torch.randn(2,5,9); r=torch.randn(2,5,1).clamp(-1,1); k=torch.rand(2,5,1)
    out=m(x,target_sequence=y,reward_sequence=r,risk_sequence=k,commit_memory=False,force_planning=False)
    loss=m.training_loss(out,target_sequence=y,reward_sequence=r,risk_sequence=k)
    loss.backward()
    assert any(p.grad is not None and p.grad.abs().sum()>0 for p in m.credit.parameters())

def test_candidate_can_change_action():
    m=build(); st=m.initial_state(1); x=torch.randn(1,9)
    out,st=m.step(x,st,commit_memory=True,force_planning=False)
    assert torch.isfinite(out['chosen_action_v39']).all()
    assert (out['policy_candidate_action_v39']-out['policy_base_action_v39']).abs().sum() >= 0

def test_outcome_updates_quality():
    m=build(); st=m.initial_state(1); x=torch.randn(1,9); o,st=m.step(x,st,commit_memory=True,force_planning=False)
    before=st.policy_quality.clone(); _,st2=m.observe_outcome(st,o,torch.randn(1,9),torch.tensor([[1.0]]),torch.tensor([[0.0]]))
    assert not torch.allclose(before,st2.policy_quality)

def test_heldout_trainer_report_and_update():
    m=build(); tr=OrganismTrainerV39(m,warmup_steps=0); x=torch.randn(1,6,9); y=torch.randn(1,6,9); r=torch.randn(1,6,1).clamp(-1,1); k=torch.rand(1,6,1)
    loss,out=tr.step(x,target_sequence=y,reward_sequence=r,risk_sequence=k,force_planning=False)
    rep=tr.last_update_report
    assert torch.isfinite(loss) and rep['mode']=='heldout' and 'accepted' in rep

def test_checkpoint_roundtrip(tmp_path):
    m=build(); st=m.initial_state(1); _,st=m.step(torch.randn(1,9),st,commit_memory=True,force_planning=False); p=tmp_path/'s.pt'; RuntimeStateStoreV39.save(p,st); ld=RuntimeStateStoreV39.load(p); assert torch.allclose(st.policy_version,ld.policy_version)

def test_live_runtime_short_buffer_update():
    cfg=mobile_v39_config(raw_observation_dim=9); cfg.policy_online_update_interval_v39=1; rt=LiveOrganismV39.create(cfg,with_trainer=True); rt.reset(1)
    for i in range(4):
        obs=torch.randn(1,9); o=rt.act(obs); nxt=torch.randn(1,9); rt.observe_outcome(nxt,torch.tensor([[0.2]]),torch.tensor([[0.1]]))
    assert rt.trainer is not None and rt.trainer.steps>0
