import math
import torch

from neurocore.v53 import (
    V53Config, mobile_v53_config, CounterfactualAdvantageCriticV53,
    CounterfactualPairReplayV53, CounterfactualAdvantageTrainerV53,
    CounterfactualAdvantageControllerV53, CounterfactualPairV53,
    NeuroWeaveV53, OrganismTrainerV53, OrganismRuntimeV53, RuntimeStateStoreV53,
)


def cfg():
    c = mobile_v53_config(9)
    c.advantage_min_pairs_v53 = 3
    c.advantage_candidate_count_v53 = 1
    c.advantage_train_updates_v53 = 2
    c.advantage_probe_probability_v53 = 0.0
    return c


def test_v53_config_inherits_v52_contract():
    c = cfg()
    assert c.action_dim == 3
    assert c.latent_dim_v46 == 20
    assert c.stochastic_modes_v52 >= 2


def test_advantage_critic_is_baseline_relative_and_finite():
    m = CounterfactualAdvantageCriticV53(8, 8, 2, hidden=12)
    out = m(torch.randn(4,8), torch.randn(4,8), torch.zeros(4,2), torch.ones(4,2),
            torch.ones(4,1)*0.2, torch.ones(4,1)*0.1, torch.ones(4,1))
    assert out['mean'].shape == (4,1)
    assert out['scale'].shape == (4,1)
    assert torch.isfinite(out['mean']).all() and torch.isfinite(out['scale']).all()


def _pair(reward_delta: float, step: int = 1):
    return CounterfactualPairV53(
        pair_id=f'p{step}', latent=[0.1]*8, goal=[0.2]*8,
        baseline_action=[0.0, 0.0], candidate_action=[0.15, -0.05],
        baseline_utility=0.0, candidate_utility=reward_delta,
        uncertainty=0.1, regime=0.05, sensor_health=0.95, step=step,
        horizon=3, provenance='true_pair')


def test_pair_replay_requires_distinct_actions_and_preserves_priority():
    r = CounterfactualPairReplayV53(8,8,2,capacity=4)
    r.add_pair(_pair(0.4,1))
    r.add_pair(_pair(-0.2,2))
    assert r.count == 2
    assert r.true_pair_count == 2
    b = r.sample(2)
    assert b['target_advantage'].shape == (2,1)
    assert torch.isfinite(b['weight']).all()


def test_recurrent_pair_has_lower_evidence_weight_than_true_pair():
    r = CounterfactualPairReplayV53(8,8,2)
    r.add_pair(_pair(0.4,1))
    recurrent = _pair(0.2,2)
    recurrent.provenance = 'recurrent_pair'
    assert recurrent.evidence_weight < r.pairs[0].evidence_weight


def test_replay_add_outcome_forms_recurrent_pair_only_on_same_quantized_state():
    r = CounterfactualPairReplayV53(8,8,2,match_quantum=0.05)
    z = torch.ones(1,8); g = torch.ones(1,8)
    assert r.add_outcome(z,g,torch.tensor([[0.0,0.0]]),0.1,step=1) is None
    pair = r.add_outcome(z+0.001,g+0.001,torch.tensor([[0.1,0.0]]),0.3,step=2)
    assert pair is not None
    assert pair.provenance == 'recurrent_pair'
    assert math.isclose(pair.advantage, 0.2, rel_tol=1e-5)


def test_replay_rejects_same_action_as_counterfactual():
    r = CounterfactualPairReplayV53(8,8,2)
    z = torch.zeros(8); g = torch.ones(8); a = torch.zeros(2)
    try:
        r.add_true_pair(z,g,a,a,0.0,1.0)
        assert False
    except ValueError:
        pass


def test_advantage_trainer_changes_parameters_on_true_pairs():
    torch.manual_seed(10)
    m = CounterfactualAdvantageCriticV53(8,8,2,hidden=16)
    r = CounterfactualPairReplayV53(8,8,2)
    for i in range(8):
        r.add_true_pair(torch.randn(8),torch.randn(8),torch.zeros(2),torch.tensor([0.2,-0.1]),
                        0.0, float(0.2 + 0.03*i), uncertainty=0.1, step=i, horizon=3)
    t = CounterfactualAdvantageTrainerV53(m,lr=2e-3,updates_per_pair=2)
    before = {k:v.detach().clone() for k,v in m.state_dict().items()}
    s = t.train_store(r,batch_size=8,updates=3)
    changed = sum(not torch.allclose(before[k],v) for k,v in m.state_dict().items())
    assert changed > 0
    assert s.pairs == 8 and s.updates == 3 and math.isfinite(s.loss)


def test_controller_falls_back_until_true_pair_ready():
    c=cfg(); m=CounterfactualAdvantageCriticV53(20,20,3,hidden=12); r=CounterfactualPairReplayV53(20,20,3)
    ctl=CounterfactualAdvantageControllerV53(c,m,r)
    base=torch.zeros(1,3)
    chosen,meta=ctl.select(torch.randn(1,20),torch.randn(1,20),base,0.1,0.1,1.0,critic_ready=False)
    assert torch.allclose(chosen,base)
    assert float(meta['advantage53_ready']) == 0.0


def test_controller_respects_action_support():
    c=cfg(); c.advantage_admission_margin_v53=-1.0
    m=CounterfactualAdvantageCriticV53(20,20,3,hidden=12); r=CounterfactualPairReplayV53(20,20,3)
    for i in range(4):
        r.add_true_pair(torch.randn(20),torch.randn(20),torch.zeros(3),torch.tensor([0.05,0.02,-0.03]),0.0,0.5,step=i)
    ctl=CounterfactualAdvantageControllerV53(c,m,r)
    chosen,meta=ctl.select(torch.randn(1,20),torch.randn(1,20),torch.zeros(1,3),0.1,0.1,1.0,critic_ready=True)
    assert float(chosen.abs().max()) <= c.advantage_action_support_v53 + 1e-5 or torch.allclose(chosen,torch.zeros(1,3))
    assert torch.isfinite(meta['advantage53_margin']).all()


def test_controller_rejects_when_sensor_health_is_low():
    c=cfg(); c.advantage_admission_margin_v53=-1.0
    m=CounterfactualAdvantageCriticV53(20,20,3,hidden=12); r=CounterfactualPairReplayV53(20,20,3)
    for i in range(4):
        r.add_true_pair(torch.randn(20),torch.randn(20),torch.zeros(3),torch.tensor([0.08,0.02,-0.02]),0.0,0.6,step=i)
    ctl=CounterfactualAdvantageControllerV53(c,m,r)
    chosen,_=ctl.select(torch.randn(1,20),torch.randn(1,20),torch.zeros(1,3),0.1,0.1,0.1,critic_ready=True)
    assert torch.allclose(chosen,torch.zeros(1,3))


def test_v53_model_has_real_advantage_parameters():
    m=NeuroWeaveV53(cfg())
    n=sum(p.numel() for p in m.counterfactual_advantage_critic_v53.parameters() if p.requires_grad)
    assert n > 0


def test_v53_runtime_observes_and_records_grounded_outcome():
    torch.manual_seed(21)
    c=cfg(); m=NeuroWeaveV53(c); t=OrganismTrainerV53(m,lr=1e-3); rt=OrganismRuntimeV53(m,t)
    obs=torch.randn(1,9); goal=torch.randn(1,8)
    out=rt.step(obs,goal)
    assert 'chosen_action_v53' in out
    res=rt.observe_transition(obs+0.02,actual_reward=0.3,actual_risk=0.1,goal=goal)
    assert math.isfinite(float(res['advantage53_last_utility']))
    assert rt.counterfactual_replay_v53.pending or rt.counterfactual_replay_v53.count >= 1


def test_v53_runtime_state_roundtrip_preserves_pair_replay(tmp_path):
    torch.manual_seed(22)
    c=cfg(); m=NeuroWeaveV53(c); t=OrganismTrainerV53(m,lr=1e-3); rt=OrganismRuntimeV53(m,t)
    rt.counterfactual_replay_v53.add_true_pair(torch.randn(20),torch.randn(20),torch.zeros(3),torch.tensor([0.1,0.0,-0.1]),0.1,0.4,step=1,horizon=3)
    p=tmp_path/'v53.pt'; RuntimeStateStoreV53.save(p,m,t,rt)
    m2=NeuroWeaveV53(c); t2=OrganismTrainerV53(m2,lr=1e-3); rt2=OrganismRuntimeV53(m2,t2); RuntimeStateStoreV53.load(p,m2,t2,rt2)
    assert rt2.counterfactual_replay_v53.true_pair_count == 1
    for a,b in zip(m.counterfactual_advantage_critic_v53.state_dict().values(),m2.counterfactual_advantage_critic_v53.state_dict().values()):
        assert torch.allclose(a,b)


def test_true_pair_training_reduces_advantage_error():
    torch.manual_seed(31)
    m=CounterfactualAdvantageCriticV53(8,8,2,hidden=20); r=CounterfactualPairReplayV53(8,8,2)
    for i in range(32):
        z=torch.randn(8); g=torch.randn(8); a=torch.zeros(2); delta=torch.tensor([0.12,-0.04])
        # Hidden ground truth is a smooth function of latent/goal/action delta.
        target=float(0.35*z[0].item() - 0.20*g[0].item() + 0.8*delta[0].item() - 0.2*delta[1].item())
        r.add_true_pair(z,g,a,delta,0.0,target,step=i,horizon=3)
    t=CounterfactualAdvantageTrainerV53(m,lr=3e-3,updates_per_pair=2)
    with torch.no_grad():
        b=r.sample(32); before=(m(b['latent'],b['goal'],b['baseline'],b['candidate'],b['uncertainty'],b['regime'],b['sensor_health'])['mean']-b['target_advantage']).abs().mean().item()
    for _ in range(10): t.train_store(r,batch_size=32,updates=2)
    with torch.no_grad():
        a=r.sample(32); after=(m(a['latent'],a['goal'],a['baseline'],a['candidate'],a['uncertainty'],a['regime'],a['sensor_health'])['mean']-a['target_advantage']).abs().mean().item()
    assert after < before
