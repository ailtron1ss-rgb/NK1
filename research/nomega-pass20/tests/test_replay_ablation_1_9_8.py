from pathlib import Path
from core.nomega.replay_ablation_v1 import ReplayAblationV1


def test_replay_ablation_runs_and_preserves_anchors(tmp_path):
    out=ReplayAblationV1(tmp_path).run(scenarios=4)
    assert out['scenarios']==4
    assert out['all_anchor_preserved']
    assert out['interpretation'].startswith('component-selection')
