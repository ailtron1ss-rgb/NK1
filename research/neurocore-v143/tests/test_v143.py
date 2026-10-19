import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1] / 'src'))

import torch
import torch.nn.functional as F

from neurocore.version import PACKAGE_VERSION, CURRENT_FRONTIER
from neurocore.current.text_interface import build_byte_language_model, UTF8ByteCodec
from neurocore.research.fwpkm_candidate import FastWeightProductKeyMemoryCandidate, FwPKMConfig
from neurocore.research.fwpkm_language_bridge import FwPKMLanguageBridge


def test_version():
    assert PACKAGE_VERSION == '1.43.0'
    assert CURRENT_FRONTIER == 143


def test_idw_route_matches_cosine_variant_reasonably():
    torch.manual_seed(1)
    a=FastWeightProductKeyMemoryCandidate(FwPKMConfig(use_idw_addressing=True,slots_per_subkey=32,topk_per_subkey=2,value_dim=20))
    q=torch.randn(4,16)
    slots, weights=a._route(q)
    assert slots.shape == (4,4)
    assert torch.isfinite(weights).all()
    assert torch.allclose(weights.sum(-1), torch.ones(4), atol=1e-6)


def test_single_item_recall_is_real():
    torch.manual_seed(2)
    m=FastWeightProductKeyMemoryCandidate(FwPKMConfig(slots_per_subkey=32,topk_per_subkey=2,value_dim=20,local_lr=0.5,use_lookahead_target=False))
    st=m.initial_state(1,torch.device('cpu'),torch.float32)
    q=torch.randn(1,1,16); v=F.normalize(torch.randn(1,1,20),dim=-1)
    st,_=m.rewrite_chunk(q,v,st)
    r,_,_=m.read(q[:,0],st)
    assert float(F.cosine_similarity(r,v[:,0],dim=-1).detach()) > 0.99


def test_shared_state_revision_prefers_new_value():
    torch.manual_seed(3)
    m=FastWeightProductKeyMemoryCandidate(FwPKMConfig(slots_per_subkey=64,topk_per_subkey=2,value_dim=20,local_lr=0.75,use_lookahead_target=False))
    st=m.initial_state(1,torch.device('cpu'),torch.float32)
    q=torch.randn(1,1,16); a=F.normalize(torch.randn(1,1,20),dim=-1); b=F.normalize(torch.randn(1,1,20),dim=-1)
    st,_=m.rewrite_chunk(q,a,st)
    st,_=m.rewrite_chunk(q,b,st)
    r,_,_=m.read(q[:,0],st)
    assert float(F.cosine_similarity(r,b[:,0],dim=-1).detach()) > float(F.cosine_similarity(r,a[:,0],dim=-1).detach())


def test_slow_codebooks_get_real_gradient_after_memory_exists():
    torch.manual_seed(4)
    m=FastWeightProductKeyMemoryCandidate(FwPKMConfig(slots_per_subkey=32,topk_per_subkey=2,value_dim=20,local_lr=0.5,use_lookahead_target=False,chunk_size=2))
    st=m.initial_state(1,torch.device('cpu'),torch.float32)
    q=torch.randn(1,4,16); v=F.normalize(torch.randn(1,4,20),dim=-1)
    _,st,_,_=m.sequence_trainable(q[:,:2],v[:,:2],st)
    _,_,loss,_=m.sequence_trainable(q[:,2:],v[:,2:],st)
    loss.backward()
    assert m.subkeys_a.grad is not None and float(m.subkeys_a.grad.detach().abs().sum()) > 0.0
    assert m.subkeys_b.grad is not None and float(m.subkeys_b.grad.detach().abs().sum()) > 0.0


def test_bridge_is_neutral_at_initialization():
    torch.manual_seed(5)
    m=FwPKMLanguageBridge()
    assert float(m.value_to_logits.weight.detach().abs().sum()) == 0.0
    base=torch.randn(1,3,256); read=torch.randn(1,3,20)
    out=m.logits_with_memory(base,read)
    assert torch.allclose(out,base)


def test_bridge_stream_shape_and_state():
    model=build_byte_language_model(seed=6)
    bridge=FwPKMLanguageBridge(latent_dim=model.core.cfg.trunk.latent_dim)
    ids=model.encode_text('Memory revision: A -> B')
    obs,goals=model.encoder(ids)
    out=model.core(obs,goals)
    st=bridge.initial_state(1,obs.device,obs.dtype)
    read,st2,info=bridge.sequence(out['predictive'],st,write_targets=out['predictive'])
    assert read.shape == out['predictive'].shape
    assert st2.shape == st.shape
    assert info['write'] == 1.0


def test_utf8_roundtrip():
    s='NeuroCore: память → revision ✓'
    assert UTF8ByteCodec.validate_roundtrip(s)


if __name__ == '__main__':
    for name,obj in list(globals().items()):
        if name.startswith('test_'):
            obj()
    print('V143 tests: PASS')
