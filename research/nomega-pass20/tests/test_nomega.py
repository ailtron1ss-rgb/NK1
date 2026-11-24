import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.nomega import NOMEGAConfig, NOmegaCore, NOmegaRuntime

def test_core_shapes_and_route():
    c = NOmegaCore(NOMEGAConfig(latent_dim=32, router_hidden=24, memory_dim=32, max_reason_steps=3))
    s = c.encode("calculate xor")
    d = c.router.decide(s)
    assert len(d.expert_ids) >= 1
    assert d.reason_steps >= 1

def test_symbolic_verified_path():
    c = NOmegaCore(NOMEGAConfig(latent_dim=32, router_hidden=24, memory_dim=32, max_reason_steps=3))
    out = c.run("calculate", {"a": 5, "b": 7, "op": "sum", "expected": 12})
    assert out["answer"] == 12
    assert out["verified"] is True

def test_runtime_persistence(tmp_path):
    r = NOmegaRuntime(root=tmp_path, cfg=NOMEGAConfig(latent_dim=32, router_hidden=24, memory_dim=32))
    r.infer("hello")
    r.save()
    r2 = NOmegaRuntime(root=tmp_path, cfg=r.cfg)
    assert len(r2.core.memory.items) >= 1

def test_profile_positive():
    c = NOMEGA_RUNTIME = NOmegaRuntime(cfg=NOMEGAConfig(latent_dim=32, router_hidden=24, memory_dim=32))
    p = c.profile()
    assert p["parameters"] > 0

def test_memory_never_becomes_unverified_answer():
    c = NOmegaCore(NOMEGAConfig(latent_dim=32, router_hidden=24, memory_dim=32, max_reason_steps=2))
    c.run("calculate", {"a": 7, "b": 9, "op": "sum", "expected": 16})
    out = c.run("an unrelated task")
    assert out["verified"] is False
    assert out["answer"].startswith("No verified candidate")

def test_modal_adapters_contract():
    import torch
    c = NOmegaCore(NOMEGAConfig(latent_dim=32, router_hidden=24, memory_dim=32, max_reason_steps=1))
    image = torch.randn(1, 3, 32, 32)
    audio = torch.randn(1, 1024)
    s = c.encode("inspect", image=image, audio=audio)
    assert tuple(s.vector.shape) == (32,)
