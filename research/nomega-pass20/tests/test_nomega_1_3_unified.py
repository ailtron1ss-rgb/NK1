from pathlib import Path
import torch
from core.nomega.world_model_v3 import WorldModelV3, WorldModelTrainerV3
from core.nomega.skill_transfer_v3 import SkillTransferV3
from core.nomega.multimodal_v3 import MultimodalGroundingV3
from core.nomega.mobile_optimizer_v5 import MobileOptimizerV5
from core.nomega.mobile_benchmark_v3 import MobileBenchmarkV3
from core.nomega.unified_learning_v3 import UnifiedLearningCycleV3
from core.nomega.runtime import NOmegaRuntime
from core.nomega.config import NOMEGAConfig


def test_world_model_v3_rank_and_train():
    m=WorldModelV3(16,4,24,3); z=torch.randn(2,16); ns=z+.02*torch.randn_like(z); tr=WorldModelTrainerV3(m)
    rep=tr.train_transition(z,ns,torch.tensor([0,1]),.4); r=m.rollout(z,[0,1,2]); ranked=m.rank_actions(z[:1],[0,1,2])
    assert rep['loss']>=0 and len(r.states)==4 and len(ranked)==3 and all(torch.isfinite(s).all() for s in r.states)


def test_skill_transfer_v3_composes_verified_atoms():
    s=SkillTransferV3(); assert s.register('a','sum',{'op':'sum'},.95,True,['a'])
    assert s.register('b','xor',{'op':'xor'},.93,True,['b'])
    c=s.compose(['a','b'],'sequential'); assert c and c.verified and c.quality<.95
    assert s.transfer('compose',.9)


def test_multimodal_v3_loss_finite():
    m=MultimodalGroundingV3(16,24); x=torch.randn(4,16); t,i,a=m(x,x,x); loss=m.loss(t,i,a)
    assert torch.isfinite(loss) and float(loss)>=0


def test_mobile_optimizer_v5_balances_constraints():
    r=MobileOptimizerV5().choose(4.0,False,900,600000,uncertainty=.7)
    assert r['needs_pruning'] and r['uncertainty_policy']=='abstain_or_verify' and r['recommended_precision']=='int8'


def test_unified_cycle_builds_candidate(tmp_path):
    rep=UnifiedLearningCycleV3(tmp_path,seed=7).run(train_per=1,holdout_per=1,adv_per=1,steps=1)
    assert Path(rep['checkpoint']).exists() and 'promotion' in rep and 'world_model' in rep


def test_runtime_omega13_helpers(tmp_path):
    r=NOmegaRuntime(tmp_path,NOMEGAConfig.mobile())
    mobile=r.omega13_mobile_optimize(900); audit=r.omega13_audit(1,1)
    assert mobile['target']['name'] in {'mid','ultra_low'} and audit['testing_pct']==100.0


def test_mobile_benchmark_restores_runtime_state(tmp_path):
    r=NOmegaRuntime(tmp_path,NOMEGAConfig.mobile())
    before=(r.cfg.ram_gb,r.cfg.has_npu); rep=MobileBenchmarkV3().run(r); after=(r.cfg.ram_gb,r.cfg.has_npu)
    assert len(rep['profiles'])==4 and before==after
