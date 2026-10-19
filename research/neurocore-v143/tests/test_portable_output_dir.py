import os
import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from neurocore.research.portable_paths import resolve_output_dir


class PortableOutputDirTests(unittest.TestCase):
    def test_defaults_to_research_local_evidence(self):
        previous = os.environ.pop("NK_NEUROCORE_V143_OUTPUT_DIR", None)
        try:
            self.assertEqual(resolve_output_dir(ROOT), (ROOT / "evidence").resolve())
        finally:
            if previous is not None:
                os.environ["NK_NEUROCORE_V143_OUTPUT_DIR"] = previous

    def test_honors_explicit_override(self):
        with tempfile.TemporaryDirectory() as tmp:
            override = str(Path(tmp) / "external" / "artifacts")
            previous = os.environ.get("NK_NEUROCORE_V143_OUTPUT_DIR")
            os.environ["NK_NEUROCORE_V143_OUTPUT_DIR"] = override
            try:
                self.assertEqual(resolve_output_dir(ROOT), Path(override).resolve())
            finally:
                if previous is None:
                    os.environ.pop("NK_NEUROCORE_V143_OUTPUT_DIR", None)
                else:
                    os.environ["NK_NEUROCORE_V143_OUTPUT_DIR"] = previous


if __name__ == "__main__":
    unittest.main()
