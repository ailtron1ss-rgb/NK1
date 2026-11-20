import hashlib
import json
import os
import tempfile
import socket
import threading
from contextlib import nullcontext
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from types import SimpleNamespace
from unittest.mock import patch

import torch
from torch import nn
from queue import Queue

from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from neural_prosthesis.engine import ArtifactError, _config_digest, _model_config
from neural_prosthesis.service import (
    BoundedThreadingHTTPServer,
    RequestError,
    TransformersRuntime,
    _context_window,
    _output_token_limit,
    _http_request_timeout_seconds,
    _load_layer_force_bank,
    create_handler,
)


class FakeRuntime:
    api_token = None

    def __init__(self):
        self._slot = threading.BoundedSemaphore(1)
        self.block_completion = False
        self.completion_started = threading.Event()
        self.release_completion = threading.Event()
        self.release_completion.set()

    def try_acquire_inference(self):
        return self._slot.acquire(blocking=False)

    def release_inference(self):
        self._slot.release()

    def status(self):
        return {"ready": True, "backend": "neural-prosthesis", "loaded_adapters": []}

    def complete(self, request):
        if self.block_completion:
            self.completion_started.set()
            if not self.release_completion.wait(timeout=5):
                raise RequestError(503, "fixture-timeout")
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
        self.server = BoundedThreadingHTTPServer(
            ("127.0.0.1", 0),
            create_handler(self.runtime),
            max_workers=4,
        )
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

    def test_overlapping_generation_is_rejected_before_entering_model_runtime(self):
        self.runtime.block_completion = True
        self.runtime.release_completion.clear()
        body = json.dumps({
            "messages": [{"role": "user", "content": "hold the model slot"}],
            "max_tokens": 8,
        }).encode("utf-8")
        request = urllib.request.Request(
            self.base + "/v1/chat/completions",
            data=body,
            headers={"content-type": "application/json"},
            method="POST",
        )
        first_result = Queue()

        def first_request():
            try:
                with urllib.request.urlopen(request, timeout=4) as response:
                    first_result.put((response.status, json.loads(response.read())))
            except Exception as error:
                first_result.put(error)

        worker = threading.Thread(target=first_request, daemon=True)
        worker.start()
        self.assertTrue(self.runtime.completion_started.wait(timeout=2))

        with self.assertRaises(urllib.error.HTTPError) as busy:
            urllib.request.urlopen(request, timeout=3)
        self.assertEqual(busy.exception.code, 429)
        self.assertEqual(json.loads(busy.exception.read())["error"], "inference-busy")

        self.runtime.release_completion.set()
        worker.join(timeout=4)
        self.assertFalse(worker.is_alive())
        result = first_result.get_nowait()
        if isinstance(result, Exception):
            raise result
        self.assertEqual(result[0], 200)

    def test_bounded_http_server_rejects_invalid_worker_budgets(self):
        with self.assertRaisesRegex(ValueError, "http-worker-limit-out-of-range"):
            BoundedThreadingHTTPServer(("127.0.0.1", 0), create_handler(self.runtime), max_workers=1)
        with self.assertRaisesRegex(ValueError, "http-worker-limit-out-of-range"):
            BoundedThreadingHTTPServer(("127.0.0.1", 0), create_handler(self.runtime), max_workers=65)

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


    def test_http_request_timeout_configuration_is_finite_and_bounded(self):
        self.assertEqual(_http_request_timeout_seconds("15"), 15.0)
        self.assertEqual(_http_request_timeout_seconds("0.1"), 0.1)
        for invalid in ("fast", "nan", "inf", "0.09", "120.1"):
            with self.subTest(invalid=invalid):
                with self.assertRaisesRegex(RuntimeError, "NEURO_NP_HTTP_REQUEST_TIMEOUT_SECONDS"):
                    _http_request_timeout_seconds(invalid)

        with self.assertRaisesRegex(ValueError, "http-request-timeout-out-of-range"):
            BoundedThreadingHTTPServer(
                ("127.0.0.1", 0),
                create_handler(self.runtime),
                request_timeout_seconds=float("inf"),
            )

    def test_idle_http_client_is_closed_and_worker_recovers(self):
        runtime = FakeRuntime()
        server = BoundedThreadingHTTPServer(
            ("127.0.0.1", 0),
            create_handler(runtime),
            max_workers=2,
            request_timeout_seconds=0.1,
        )
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = "http://127.0.0.1:" + str(server.server_address[1])
        client = None
        try:
            client = socket.create_connection(server.server_address, timeout=2)
            client.settimeout(1)
            # A client that never terminates its HTTP headers must not retain a
            # bounded handler worker forever.
            client.sendall(b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\n")
            try:
                received = client.recv(1)
            except socket.timeout:
                self.fail("idle HTTP client must be closed by the configured request timeout")
            self.assertEqual(received, b"", "timed-out client connection must be closed")

            with urllib.request.urlopen(base + "/health", timeout=2) as response:
                self.assertEqual(response.status, 200)
        finally:
            if client is not None:
                client.close()
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main(verbosity=2)

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


    def test_preloaded_profile_without_default_keeps_sidecar_hooks_disabled(self):
        with self._configure(default=""):
            controller, default_profile = _load_layer_force_bank(
                self.model,
                model_id=self.model_id,
                model_revision=self.revision,
                layer_path=self.layer_path,
            )
        self.assertIsNotNone(controller)
        self.assertIsNone(default_profile)
        try:
            diagnostic = controller.snapshot()
            self.assertTrue(diagnostic["loaded_profiles"])
            self.assertEqual(diagnostic["registered_hook_count"], 0)
            self.assertTrue(all(not layer._forward_hooks for layer in self.model.layers))
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

    def test_transformers_runtime_applies_only_the_operator_selected_profile(self):
        with self._configure(default="service-steering-v1"):
            controller, default_profile = _load_layer_force_bank(
                self.model,
                model_id=self.model_id,
                model_revision=self.revision,
                layer_path=self.layer_path,
            )

        class FakeTokenizer:
            pad_token_id = 0

            def apply_chat_template(self, _messages, *, tokenize, add_generation_prompt):
                return "user: fixture"

            def __call__(self, _prompt, *, return_tensors, truncation, max_length):
                return {
                    "input_ids": torch.tensor([[1, 2]], dtype=torch.long),
                    "attention_mask": torch.ones((1, 2), dtype=torch.long),
                }

            def decode(self, _tokens, *, skip_special_tokens):
                return "fixture completion"

        class FakeGenerator:
            def __init__(self, layer_model):
                self.layer_model = layer_model
                self.last_hidden = None

            def generate(self, *, input_ids, **_kwargs):
                self.last_hidden = self.layer_model(torch.ones((1, 2, 4)))
                return torch.cat([input_ids, torch.tensor([[3]], dtype=torch.long)], dim=-1)

        class InertAdapterBank:
            def activate(self, _adapter_id):
                return nullcontext()

            def close(self):
                return None

            def snapshot(self):
                return {"loaded_adapters": []}

        runtime = object.__new__(TransformersRuntime)
        runtime.tokenizer = FakeTokenizer()
        runtime.model = FakeGenerator(self.model)
        runtime.device = torch.device("cpu")
        runtime.model_id = self.model_id
        runtime.model_revision = self.revision
        runtime.layer_path = self.layer_path
        runtime.default_adapter = None
        runtime._adapter_manifest_digests = {}
        runtime._approved_manifest_digests = set()
        runtime.max_context_tokens = 32
        runtime._generation_lock = threading.Lock()
        runtime.bank = InertAdapterBank()
        runtime.layer_force = controller
        runtime.default_layer_force_profile = default_profile
        runtime.max_http_workers = 16

        try:
            sample = torch.ones((1, 2, 4))
            baseline = self.model(sample)
            response = runtime.complete({
                "messages": [{"role": "user", "content": "fixture"}],
                "max_tokens": 8,
                "temperature": 0,
            })
            self.assertEqual(response["choices"][0]["message"]["content"], "fixture completion")
            self.assertIsNotNone(runtime.model.last_hidden)
            self.assertFalse(torch.equal(baseline, runtime.model.last_hidden))
            self.assertTrue(torch.equal(baseline, self.model(sample)))
            diagnostic = runtime.status()
            self.assertTrue(diagnostic["layer_force"]["enabled"])
            self.assertNotIn("direction", json.dumps(diagnostic))
        finally:
            runtime.close()
        self.assertTrue(all(not layer._forward_hooks for layer in self.model.layers))
