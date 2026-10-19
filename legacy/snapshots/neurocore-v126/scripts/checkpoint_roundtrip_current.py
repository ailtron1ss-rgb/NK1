from __future__ import annotations

import tempfile
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
sys.path.insert(0, str(SRC))

from neurocore.current import NeuroCoreCurrent, RuntimeStateStoreCurrent


def main() -> int:
    src = NeuroCoreCurrent()
    with tempfile.TemporaryDirectory() as td:
        path = Path(td) / "current.pt"
        RuntimeStateStoreCurrent.save(path, src)
        dst = NeuroCoreCurrent()
        result = RuntimeStateStoreCurrent.load(path, dst)
    assert result["current_neural_version"] == NeuroCoreCurrent.CURRENT_NEURAL_VERSION
    assert result["loaded_tensors"] > 0
    assert result["unexpected_tensors"] == []
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
