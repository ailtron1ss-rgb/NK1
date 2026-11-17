import hashlib
import json
import os
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import torch
from torch import nn

from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from neural_prosthesis.engine import ArtifactError, _config_digest, _model_config
from neural_prosthesis.service import (
    RequestError,
    _context_window,
    _load_layer_force_bank,
    _output_token_limit,
    create_handler,
)


class FakeRuntime:
    api_token = None

    def status(self):
        return {"ready": True, "backend": "neural-prosthesis", "loaded_adapters": []}

    def complete(self, request):
        if request.get("adapter_id") == "quarantined":
            raise RequestError(403, "adapter-quarantined")
        return {
            "id": "fixture",
            "object": "chat.completion",
            "model": "fixture-model",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": "fixture response"}, "finish_reason": "stop"}],
        }


class NeuralProsthesisHttpTests(unittest.TestCase):
    def test_context_window_never_exceeds_model_architecture_or_host_limit(self):
        class Config:
            max_position_embeddings = 4096
            n_positions = 2048

        self.assertEqual(_context_window(Config(), "8192"), 2048)
        self.assertEqual(_context_window({"max_position_embeddings": 4096}, 1024), 1024)
        self.assertEqual(_context_window(object(), 8192), 8192)
        self.assertEqual(_context_window({"max_position_embeddings": 1_000_000}, 100_000), 65_536)
        with self.assertRaisesRegex(RuntimeError, "must-be-an-integer"):
            _context_window(object(), "many")

    def test_generation_budget_is_clamped_inside_the_model_context(self):
        self.assertEqual(_output_token_limit(2048, 512), 511)
        self.assertEqual(_output_token_limit(120, 1024), 120)
        self.assertEqual(_output_token_limit(1, 2), 1)
        with self.assertRaises(RequestError) as invalid:
            _output_token_limit(True, 4096)
        self.assertEqual(invalid.exception.status, 400)

    def setUp(self):
        self.runtime = FakeRuntime()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), create_handler(self.runtime))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = "http://127.0.0.1:" + str(self.server.server_address[1])

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def test_openai_compatible_completion_and_read_only_health(self):
        with urllib.request.urlopen(self.base + "/health", timeout=3) as response:
            self.assertEqual(response.status, 200)
            self.assertTrue(json.loads(response.read())["ready"])
        body = json.dumps({
            "model": "fixture-model",
            "messages": [{"role": "user", "content": "hello"}],
            "max_tokens": 8,
            "temperature": 0,
            "stream": False,
        }).encode("utf-8")
        request = urllib.request.Request(
            self.base + "/v1/chat/completions",
            data=body,
            headers={"content-type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=3) as response:
            payload = json.loads(response.read())
            self.assertEqual(payload["choices"][0]["message"]["content"], "fixture response")

    def test_optional_bearer_auth_protects_inference_and_detailed_status(self):
        self.runtime.api_token = "t" * 48
        with urllib.request.urlopen(self.base + "/health", timeout=3) as health:
            payload = json.loads(health.read())
            self.assertTrue(payload["ready"])
            self.assertEqual(set(payload), {"ready", "backend"})

        with self.assertRaises(urllib.error.HTTPError) as status:
            urllib.request.urlopen(self.base + "/neural-prosthesis/status", timeout=3)
        self.assertEqual(status.exception.code, 401)

        payload = json.dumps({
            "messages": [{"role": "user", "content": "hello"}],
            "max_tokens": 8,
        }).encode("utf-8")
        unauthorized = urllib.request.Request(
            self.base + "/v1/chat/completions",
            data=payload,
            headers={"content-type": "application/json"},
            method="POST",
        )
        with self.assertRaises(urllib.error.HTTPError) as rejected:
            urllib.request.urlopen(unauthorized, timeout=3)
        self.assertEqual(rejected.exception.code, 401)

        authorized = urllib.request.Request(
            self.base + "/v1/chat/completions",
            data=payload,
            headers={
                "content-type": "application/json",
                "authorization": "Bearer " + self.runtime.api_token,
            },
            method="POST",
        )
        with urllib.request.urlopen(authorized, timeout=3) as response:
            self.assertEqual(response.status, 200)

        detailed = urllib.request.Request(
            self.base + "/neural-prosthesis/status",
            headers={"authorization": "Bearer " + self.runtime.api_token},
        )
        with urllib.request.urlopen(detailed, timeout=3) as response:
            self.assertEqual(json.loads(response.read())["backend"], "neural-prosthesis")

    def test_rejects_host_header_outside_loopback(self):
        request = urllib.request.Request(
            self.base + "/health",
            headers={"Host": "attacker.example"},
        )
        with self.assertRaises(urllib.error.HTTPError) as rejected:
            urllib.request.urlopen(request, timeout=3)
        self.assertEqual(rejected.exception.code, 403)

    def test_rejects_non_json_inference_requests(self):
        request = urllib.request.Request(
            self.base + "/v1/chat/completions",
            data=b"not-json",
            headers={"content-type": "text/plain"},
            method="POST",
        )
        with self.assertRaises(urllib.error.HTTPError) as rejected:
            urllib.request.urlopen(request, timeout=3)
        self.assertEqual(rejected.exception.code, 415)

    def test_quarantined_adapter_is_rejected_and_unknown_path_is_not_served(self):
        body = json.dumps({
            "messages": [{"role": "user", "content": "hello"}],
            "adapter_id": "quarantined",
        }).encode("utf-8")
        request = urllib.request.Request(
            self.base + "/v1/chat/completions",
            data=body,
            headers={"content-type": "application/json"},
            method="POST",
        )
        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(request, timeout=3)
        self.assertEqual(caught.exception.code, 403)
        self.assertEqual(json.loads(caught.exception.read())["error"], "adapter-quarantined")
        with self.assertRaises(urllib.error.HTTPError) as missing:
            urllib.request.urlopen(self.base + "/unknown", timeout=3)
        self.assertEqual(missing.exception.code, 404)



class LayerForceSidecarConfigurationTests(unittest.TestCase):
    class TinyModel(nn.Module):
        def __init__(self):
            super().__init__()
            self.config = SimpleNamespace(
                to_dict=lambda: {"model_type": "layer-force-service-test", "hidden_size": 4}
            )
            self.layers = nn.ModuleList([nn.Identity(), nn.Identity(), nn.Identity()])
            self.anchor = nn.Parameter(torch.zeros(1))

        def forward(self, hidden):
            for layer in self.layers:
                hidden = layer(hidden)
            return hidden

    def setUp(self):
        self.model = self.TinyModel()
        self.model_id = "nk1/layer-force-service-test"
        self.revision = "a" * 40
        self.layer_path = "layers"
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.profile_path = Path(self.temp.name) / "profile.json"
        payload = {
            "schema_version": 1,
            "profile_id": "service-steering-v1",
            "model": {
                "model_id": self.model_id,
                "model_revision": self.revision,
                "config_sha256": _config_digest(_model_config(self.model)),
                "layer_path": self.layer_path,
                "hidden_size": 4,
            },
            "layers": [{"index": 1, "direction": [1.0, 0.0, 0.0, 0.0], "strength": 1.0}],
            "max_delta_ratio": 0.05,
        }
        self.profile_path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        self.profile_digest = hashlib.sha256(self.profile_path.read_bytes()).hexdigest()

    def _configure(self, *, paths=None, allowlist=None, default=""):
        return patch.dict(os.environ, {
            "NEURO_NP_LAYER_FORCE_PROFILE_PATHS_JSON": json.dumps(
                paths if paths is not None else [str(self.profile_path)]
            ),
            "NEURO_NP_ALLOWED_LAYER_FORCE_PROFILES_JSON": json.dumps(
                allowlist if allowlist is not None else [self.profile_digest]
            ),
            "NEURO_NP_DEFAULT_LAYER_FORCE_PROFILE": default,
        })

    def test_layer_force_is_disabled_without_operator_profile(self):
        with self._configure(paths=[], allowlist=[], default=""):
            controller, default_profile = _load_layer_force_bank(
                self.model,
                model_id=self.model_id,
                model_revision=self.revision,
                layer_path=self.layer_path,
            )
        self.assertIsNone(controller)
        self.assertIsNone(default_profile)

    def test_default_layer_force_profile_is_loaded_and_changes_generate_path_activations(self):
        with self._configure(default="service-steering-v1"):
            controller, default_profile = _load_layer_force_bank(
                self.model,
                model_id=self.model_id,
                model_revision=self.revision,
                layer_path=self.layer_path,
            )
        self.assertIsNotNone(controller)
        self.assertEqual(default_profile, "service-steering-v1")
        self.assertEqual(controller.snapshot()["loaded_profiles"][0]["profile_id"], default_profile)
        try:
            sample = torch.ones(1, 2, 4)
            baseline = self.model(sample)
            with torch.inference_mode(), controller.activate(default_profile):
                steered = self.model(sample)
            self.assertFalse(torch.equal(baseline, steered))
        finally:
            controller.close()

    def test_layer_force_refuses_unapproved_profiles_and_unversioned_models(self):
        with self._configure(allowlist=["0" * 64], default="service-steering-v1"):
            with self.assertRaisesRegex(ArtifactError, "not-host-approved"):
                _load_layer_force_bank(
                    self.model,
                    model_id=self.model_id,
                    model_revision=self.revision,
                    layer_path=self.layer_path,
                )
        with self._configure(default="service-steering-v1"):
            with self.assertRaisesRegex(RuntimeError, "MODEL_REVISION"):
                _load_layer_force_bank(
                    self.model,
                    model_id=self.model_id,
                    model_revision="unversioned-local",
                    layer_path=self.layer_path,
                )

    def test_layer_force_default_must_reference_an_loaded_profile(self):
        with self._configure(paths=[], allowlist=[], default="missing-profile"):
            with self.assertRaisesRegex(RuntimeError, "requires-a-local-profile"):
                _load_layer_force_bank(
                    self.model,
                    model_id=self.model_id,
                    model_revision=self.revision,
                    layer_path=self.layer_path,
                )


if __name__ == "__main__":
    unittest.main(verbosity=2)
