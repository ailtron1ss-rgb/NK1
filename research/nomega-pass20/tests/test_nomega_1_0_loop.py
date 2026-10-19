from pathlib import Path
import torch
from core.nomega.config import NOMEGAConfig
from core.nomega.runtime import NOmegaRuntime
from core.nomega.universal_learning_loop import UniversalLearningLoop


def test_generalist_zero_influence_keeps_runtime_operational():
    cfg=NOMEGAConfig.mobile(); cfg.generalist_influence=0.0
    r=NOmegaRuntime(Path('.'),cfg)
    out=r.infer('calculate sum of three numbers', {'a':1,'b':2,'c':3,'op':'sum3'})
    assert out.get('verified', False) is True


def test_generalist_positive_influence_is_gated_and_finite():
    cfg=NOMEGAConfig.mobile(); cfg.generalist_influence=0.15
    r=NOmegaRuntime(Path('.'),cfg)
    out=r.infer('calculate sum of three numbers', {'a':1,'b':2,'c':3,'op':'sum3'})
    assert 'route_history' in out
    assert all(torch.isfinite(p).all() for p in r.core.parameters())


def test_universal_learning_loop_runs(tmp_path):
    loop=UniversalLearningLoop(tmp_path,seed=17)
    result=loop.run(steps=3,holdout_per_family=1)
    assert result.after['family_acc'] >= 0.0
    assert 0.0 <= result.audit['scores']['overall_readiness_pct'] <= 100.0
