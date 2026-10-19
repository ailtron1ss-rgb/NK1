from pathlib import Path

from core.nomega.partial_program_value_v1 import PartialProgramValueV1


def test_partial_value_observes_prefixes(tmp_path: Path):
    v = PartialProgramValueV1(tmp_path, seed=5, ensemble=2)
    code = [(1,0,0),(13,0,0),(14,0,0)]
    assert v.observe_node(0, code, 0.8) == 3
    assert len(v.obs) == 3


def test_partial_value_fit_and_predict(tmp_path: Path):
    v = PartialProgramValueV1(tmp_path, seed=7, ensemble=2)
    base = [(1,0,0),(13,0,0),(14,0,0)]
    for i in range(12):
        code = base + ([(5,0,1)] * (i % 3))
        v.observe_node(i % 4, code, 0.2 + 0.05 * (i % 7))
    report = v.fit(epochs=2, batch_size=8, lr=1e-3)
    assert report is not None
    pred, unc = v.predict(0, base)
    assert 0.0 <= pred <= 1.0
    assert unc >= 0.0
