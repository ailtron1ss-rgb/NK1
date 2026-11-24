from pathlib import Path
from core.nomega.verifiable_dense_reward_v1 import VerifiableDenseRewardV1
from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2


def test_dense_reward_prefers_verified_program(tmp_path: Path):
    acq=ProgramAcquisitionCoreV2(tmp_path,seed=3)
    good=acq.templates('sum3')[0]
    bad=[(14,0,0)]
    _,hold,_=acq._examples('sum3',11)
    r=VerifiableDenseRewardV1(tmp_path)
    rg=r.score(good,hold); rb=r.score(bad,hold)
    assert rg.reward > rb.reward
    assert rg.pass_rate == 1.0


def test_difficulty_weights_are_persisted(tmp_path: Path):
    r=VerifiableDenseRewardV1(tmp_path)
    rows=[([1,2,3,0,5,0,0,255],6),([20,30,40,0,5,0,0,255],90)]
    r.update_difficulty(rows,[1.0,0.0])
    r2=VerifiableDenseRewardV1(tmp_path)
    assert len(r2.weights)==2
    assert r2.weights[r2._difficulty_key(*rows[1])] > r2.weights[r2._difficulty_key(*rows[0])]
