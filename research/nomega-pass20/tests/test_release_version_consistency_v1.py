import json
from pathlib import Path
from core.nomega.version import PROJECT_VERSION

def test_all_release_version_sources_are_current():
    root = Path(__file__).resolve().parents[1]
    pyproject = (root / "pyproject.toml").read_text()
    version_json = json.loads((root / "VERSION.json").read_text())
    assert PROJECT_VERSION == "1.34.0-dev"
    assert 'version = "1.34.0.dev0"' in pyproject
    assert version_json["version"] == "1.34.0-dev"
    assert version_json["baseline"] == "1.14.1"
