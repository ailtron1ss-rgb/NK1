import torch
from core.nomega.calibration_v2 import ConfidenceCalibratorV2
from core.nomega.latent_alignment_v2 import LatentAlignmentV2
from core.nomega.research_eval_v2 import ResearchEvaluatorV2
from core.nomega.generalist_core import AdaptiveGeneralist
from pathlib import Path


def test_calibration_metrics_are_bounded():
    c=ConfidenceCalibratorV2(); c.fit([.1,.8,.7,.2],[0,1,1,0]); m=c.metrics([.1,.8,.7,.2],[0,1,1,0])
    assert 0<=m['brier']<=1 and 0<=m['ece']<=1


def test_alignment_retrieval_identity():
    torch.manual_seed(2); a=torch.randn(6,16); b=a.clone(); r=LatentAlignmentV2().retrieval(a,b)
    assert r['top1']==1.0 and r['top3']==1.0


def test_alignment_loss_finite():
    a=torch.randn(4,12); b=torch.randn(4,12); loss=LatentAlignmentV2().loss(a,b)
    assert torch.isfinite(loss)


def test_research_evaluator_runs(tmp_path:Path):
    m=AdaptiveGeneralist(32,40,1024,8)
    rep=ResearchEvaluatorV2(tmp_path,seed=5).run(m,train_steps=2,n=1)
    assert 0<=rep['gain_family']<=1 or -1<=rep['gain_family']<=1
    assert 0<=rep['calibration']['ece']<=1
