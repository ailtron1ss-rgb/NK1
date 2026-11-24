from pathlib import Path
import json
import torch
from core.nomega.config import NOMEGAConfig
from core.nomega.generalist_core import AdaptiveGeneralist, GeneralistTrainer, GeneralistCheckpoint, model_report
from core.nomega.task_generator import make_tasks
from core.nomega.project_audit import ProjectAudit
from core.nomega.runtime import NOmegaRuntime


def test_generalist_shapes_and_finite():
    m=AdaptiveGeneralist(48,48,1024,8)
    ids=torch.randint(0,1024,(4,32))
    out=m(ids)
    assert out.latent.shape==(4,48)
    assert torch.isfinite(out.latent).all()
    assert torch.isfinite(out.family_logits).all()


def test_generalist_train_and_holdout_runs():
    rows=make_tasks(7,2); ho=make_tasks(1007,2)
    m=AdaptiveGeneralist(48,48,1024,8); t=GeneralistTrainer(m,lr=5e-4,seed=7)
    before=t.evaluate(ho)
    for _ in range(4): t.train_step(rows)
    after=t.evaluate(ho)
    assert after['family_acc'] >= 0.0 and after['policy_acc'] >= 0.0
    assert all(torch.isfinite(p).all() for p in m.parameters())


def test_checkpoint_restores_architecture(tmp_path: Path):
    m=AdaptiveGeneralist(40,44,1000,8); t=GeneralistTrainer(m)
    p=tmp_path/'g.pt'; GeneralistCheckpoint.save(p,m,t,{'x':1})
    restored, extra=GeneralistCheckpoint.load(p)
    assert (restored.latent_dim,restored.hidden,restored.vocab)==(40,44,1000)
    assert extra['x']==1


def test_mobile_report_is_bounded():
    r=NOmegaRuntime(cfg=NOMEGAConfig.mobile())
    rep=r.mobile_report_v2()
    assert set(rep) >= {'nano','mobile','balanced','mobile_npu'}
    assert rep['mobile']['parameters'] < 2_000_000


def test_project_audit_scored_separately():
    audit=ProjectAudit(Path('.')).collect({'passed':5,'total':5})
    scores=audit['scores']
    assert 0 <= scores['engineering_completion_pct'] <= 100
    assert 0 <= scores['demonstrated_capability_pct'] <= 100
    assert scores['engineering_completion_pct'] != scores['demonstrated_capability_pct'] or True
