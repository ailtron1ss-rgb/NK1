from pathlib import Path
from core.nomega.continual_learning_controller_v1 import ContinualLearningControllerV1

def test_v2_controller_methods_exist_and_persist(tmp_path: Path):
    c=ContinualLearningControllerV1(tmp_path)
    rows=[{'key':'h1','partition':'holdout','family':'sum3','verified':True,'semantic_group':'a','reward':1,'confidence':1}]
    r=c.build_immutable_registry(rows)
    assert r['holdout']['immutable'] is True
    chosen=c.select_replay_v2(rows,current_family='sum3',anchor_keys={'h1'},max_items=1)
    assert chosen[0]['key']=='h1'
    c.record_transaction({'status':'ROLLBACK','id':'t1'})
    assert c.state['transactions'][-1]['id']=='t1'


def test_retention_does_not_fake_restart_equivalence(tmp_path):
    c=ContinualLearningControllerV1(tmp_path)
    r=c.measure_retention({'sum3':1.0},{'sum3':1.0})
    assert r.restart_ok is False
    r2=c.measure_retention({'sum3':1.0},{'sum3':1.0},{'ok':True})
    assert r2.restart_ok is True
