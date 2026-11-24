from pathlib import Path
import json
from neurocore.v85 import V85QualificationConfig, run_v85_qualification

if __name__ == '__main__':
    root = Path(__file__).resolve().parents[2]
    result = run_v85_qualification(V85QualificationConfig(seeds=(0,1,2), steps_per_task=6, batch_size=8))
    out = root / 'benchmarks' / 'v85' / 'V85_EXTERNAL_CONTINUAL_RESULT.json'
    out.write_text(json.dumps(result, indent=2))
    print(json.dumps(result['summary'], indent=2))
