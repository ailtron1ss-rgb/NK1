from pathlib import Path
import torch
from core.nomega.online_adaptation_transaction_v1 import OnlineAdaptationTransactionV1

def make_model():
    return torch.nn.Linear(2,1)

def test_transaction_rolls_back_model_and_optimizer(tmp_path: Path):
    model=make_model(); opt=torch.optim.SGD(model.parameters(),lr=0.1)
    tx=OnlineAdaptationTransactionV1(tmp_path, model, opt, budget=10)
    before={k:v.detach().clone() for k,v in model.state_dict().items()}
    tx.begin({'holdout':0.9})
    (model(torch.ones(1,2)).sum()).backward(); opt.step()
    result=tx.evaluate({'new_gain':0.05,'retention_drop':0.2,'ood_drop':0.0,'interference_veto':False,'restart_ok':True,'steps':2}, thresholds={'min_new_gain':0.01,'max_retention_drop':0.05,'max_ood_drop':0.05})
    assert result == 'rollback'
    assert all(torch.equal(model.state_dict()[k], v) for k,v in before.items())
    assert opt.state == {}

def test_anchor_loss_is_zero_when_equal():
    cur=torch.tensor([[1.0,0.0]])
    frozen=torch.tensor([[1.0,0.0]])
    mask=torch.tensor([True])
    loss=OnlineAdaptationTransactionV1.behavior_anchor_loss(cur,frozen,mask,1.0)
    assert float(loss) == 0.0
