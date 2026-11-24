from pathlib import Path

from core.nomega.verified_neural_substrate_bridge_v1 import VerifiedNeuralSubstrateBridgeV1


def _rows():
    return [
        {"code": [(1, 0, 0), (3, 0, 1), (15, 0, 0)], "train_score": 1.0, "family_id": 0},
        {"code": [(1, 0, 0), (5, 0, 1), (15, 0, 0)], "train_score": 0.25, "family_id": 0},
        {"code": [(1, 0, 0), (3, 1, 0), (15, 0, 0)], "train_score": 0.75, "family_id": 0},
        {"code": [(1, 0, 0), (18, 0, 1), (15, 0, 0)], "train_score": 0.0, "family_id": 0},
    ]


def test_bridge_requires_verified_fit_and_ranks_after_fit(tmp_path: Path):
    bridge = VerifiedNeuralSubstrateBridgeV1(seed=17, neurons=12, inh_neurons=4, max_len=8, hidden=12)
    try:
        bridge.predict(_rows()[0]["code"])
    except RuntimeError:
        pass
    else:
        raise AssertionError("prediction before fit must be rejected")
    report = bridge.fit_verified(_rows(), epochs=3, local_plasticity=True)
    assert report.examples == 4
    assert report.local_plasticity is True
    ranked = bridge.rank([r["code"] for r in _rows()], top_k=4)
    assert len(ranked) == 4
    assert all(0.0 <= score <= 1.0 for score, _ in ranked)
    assert report.substrate_signature_before != "" and report.substrate_signature_after != ""


def test_bridge_is_deterministic_for_fixed_seed(tmp_path: Path):
    a = VerifiedNeuralSubstrateBridgeV1(seed=23, neurons=10, inh_neurons=4, max_len=8, hidden=10)
    b = VerifiedNeuralSubstrateBridgeV1(seed=23, neurons=10, inh_neurons=4, max_len=8, hidden=10)
    ra = a.fit_verified(_rows(), epochs=2, local_plasticity=True)
    rb = b.fit_verified(_rows(), epochs=2, local_plasticity=True)
    sa = [round(a.predict(r["code"]), 6) for r in _rows()]
    sb = [round(b.predict(r["code"]), 6) for r in _rows()]
    assert sa == sb
    assert round(ra.train_mae, 6) == round(rb.train_mae, 6)
