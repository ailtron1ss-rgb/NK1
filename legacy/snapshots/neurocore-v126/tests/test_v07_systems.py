import tempfile
from pathlib import Path
import torch
from neurocore import NeuroWeaveCore
from neurocore.runtime_learning import process_event
from neurocore.training_v07 import train_step
from neurocore.checkpoint_v07 import save_checkpoint, load_checkpoint
from neurocore.tasks_v07 import delayed_recall, temporal_rule
from neurocore.integrity_v07 import tree_sha256

def make():
    return NeuroWeaveCore(d_model=24,fast_state=32,slow_state=32,memory_capacity=12,n_experts=3,top_k=1,attention_heads=3)

def test_runtime_process_writes_bounded_memory():
    torch.manual_seed(10); m=make(); state=None
    for _ in range(20):
        r,state=process_event(m,torch.randn(1,1,24),state=state)
    assert int(m.memory.valid.sum())<=12
    assert 0<=r.consolidation<=1

def test_training_step_updates_parameters():
    torch.manual_seed(11); m=make(); opt=torch.optim.AdamW(m.parameters(),lr=1e-3); x,y=temporal_rule(batch=4,seq=8,dim=24,seed=11); before=[p.detach().clone() for p in m.parameters() if p.requires_grad]; metrics=train_step(m,opt,x,y); after=[p.detach() for p in m.parameters() if p.requires_grad]
    assert metrics.loss>=0 and any(not torch.allclose(a,b) for a,b in zip(before,after))

def test_checkpoint_roundtrip():
    torch.manual_seed(12); m=make();
    with tempfile.TemporaryDirectory() as d:
        p=Path(d)/'m.pt'; info=save_checkpoint(m,p,{'test':True}); n=make(); meta=load_checkpoint(n,p)
        assert info['sha256'] and meta['test'] is True
        for a,b in zip(m.parameters(),n.parameters()): assert torch.allclose(a,b)

def test_delay_task_contract():
    x,y=delayed_recall(batch=3,seq=10,dim=24,distractors=4,seed=2)
    assert x.shape==(3,10,24) and y.shape==(3,1,24)

def test_integrity_is_deterministic():
    rows1=tree_sha256('/tmp'); rows2=tree_sha256('/tmp'); assert len(rows1)==len(rows2)

def test_pure_training_forward_does_not_mutate_memory():
    torch.manual_seed(13); m=make().train(); x=torch.randn(1,6,24); assert int(m.memory.valid.sum())==0; _=m(x); assert int(m.memory.valid.sum())==0
