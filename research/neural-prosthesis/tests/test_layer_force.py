from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import torch
from torch import nn

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from neural_prosthesis.engine import ArtifactError  # noqa: E402
from neural_prosthesis.layer_force import LayerForceBank  # noqa: E402


class IdentityLayer(nn.Module):
    def forward(self, hidden):
        return hidden, {"cache_marker": 17}


class ListOutputLayer(nn.Module):
    def forward(self, hidden):
        return [hidden, {"cache_marker": 23}]


class TinyModel(nn.Module):
    def __init__(self, hidden_size: int = 8, layer_count: int = 3, list_output: bool = False):
        super().__init__()
        self.config = SimpleNamespace(
            model_type="tiny-test-transformer",
            hidden_size=hidden_size,
            architectures=["TinyModel"],
            to_dict=lambda: {
                "model_type": "tiny-test-transformer",
                "hidden_size": hidden_size,
                "architectures": ["TinyModel"],
            },
        )
        layer_type = ListOutputLayer if list_output else IdentityLayer
        self.layers = nn.ModuleList([layer_type() for _ in range(layer_count)])

    def forward(self, hidden):
        auxiliaries = []
        for layer in self.layers:
            output = layer(hidden)
            hidden, auxiliary = output
            auxiliaries.append(auxiliary)
        return hidden, auxiliaries


class LayerForceTests(unittest.TestCase):
    def setUp(self):
        torch.manual_seed(7)
        self.model = TinyModel()
        self.model.eval()
        self.bank = LayerForceBank(
            self.model,
            model_id="nk1/tiny-test",
            model_revision="a" * 40,
            layer_path="layers",
        )
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.bank.close()
        self.tmp.cleanup()

    def write_profile(self, **overrides):
        profile = {
            "schema_version": 1,
            "profile_id": "kurisu-reasoning-v1",
            "model": {
                "model_id": "nk1/tiny-test",
                "model_revision": "a" * 40,
                "config_sha256": self.bank.config_sha256,
                "layer_path": "layers",
                "hidden_size": 8,
            },
            "layers": [
                {
                    "index": 1,
                    "direction": [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
                    "strength": 1.0,
                }
            ],
            "max_delta_ratio": 0.10,
        }
        profile.update(overrides)
        path = self.root / "profile.json"
        path.write_text(json.dumps(profile, separators=(",", ":")), encoding="utf-8")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        return path, digest, profile

    def test_selected_layer_is_steered_with_a_hard_per_token_norm_bound(self):
        path, digest, _ = self.write_profile()
        profile_id = self.bank.load_profile(path, [digest])
        sample = torch.randn(2, 4, 8)
        baseline, _ = self.model(sample)

        with torch.inference_mode(), self.bank.activate(profile_id):
            steered, auxiliaries = self.model(sample)

        delta = (steered - baseline).float().norm(dim=-1)
        baseline_norm = baseline.float().norm(dim=-1).clamp_min(1e-12)
        self.assertTrue(torch.all(delta > 0), "the selected decoder layer must receive a real activation update")
        self.assertTrue(torch.all(delta <= baseline_norm * 0.10001))
        self.assertEqual(auxiliaries, [{"cache_marker": 17}] * 3)

    def test_unselected_or_inactive_profile_is_an_exact_noop(self):
        path, digest, _ = self.write_profile()
        profile_id = self.bank.load_profile(path, [digest])
        sample = torch.randn(2, 4, 8)
        baseline, _ = self.model(sample)
        disabled, _ = self.model(sample)
        self.assertTrue(torch.equal(baseline, disabled))

        with self.bank.activate(profile_id, strength=0.0):
            zero_strength, _ = self.model(sample)
        self.assertTrue(torch.equal(baseline, zero_strength))

    def test_tuple_and_list_outputs_preserve_auxiliary_values(self):
        path, digest, _ = self.write_profile()
        profile_id = self.bank.load_profile(path, [digest])
        sample = torch.randn(1, 2, 8)
        with self.bank.activate(profile_id):
            _, auxiliaries = self.model(sample)
        self.assertEqual(auxiliaries, [{"cache_marker": 17}] * 3)

        list_model = TinyModel(list_output=True)
        list_model.eval()
        list_bank = LayerForceBank(
            list_model,
            model_id="nk1/tiny-test",
            model_revision="a" * 40,
            layer_path="layers",
        )
        try:
            list_path = self.root / "list-profile.json"
            list_profile = self.write_profile()[2]
            list_path.write_text(json.dumps(list_profile), encoding="utf-8")
            list_digest = hashlib.sha256(list_path.read_bytes()).hexdigest()
            list_id = list_bank.load_profile(list_path, [list_digest])
            with list_bank.activate(list_id):
                output, aux = list_model(sample)
            self.assertEqual(aux, [{"cache_marker": 23}] * 3)
            self.assertTrue(torch.isfinite(output).all())
        finally:
            list_bank.close()

    def test_request_context_resets_after_exception_and_nested_activation(self):
        path, digest, _ = self.write_profile()
        profile_id = self.bank.load_profile(path, [digest])
        sample = torch.randn(1, 2, 8)
        baseline, _ = self.model(sample)

        with self.assertRaisesRegex(RuntimeError, "request-failed"):
            with self.bank.activate(profile_id):
                active, _ = self.model(sample)
                self.assertFalse(torch.equal(baseline, active))
                raise RuntimeError("request-failed")

        after_failure, _ = self.model(sample)
        self.assertTrue(torch.equal(baseline, after_failure))

        with self.bank.activate(profile_id):
            outer, _ = self.model(sample)
            with self.bank.activate(None):
                nested_disabled, _ = self.model(sample)
            restored_outer, _ = self.model(sample)
        self.assertTrue(torch.equal(nested_disabled, baseline))
        self.assertTrue(torch.equal(outer, restored_outer))

    def test_unapproved_or_tampered_profile_is_rejected_before_registration(self):
        path, digest, _ = self.write_profile()
        with self.assertRaisesRegex(ArtifactError, "not-host-approved"):
            self.bank.load_profile(path, ["0" * 64])
        self.assertEqual(self.bank.snapshot()["loaded_profiles"], [])

        path.write_text(path.read_text(encoding="utf-8") + " ", encoding="utf-8")
        with self.assertRaisesRegex(ArtifactError, "not-host-approved"):
            self.bank.load_profile(path, [digest])

    def test_model_revision_and_hidden_width_must_match(self):
        path, _, profile = self.write_profile()
        profile["model"]["model_revision"] = "b" * 40
        path.write_text(json.dumps(profile), encoding="utf-8")
        mismatch_digest = hashlib.sha256(path.read_bytes()).hexdigest()
        with self.assertRaisesRegex(ArtifactError, "model-binding-mismatch"):
            self.bank.load_profile(path, [mismatch_digest])

        profile["model"]["model_revision"] = "a" * 40
        profile["model"]["hidden_size"] = 7
        path.write_text(json.dumps(profile), encoding="utf-8")
        wrong_width_digest = hashlib.sha256(path.read_bytes()).hexdigest()
        with self.assertRaisesRegex(ArtifactError, "model-binding-mismatch"):
            self.bank.load_profile(path, [wrong_width_digest])

    def test_zero_nonfinite_wrong_width_and_excess_layers_are_rejected(self):
        path, _, profile = self.write_profile()
        profile["layers"][0]["direction"] = [0.0] * 8
        path.write_text(json.dumps(profile), encoding="utf-8")
        with self.assertRaisesRegex(ArtifactError, "direction"):
            self.bank.load_profile(path, [hashlib.sha256(path.read_bytes()).hexdigest()])

        profile["layers"][0]["direction"] = [float("nan")] + [0.0] * 7
        path.write_text(json.dumps(profile), encoding="utf-8")
        with self.assertRaisesRegex(ArtifactError, "direction"):
            self.bank.load_profile(path, [hashlib.sha256(path.read_bytes()).hexdigest()])

        profile["layers"] = [
            {"index": index, "direction": [1.0] + [0.0] * 7, "strength": 0.5}
            for index in range(9)
        ]
        path.write_text(json.dumps(profile), encoding="utf-8")
        with self.assertRaisesRegex(ArtifactError, "layer-count"):
            self.bank.load_profile(path, [hashlib.sha256(path.read_bytes()).hexdigest()])

    def test_duplicate_json_keys_and_symlink_paths_fail_closed(self):
        path, _, _ = self.write_profile()
        path.write_text('{"schema_version":1,"schema_version":1}', encoding="utf-8")
        with self.assertRaisesRegex(ArtifactError, "duplicate"):
            self.bank.load_profile(path, [hashlib.sha256(path.read_bytes()).hexdigest()])

        valid_path, valid_digest, _ = self.write_profile()
        link = self.root / "profile-link.json"
        try:
            link.symlink_to(valid_path)
        except (OSError, NotImplementedError):
            self.skipTest("file symlinks are unavailable on this platform")
        with self.assertRaisesRegex(ArtifactError, "symlink"):
            self.bank.load_profile(link, [valid_digest])

    def test_snapshot_redacts_activation_directions(self):
        path, digest, _ = self.write_profile()
        self.bank.load_profile(path, [digest])
        snapshot = self.bank.snapshot()
        serialized = json.dumps(snapshot)
        self.assertIn("kurisu-reasoning-v1", serialized)
        self.assertIn(digest, serialized)
        self.assertNotIn("direction", serialized)
        self.assertNotIn("1.0, 0.0", serialized)


if __name__ == "__main__":
    unittest.main(verbosity=2)
