import torch
from pathlib import Path
from core.nomega.sparse_moe_v1 import SparseMoE,MoEUsagePenalty
from core.nomega.hybrid_reasoner_v2 import HybridReasonerV2
from core.nomega.uncertainty_suite_v2 import ece,brier,abstention_report
from core.nomega.production_guard_v2 import ProductionGuardV2
from core.nomega.experiment_registry_v2 import ExperimentRegistryV2

def test_sparse_moe_routes_and_is_finite():
    m=SparseMoE(16,24,3); x=torch.randn(8,16); y,r=m(x)
    assert y.shape==x.shape and torch.isfinite(y).all() and torch.isfinite(MoEUsagePenalty.loss(r))

def test_hybrid_reasoner_stable():
    m=HybridReasonerV2(16,24,2); x=torch.randn(4,16); y=m(x,3); rep=m.stability(x)
    assert y.shape==x.shape and rep['finite'] is True

def test_uncertainty_metrics():
    p=[.9,.8,.2,.1]; y=[1,1,0,0]
    assert brier(p,y)<.05 and ece(p,y)<=.15 and abs(abstention_report(p,y,.5)['coverage']-.5)<1e-9

def test_guard_blocks_bad_candidate():
    g=ProductionGuardV2(min_verified=.8); rep=g.evaluate({'verified_rate':.9,'family_acc':.9,'policy_acc':.9,'value_mae':.1},{'verified_rate':.7,'family_acc':.95,'policy_acc':.95,'value_mae':.01})
    assert rep['promote'] is False

def test_experiment_registry_roundtrip(tmp_path):
    r=ExperimentRegistryV2(tmp_path); r.record('x',{'score':1}); assert r.summary()['count']==1
