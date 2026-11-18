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
from neural_prosthesis.layer_force import LayerForceBank, LayerForceError  # noqa: E402


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

    def write_profile(self, *, bank=None, path=None, **overrides):
        bank = bank or self.bank
        profile = {
            "schema_version": 1,
            "profile_id": "kurisu-reasoning-v1",
            "model": {
                "model_id": bank.model_id,
                "model_revision": bank.model_revision,
                "config_sha256": bank.config_sha256,
                "layer_path": bank.layer_path,
                "hidden_size": bank.hidden_size,
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
        path = path or self.root / "profile.json"
        raw = json.dumps(profile, sort_keys=True, separators=(",", ":"), allow_nan=True).encode("utf-8")
        path.write_bytes(raw)
        return path, hashlib.sha256(raw).hexdigest(), profile

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

        with self.bank.activate(None):
            explicitly_disabled, _ = self.model(sample)
        self.assertTrue(torch.equal(baseline, explicitly_disabled))

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
            list_path, list_digest, _ = self.write_profile(bank=list_bank, path=self.root / "list-profile.json")
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
        path, digest, profile = self.write_profile()
        with self.assertRaisesRegex(LayerForceError, "profile-not-host-approved"):
            self.bank.load_profile(path, ["0" * 64])
        self.assertEqual(self.bank.snapshot()["loaded_profiles"], [])

        profile["max_delta_ratio"] = 0.08
        tampered = json.dumps(profile, sort_keys=True, separators=(",", ":")).encode("utf-8")
        path.write_bytes(tampered)
        with self.assertRaisesRegex(LayerForceError, "profile-not-host-approved"):
            self.bank.load_profile(path, [digest])
        self.assertEqual(self.bank.snapshot()["loaded_profiles"], [])

    def test_model_revision_and_hidden_width_must_match(self):
        path, _, profile = self.write_profile()
        profile["model"]["model_revision"] = "b" * 40
        path, digest, _ = self.write_profile(model=profile["model"])
        with self.assertRaisesRegex(LayerForceError, "profile-model-binding-mismatch"):
            self.bank.load_profile(path, [digest])

        wrong_model = dict(profile["model"])
        wrong_model["model_revision"] = self.bank.model_revision
        wrong_model["hidden_size"] = 7
        path, digest, _ = self.write_profile(model=wrong_model)
        with self.assertRaisesRegex(LayerForceError, "profile-model-binding-mismatch"):
            self.bank.load_profile(path, [digest])

    def test_zero_nonfinite_wrong_width_and_excess_layers_are_rejected(self):
        path, digest, _ = self.write_profile(layers=[{
            "index": 1,
            "direction": [0.0] * 8,
            "strength": 1.0,
        }])
        with self.assertRaisesRegex(LayerForceError, "profile-direction-zero-or-nonfinite"):
            self.bank.load_profile(path, [digest])

        path, digest, _ = self.write_profile(layers=[{
            "index": 1,
            "direction": [float("nan")] + [0.0] * 7,
            "strength": 1.0,
        }])
        with self.assertRaisesRegex(LayerForceError, "profile-direction-values-invalid"):
            self.bank.load_profile(path, [digest])

        path, digest, _ = self.write_profile(layers=[{
            "index": 1,
            "direction": [1.0] + [0.0] * 5,
            "strength": 1.0,
        }])
        with self.assertRaisesRegex(LayerForceError, "profile-direction-width-mismatch"):
            self.bank.load_profile(path, [digest])

        path, digest, _ = self.write_profile(layers=[
            {"index": index, "direction": [1.0] + [0.0] * 7, "strength": 0.5}
            for index in range(9)
        ])
        with self.assertRaisesRegex(LayerForceError, "profile-layer-count-out-of-range"):
            self.bank.load_profile(path, [digest])

    def test_duplicate_json_keys_and_symlink_paths_fail_closed(self):
        path = self.root / "duplicate.json"
        path.write_text('{"schema_version":1,"schema_version":1}', encoding="utf-8")
        with self.assertRaisesRegex(LayerForceError, "profile-duplicate-json-key"):
            self.bank.load_profile(path, ["0" * 64])

        valid_path, valid_digest, _ = self.write_profile()
        link = self.root / "profile-link.json"
        try:
            link.symlink_to(valid_path)
        except (OSError, NotImplementedError):
            self.skipTest("file symlinks are unavailable on this platform")
        with self.assertRaisesRegex(LayerForceError, "profile-symlink-not-allowed"):
            self.bank.load_profile(link, [valid_digest])

        parent_link = self.root / "profile-directory-link"
        try:
            parent_link.symlink_to(self.root, target_is_directory=True)
        except (OSError, NotImplementedError):
            self.skipTest("directory symlinks are unavailable on this platform")
        with self.assertRaisesRegex(LayerForceError, "profile-symlink-not-allowed"):
            self.bank.load_profile(parent_link / valid_path.name, [valid_digest])


    def test_profiles_do_not_register_hooks_until_explicit_activation(self):
        path, digest, _ = self.write_profile()
        profile_id = self.bank.load_profile(path, [digest])

        self.assertEqual(self.bank.snapshot()["registered_hook_count"], 0)
        sample = torch.randn(1, 2, 8)
        baseline, _ = self.model(sample)
        self.assertTrue(torch.equal(baseline, self.model(sample)[0]))
        self.assertEqual(self.bank.snapshot()["registered_hook_count"], 0)

        with self.bank.activate(profile_id):
            steered, _ = self.model(sample)
            self.assertFalse(torch.equal(baseline, steered))
        self.assertEqual(self.bank.snapshot()["registered_hook_count"], 1)

    def test_low_precision_rounding_never_exceeds_the_per_token_delta_cap(self):
        path, digest, _ = self.write_profile()
        profile_id = self.bank.load_profile(path, [digest])

        for dtype in (torch.float16, torch.bfloat16):
            with self.subTest(dtype=dtype):
                sample = torch.tensor([[[0.265625, 0, 0, 0, 0, 0, 0, 0]]], dtype=dtype)
                baseline, _ = self.model(sample)
                with torch.inference_mode(), self.bank.activate(profile_id):
                    steered, _ = self.model(sample)

                actual_delta = (steered.float() - baseline.float()).norm(dim=-1)
                allowed_delta = baseline.float().norm(dim=-1) * 0.10
                self.assertTrue(
                    torch.all(actual_delta <= allowed_delta),
                    f"{dtype} rounding exceeded the strict per-token cap: {actual_delta} > {allowed_delta}",
                )

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
