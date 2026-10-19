from core.nomega.continual_learning_controller_v1 import ContinualLearningControllerV1

def test_continual_controller_preserves_anchors(tmp_path):
    c = ContinualLearningControllerV1(tmp_path, seed=41)
    records = [
        {'key':'anchor','family':'sum3','verified':True,'status':'validated','reward':.8,'confidence':.9},
        {'key':'harmful','family':'hard','verified':True,'status':'validated','reward':.99,'confidence':.99,'transfer_to_current':-0.9},
    ]
    chosen = c.select_replay(records, current_family='hard', anchor_keys={'anchor'}, max_items=1)
    assert chosen[0]['key'] == 'anchor'
