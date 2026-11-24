from neurocore.v17.uniqueness import intervention_gap

def test_ablation_runs_and_changes_outputs():
    rows=intervention_gap(0)
    vals={k:v for k,v in rows}
    assert set(vals)=={'full','no_evidence','no_memory_feedback','no_credit'}
    assert max(vals.values()) - min(vals.values()) > 1e-6
