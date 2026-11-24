from __future__ import annotations
from pathlib import Path
import json
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.nomega.benchmark_1_28_autonomous_repair_multiseed import run

if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="nomega_128_multiseed_") as tmp:
        print(json.dumps(run(Path(tmp)), indent=2, sort_keys=True))
