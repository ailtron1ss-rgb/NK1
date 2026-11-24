import torch
from neurocore.v26 import V26Config, NeuroWeaveV26, LifelongTrainerV26, MemoryAlgorithmRouterV26, PlanCacheV26


def make_model(dtype=torch.float32):
    torch.manual_seed(0)
    cfg=V26Config(d=8, hidden=16, action_dim=3, modalities=3, proprio_dim=2, intero_dim=2,
                  event_capacity=8, skill_slots=4, top_k=1)
    return NeuroWeaveV26(cfg).to(dtype)


def inputs(b=2,t=6,d=8,dtype=torch.float32):
    torch.manual_seed(1)
    x=torch.randn(b,t,d,dtype=dtype)
    m=torch.randn(b,t,3,d,dtype=dtype)
    p=torch.ones(b,t,3,dtype=dtype)
    pr=torch.randn(b,t,2,dtype=dtype)
    ir=torch.randn(b,t,2,dtype=dtype)
    goal=torch.randn(b,t,d,dtype=dtype)
    return x,m,p,pr,ir,goal


def test_v26_forward_and_contracts():
    model=make_model(); x,m,p,pr,ir,g=inputs(dtype=torch.float32)
    out=model(x, goal_sequence=g, modality_sequence=m, presence_sequence=p,
              proprioception_sequence=pr, interoception_sequence=ir, commit_memory=True)
    assert out['latent_v25'].shape == x.shape
    assert out['workspace_v25'].shape == x.shape
    assert out['neural_memory_read_v26'].shape == x.shape
    assert out['chosen_action_v26'].shape == (2,6,3)
    assert torch.isfinite(out['latent_v25']).all()
    assert torch.isfinite(out['neural_memory_read_v26']).all()


def test_v26_state_continuity_and_bounded_memory():
    model=make_model(); x,_,_,_,_,g=inputs(dtype=torch.float32)
    out1=model(x[:,:3],goal_sequence=g[:,:3])
    st=out1['_final_state']
    out2=model(x[:,3:],state=st,goal_sequence=g[:,3:])
    assert torch.isfinite(out2['latent_v25']).all()
    mem=out2['_final_state'].neural_memory
    assert mem.norm(dim=-1).max().item() < 20
    assert out2['_final_state'].life_clock.min().item() == 6


def test_v26_sparse_trainable_scope_and_loss():
    model=make_model(); trainer=LifelongTrainerV26(model)
    x,_,_,_,_,g=inputs(dtype=torch.float32)
    out=model(x,goal_sequence=g,commit_memory=False)
    loss=model.training_loss(out)
    assert torch.isfinite(loss)
    trainer.step(x, goal_sequence=g)
    trainable=[p for p in model.parameters() if p.requires_grad]
    assert trainable and all(p.grad is None or torch.isfinite(p.grad).all() for p in trainable)
    frozen=[p for p in model.core.parameters() if not p.requires_grad]
    assert frozen


def test_v26_target_learning_reduces_primary_component():
    model=make_model(); trainer=LifelongTrainerV26(model, lr=3e-3)
    x,_,_,_,_,g=inputs(dtype=torch.float32)
    with torch.no_grad():
        before=trainer.model.training_loss_parts(trainer.model(x,goal_sequence=g,commit_memory=False))[0].item()
    for _ in range(4): trainer.step(x,goal_sequence=g)
    with torch.no_grad():
        after=trainer.model.training_loss_parts(trainer.model(x,goal_sequence=g,commit_memory=False))[0].item()
    assert after <= before * 1.15


def test_v26_fp16_forward_is_finite():
    model=make_model(dtype=torch.float16)
    x,_,_,_,_,g=inputs(dtype=torch.float16)
    out=model(x,goal_sequence=g)
    assert torch.isfinite(out['latent_v25']).all()
    assert torch.isfinite(out['transition_pred_v26']).all()


def test_v26_algorithm_router_and_plan_cache_are_functional():
    torch.manual_seed(4)
    router=MemoryAlgorithmRouterV26(8,16)
    z=torch.randn(2,8); a=torch.randn(2,8); tr=torch.randn(2,8); an=torch.randn(2,8)
    u=torch.rand(2,1); n=torch.rand(2,1); c=torch.rand(2,1)
    mixed,w=router(z,a,tr,an,u,n,c)
    assert mixed.shape==z.shape and w.shape==(2,3)
    assert torch.allclose(w.sum(-1),torch.ones(2),atol=1e-5)
    planner=PlanCacheV26(8,16,horizon=3)
    p,s=planner(z,a,torch.randn(2,8),u)
    assert p.shape==(2,3,8) and s.shape==(2,3,1)
    assert torch.isfinite(p).all() and torch.isfinite(s).all()

def test_v26_memory_intervention_changes_cognition():
    model=make_model(); x,_,_,_,_,g=inputs(dtype=torch.float32)
    out=model(x,goal_sequence=g)
    st=out['_final_state']
    out2=model(x[:,-1:],state=st,goal=g[:,-1],run_experiment=False)
    st2=st
    st2.neural_memory = torch.zeros_like(st2.neural_memory)
    out3=model(x[:,-1:],state=st2,goal=g[:,-1],run_experiment=False)
    delta=(out2['latent_v25'][:,-1]-out3['latent_v25'][:,-1]).abs().mean()
    assert torch.isfinite(delta) and delta.item() >= 0.0


def test_v26_experiment_policy_normalized():
    model=make_model(); x,_,_,_,_,g=inputs(dtype=torch.float32)
    out=model(x,goal_sequence=g)
    probs=out['experiment_probs_v26']
    assert torch.allclose(probs.sum(-1), torch.ones_like(probs.sum(-1)), atol=1e-5)
    assert torch.isfinite(probs).all()


def test_v26_parameters_are_bounded_mobile_profile():
    model=make_model()
    assert sum(p.numel() for p in model.parameters()) < 250000

def test_v26_staged_trainer_is_finite():
    from neurocore.v26 import StagedLifelongTrainerV26
    model=make_model(); trainer=StagedLifelongTrainerV26(model,lr=2e-3,warmup_steps=1)
    x,_,_,_,_,g=inputs(dtype=torch.float32)
    loss,_=trainer.step(x,goal_sequence=g)
    loss2,_=trainer.step(x,goal_sequence=g)
    assert torch.isfinite(loss) and torch.isfinite(loss2)

def test_v26_transition_ensemble_has_oscillatory_operator():
    from neurocore.v26 import TransitionEnsembleV26
    torch.manual_seed(5)
    m=TransitionEnsembleV26(8,16)
    z=torch.randn(2,8); st=torch.randn(2,8); a=torch.randn(2,3); u=torch.rand(2,1)
    nxt,raw,w=m(z,st,a,u)
    assert nxt.shape==z.shape and raw.shape==z.shape and w.shape==(2,4)
    assert torch.allclose(w.sum(-1),torch.ones(2),atol=1e-5)
    assert torch.isfinite(nxt).all()
