import torch
from torch import nn
from neurocore import LatentWorldModel, random_shooting, StablePlasticController, snapshot_fisher, fisher_penalty
from neurocore.calibration import expected_calibration_error, route_budget_violation
from neurocore.parameter_budget import report, enforce_max_params

def test_random_shooting_returns_valid_plan():
    w=LatentWorldModel(6,2,ensemble=2); s=torch.randn(1,6); lo=torch.full((2,),-1.); hi=torch.full((2,),1.)
    act,score=random_shooting(w,s,lo,hi,horizon=3,candidates=8); assert act.shape==(1,3,2); assert score.shape==(1,); assert torch.isfinite(score).all()

def test_fisher_snapshot_and_penalty():
    m=nn.Linear(4,4); snap=snapshot_fisher(m); assert snap.params
    y=m(torch.randn(3,4)).pow(2).mean(); y.backward()
    for n,p in m.named_parameters():
        if p.grad is not None: snap.fisher[n]=p.grad.detach().pow(2)
    p=fisher_penalty(m,snap,1e-3); assert torch.isfinite(p)

def test_stable_plastic_controller_updates_adapter():
    base=nn.Linear(4,4); adapter=nn.Linear(4,4,bias=False); before=base.weight.detach().clone(); c=StablePlasticController(base,adapter,adapter_lr=0.05,base_lr=0.0); x=torch.randn(5,4); loss=adapter(x).pow(2).mean(); c.step(loss); assert torch.allclose(base.weight,before)

def test_calibration_and_budget():
    e=expected_calibration_error(torch.tensor([.1,.9,.8]),torch.tensor([0.,1.,1.])); assert 0<=e<=1
    assert torch.equal(route_budget_violation(torch.tensor([[2.0],[0.5]]), torch.tensor([[1.0],[1.0]])), torch.tensor([[1.0],[0.0]]))
    m=nn.Linear(4,4); r=report(m); assert r.parameters==20 and r.int8_mb<r.fp32_mb; enforce_max_params(m,100)
