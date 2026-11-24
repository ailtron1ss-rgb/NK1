from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))
from neurocore.current.upstream import UpstreamBackendCatalog, inspect_constructor  # noqa: E402


def main() -> int:
    catalog = UpstreamBackendCatalog.default()
    report = {
        "frontier": 93,
        "count": len(catalog.specs()),
        "available": list(catalog.available()),
        "constructor_inspection": {
            spec.key: inspect_constructor(catalog, spec.key)
            for spec in catalog.specs()
            if spec.status != "research_only" and spec.availability().get("available")
        },
        "backends": catalog.snapshot(),
        "note": "Availability is environment-local. Missing upstream code is never silently substituted by native NeuroCore code.",
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
