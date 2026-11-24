from pathlib import Path
import tempfile
from core.nomega.active_hypothesis_filter_v1 import ActiveHypothesisFilterV1
from core.nomega.neural_skill_retrieval_v2 import NeuralSkillRetrievalV2

def test_active_filter_eliminates_inconsistent_hypotheses():
    engine=ActiveHypothesisFilterV1()
    candidates=[0,1,2,3]; tests=[('a',0),('b',1)]
    pred=lambda c,x: c if x[0]=='a' else c%2
    exp=lambda x: x[1]
    out=engine.filter(candidates,tests,pred,exp,max_queries=2,survivors=1)
    assert out.tests_selected >= 1
    assert out.final_candidates < len(candidates)

def test_active_skill_retrieval_is_bounded():
    with tempfile.TemporaryDirectory() as d:
        engine=NeuralSkillRetrievalV2(Path(d),seed=2)
        code=[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]
        out=engine.search(code,'sum3',max_candidates=12,active_queries=4)
        assert out.candidates_retrieved >= 1
        assert out.candidates_after_filter >= 1
        assert out.active_tests <= 4
