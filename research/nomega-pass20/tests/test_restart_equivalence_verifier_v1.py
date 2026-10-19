from pathlib import Path
from core.nomega.restart_equivalence_verifier_v1 import RestartEquivalenceVerifierV1

def test_restart_equivalence(tmp_path: Path):
    v=RestartEquivalenceVerifierV1(tmp_path)
    bundle={'outputs':[1,2,3],'metrics':{'score':0.75}}
    captured=v.capture(None,bundle)
    assert captured['fingerprint']
    ok=v.verify(bundle)
    assert ok['ok'] is True

def test_restart_mismatch_is_detected(tmp_path: Path):
    v=RestartEquivalenceVerifierV1(tmp_path)
    v.capture(None, {'outputs':[1], 'metrics':{'score':1.0}})
    out=v.verify({'outputs':[2], 'metrics':{'score':1.0}})
    assert out['ok'] is False
