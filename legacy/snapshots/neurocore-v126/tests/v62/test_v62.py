import torch
import torch.nn.functional as F
from neurocore.v62 import V62Config, mobile_v62_config, CanonicalNeuralMemoryOSV62, NeuroWeaveV62, OrganismRuntimeV62, OrganismTrainerV62, RuntimeStateStoreV62

def test_typed_neural_memory_is_trainable():
    torch.manual_seed(17)
    m=CanonicalNeuralMemoryOSV62(12,key_dim=8,value_dim=8,fast_slots=8,semantic_slots=6,hidden=16,types=6,type_dim=5,typed_semantic_slots=4)
    x=torch.randn(5,12); y=torch.randn(5,8); loss=m.memory_loss(x,y)['loss']; loss.backward()
    grads=[p.grad for p in m.parameters() if p.requires_grad]
    assert any(g is not None and torch.isfinite(g).all() and float(g.abs().sum())>0 for g in grads)
    assert m.typed_semantic_key.requires_grad and m.type_router[0].weight.requires_grad

def test_hopfield_retrieval_refines_query():
    torch.manual_seed(23)
    m=CanonicalNeuralMemoryOSV62(10,key_dim=8,value_dim=8,fast_slots=8,semantic_slots=6,hidden=16,hopfield_steps=3)
    base=F.normalize(torch.randn(8),dim=0); target=torch.randn(8)
    m.write(base,target,strength=1.,surprise=1.)
    noisy=F.normalize(base+0.35*torch.randn(8),dim=0)
    refined,e=m._hopfield_refine(noisy.view(1,-1)); stored=m.fast_keys[0].view(1,-1); assert float(torch.cosine_similarity(refined,stored).item())>float(torch.cosine_similarity(noisy.view(1,-1),stored).item())
    assert torch.isfinite(e).all()

def test_typed_writes_have_real_type_parameter_state():
    torch.manual_seed(41)
    m=CanonicalNeuralMemoryOSV62(12,key_dim=8,value_dim=8,fast_slots=8,semantic_slots=6,hidden=16,types=6,typed_semantic_slots=4)
    x=torch.randn(12); y=torch.randn(8); before=m.fast_type_probs.clone(); m.write(x,y,strength=1.,surprise=1.,memory_type=4)
    assert not torch.allclose(before,m.fast_type_probs)
    assert int(m.typed_write_count.sum().item())==1
    assert int(m.fast_type_probs.argmax(dim=1).eq(4).sum().item())>=1

def test_energy_priority_replay_is_bounded():
    torch.manual_seed(59)
    m=CanonicalNeuralMemoryOSV62(12,key_dim=8,value_dim=8,fast_slots=6,semantic_slots=6,hidden=16,replay_size=10)
    for _ in range(12): m.write(torch.randn(12),torch.randn(8),strength=1.,surprise=1.)
    b=m._replay_batch(); assert b is not None and b[0].shape[0]<=8 and torch.isfinite(b[0]).all()

def test_neural_memory_roundtrip():
    torch.manual_seed(71)
    cfg=mobile_v62_config(9); model=NeuroWeaveV62(cfg); trainer=OrganismTrainerV62(model); runtime=OrganismRuntimeV62(model,trainer)
    p=torch.randn(1,9); runtime.step(p); runtime.observe_transition(torch.randn(1,9),actual_reward=.8,actual_risk=.1)
    path='/tmp/v62_state.pt'; RuntimeStateStoreV62.save(path,model,trainer,runtime)
    model2=NeuroWeaveV62(cfg); trainer2=OrganismTrainerV62(model2); runtime2=OrganismRuntimeV62(model2,trainer2); RuntimeStateStoreV62.load(path,model2,trainer2,runtime2)
    assert torch.allclose(model.neural_memory_v61.typed_semantic_key,model2.neural_memory_v61.typed_semantic_key)
    assert torch.allclose(model.neural_memory_v61.replay_energy,model2.neural_memory_v61.replay_energy)

def test_live_runtime_exposes_v62_memory():
    torch.manual_seed(83)
    cfg=mobile_v62_config(9); model=NeuroWeaveV62(cfg); trainer=OrganismTrainerV62(model); runtime=OrganismRuntimeV62(model,trainer); out=runtime.step(torch.randn(1,9))
    assert 'v62_neural_memory_read' in out and 'v62_memory_type_probs' in out

def test_ablation_of_typed_semantic_changes_read():
    torch.manual_seed(97)
    m=CanonicalNeuralMemoryOSV62(12,key_dim=8,value_dim=8,fast_slots=6,semantic_slots=6,hidden=16,types=6,typed_semantic_slots=4)
    for _ in range(6): m.write(torch.randn(12),torch.randn(8),strength=1.,surprise=1.)
    x=torch.randn(3,12)
    full=m(x)['read'].detach()
    saved=m.typed_semantic_value.detach().clone()
    with torch.no_grad():
        m.typed_semantic_value.zero_()
    ab=m(x)['read'].detach()
    with torch.no_grad():
        m.typed_semantic_value.copy_(saved)
    assert not torch.allclose(full,ab)

def test_full_causal_path_changes_after_memory_write():
    torch.manual_seed(101)
    cfg=mobile_v62_config(9); model=NeuroWeaveV62(cfg); trainer=OrganismTrainerV62(model); runtime=OrganismRuntimeV62(model,trainer); obs=torch.randn(1,9)
    before=runtime.step(obs)['v62_neural_memory_read'].detach(); runtime.observe_transition(torch.randn(1,9),actual_reward=1.,actual_risk=0.); after=runtime.step(obs)['v62_neural_memory_read'].detach(); assert not torch.allclose(before,after)
