import json
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from neural_prosthesis.service import RequestError, _context_window, create_handler


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


if __name__ == "__main__":
    unittest.main(verbosity=2)
