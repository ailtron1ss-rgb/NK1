from pathlib import Path
import json

def test_campaign_cardinality_and_schema():
    root=Path(__file__).resolve().parents[2]/'data/campaign_v10'
    files=list(root.glob('*.json'))
    assert len(files)==12*8*10*5*4
    sample=json.loads(files[0].read_text())
    for key in ('task','architecture','seed','damage','budget','case_id','status','evidence'):
        assert key in sample
