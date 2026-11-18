from __future__ import annotations

import hmac
import json
import math
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import torch
from contextlib import nullcontext

from .engine import ArtifactError, NeuralProsthesisBank, _resolve_layer_stack
from .layer_force import LayerForceBank


MAX_REQUEST_BYTES = 1024 * 1024
MAX_MESSAGE_CHARS = 64_000
MAX_MESSAGES = 32
MAX_CONTEXT_TOKENS = 65_536


def _context_window(model_config: Any, configured: str | int) -> int:
    try:
        requested = int(configured)
    except (TypeError, ValueError) as error:
        raise RuntimeError("NEURO_NP_MAX_CONTEXT_TOKENS-must-be-an-integer") from error
    limit = max(2, min(MAX_CONTEXT_TOKENS, requested))
    names = (
        "max_position_embeddings",
        "n_positions",
        "max_sequence_length",
        "max_seq_len",
        "seq_length",
    )
    model_limits = []
    for name in names:
        value = model_config.get(name) if isinstance(model_config, dict) else getattr(model_config, name, None)
        if type(value) is int and 2 <= value <= 1_000_000:
            model_limits.append(value)
    return min([limit, *model_limits]) if model_limits else limit


class RequestError(ValueError):
    def __init__(self, status: int, code: str):
        super().__init__(code)
        self.status = int(status)
        self.code = code


def _output_token_limit(requested: Any, context_window: int) -> int:
    if not isinstance(requested, int) or isinstance(requested, bool) or not 1 <= requested <= 2048:
        raise RequestError(400, "max-tokens-out-of-range")
    if type(context_window) is not int or context_window < 2:
        raise RuntimeError("model-context-window-invalid")
    return min(requested, context_window - 1)


def _json_list(env_name: str, *, maximum: int) -> list[str]:
    raw = os.environ.get(env_name, "[]")
    try:
        value = json.loads(raw)
    except Exception as error:
        raise RuntimeError(f"{env_name}-must-be-json-array") from error
    if not isinstance(value, list) or len(value) > maximum or any(not isinstance(item, str) for item in value):
        raise RuntimeError(f"{env_name}-invalid")
    return value


def _device_and_dtype(requested: str) -> tuple[torch.device, torch.dtype]:
    value = str(requested or "auto").lower()
    if value == "auto":
        if torch.cuda.is_available():
            device = torch.device("cuda")
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            device = torch.device("mps")
        else:
            device = torch.device("cpu")
    else:
        device = torch.device(value)
        if device.type == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("requested-cuda-device-unavailable")
        if device.type == "mps" and not (hasattr(torch.backends, "mps") and torch.backends.mps.is_available()):
            raise RuntimeError("requested-mps-device-unavailable")
    if device.type == "cuda":
        dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    else:
        dtype = torch.float32
    return device, dtype


def _find_layer_path(model: torch.nn.Module) -> str:
    configured = str(os.environ.get("NEURO_NP_LAYER_PATH", "")).strip()
    candidates = [configured] if configured else []
    candidates.extend([
        "model.layers",
        "transformer.h",
        "gpt_neox.layers",
        "model.decoder.layers",
        "decoder.layers",
        "layers",
    ])
    for candidate in candidates:
        if not candidate:
            continue
        try:
            _resolve_layer_stack(model, candidate)
            return candidate
        except ArtifactError:
            continue
    raise RuntimeError("unsupported-transformer-layer-layout-set-NEURO_NP_LAYER_PATH")


def _load_layer_force_bank(
    model: torch.nn.Module,
    *,
    model_id: str,
    model_revision: str,
    layer_path: str,
) -> tuple[LayerForceBank | None, str | None]:
    profile_paths = _json_list("NEURO_NP_LAYER_FORCE_PROFILE_PATHS_JSON", maximum=16)
    approved_digests = _json_list("NEURO_NP_ALLOWED_LAYER_FORCE_PROFILES_JSON", maximum=128)
    default_profile = str(os.environ.get("NEURO_NP_DEFAULT_LAYER_FORCE_PROFILE", "")).strip() or None

    if not profile_paths:
        if default_profile is not None:
            raise RuntimeError("NEURO_NP_DEFAULT_LAYER_FORCE_PROFILE-requires-a-local-profile")
        return None, None
    if model_revision == "unversioned-local":
        raise RuntimeError("NEURO_NP_MODEL_REVISION-is-required-for-layer-force-profiles")

    controller = LayerForceBank(
        model,
        model_id=model_id,
        model_revision=model_revision,
        layer_path=layer_path,
    )
    try:
        loaded: set[str] = set()
        for profile_path in profile_paths:
            loaded.add(controller.load_profile(profile_path, approved_digests))
        if default_profile is not None and default_profile not in loaded:
            raise RuntimeError("NEURO_NP_DEFAULT_LAYER_FORCE_PROFILE-not-loaded-or-approved")
        return controller, default_profile
    except Exception:
        controller.close()
        raise




class TransformersRuntime:
    def __init__(self) -> None:
        api_token = str(os.environ.get("NEURO_NP_API_TOKEN", ""))
        if api_token and (
            not 32 <= len(api_token) <= 512
            or any(not 33 <= ord(character) <= 126 for character in api_token)
        ):
            raise RuntimeError("NEURO_NP_API_TOKEN-must-be-32-to-512-printable-nonspace-ASCII-characters")
        self.api_token = api_token or None
        model_path = str(os.environ.get("NEURO_NP_MODEL_PATH", "")).strip()
        if not model_path:
            raise RuntimeError("NEURO_NP_MODEL_PATH-must-point-to-an-existing-local-model")
        if not Path(model_path).expanduser().exists():
            raise RuntimeError("NEURO_NP_MODEL_PATH-not-found")
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except ImportError as error:
            raise RuntimeError("install-research/neural-prosthesis/requirements.txt") from error

        self.device, dtype = _device_and_dtype(os.environ.get("NEURO_NP_DEVICE", "auto"))
        self.model_path = str(Path(model_path).expanduser().resolve())
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_path,
            local_files_only=True,
            trust_remote_code=False,
        )
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_path,
            local_files_only=True,
            trust_remote_code=False,
            torch_dtype=dtype,
        )
        self.model.to(self.device)
        self.model.eval()
        if getattr(self.tokenizer, "pad_token_id", None) is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        # Preserve the newest user turn when the prompt must be truncated.
        self.tokenizer.truncation_side = "left"
        self.model.config.use_cache = True

        model_id = str(os.environ.get("NEURO_NP_MODEL_ID") or getattr(self.model.config, "_name_or_path", "") or Path(self.model_path).name)
        revision = str(os.environ.get("NEURO_NP_MODEL_REVISION") or "unversioned-local")
        self.layer_path = _find_layer_path(self.model)
        self.bank = NeuralProsthesisBank(
            self.model,
            model_id=model_id,
            model_revision=revision,
            layer_path=self.layer_path,
        )
        self.layer_force: LayerForceBank | None = None
        self.default_layer_force_profile: str | None = None
        try:
            self._approved_manifest_digests = set(_json_list("NEURO_NP_ALLOWED_MANIFESTS_JSON", maximum=128))
            for value in self._approved_manifest_digests:
                if len(value) != 64 or any(ch not in "0123456789abcdef" for ch in value):
                    raise RuntimeError("NEURO_NP_ALLOWED_MANIFESTS_JSON-contains-invalid-sha256")
            self._adapter_manifest_digests: dict[str, str] = {}
            adapter_dirs = _json_list("NEURO_NP_ADAPTER_DIRS_JSON", maximum=32)
            if revision == "unversioned-local" and adapter_dirs:
                raise RuntimeError("NEURO_NP_MODEL_REVISION-is-required-to-load-adapters")
            for raw_dir in adapter_dirs:
                artifact_dir = Path(raw_dir).expanduser()
                adapter_id = self.bank.load_adapter(artifact_dir)
                manifest = json.loads((artifact_dir / "manifest.json").read_text(encoding="utf-8"))
                self._adapter_manifest_digests[adapter_id] = str(manifest["manifest_sha256"])
            self.bank.eval()

            self.default_adapter = str(os.environ.get("NEURO_NP_DEFAULT_ADAPTER", "")).strip() or None
            if self.default_adapter is not None and not self._is_approved(self.default_adapter):
                raise RuntimeError("NEURO_NP_DEFAULT_ADAPTER-must-be-host-allowlisted")
            self.max_context_tokens = _context_window(
                self.model.config,
                os.environ.get("NEURO_NP_MAX_CONTEXT_TOKENS", "8192"),
            )
            self._generation_lock = threading.Lock()
            self.model_id = model_id
            self.model_revision = revision

            # Construct the optional steering controller last. Profile admission
            # is inert until activation; failures cannot strand model hooks.
            self.layer_force, self.default_layer_force_profile = _load_layer_force_bank(
                self.model,
                model_id=model_id,
                model_revision=revision,
                layer_path=self.layer_path,
            )
        except Exception:
            if self.layer_force is not None:
                self.layer_force.close()
            self.bank.close()
            raise

    def _is_approved(self, adapter_id: str) -> bool:
        digest = self._adapter_manifest_digests.get(adapter_id)
        return bool(digest and digest in self._approved_manifest_digests)

    def status(self) -> dict[str, Any]:
        adapters = []
        for item in self.bank.snapshot()["loaded_adapters"]:
            digest = self._adapter_manifest_digests.get(item["adapter_id"])
            adapters.append({
                **item,
                "manifest_sha256": digest,
                "admission": "approved" if digest in self._approved_manifest_digests else "quarantine",
            })
        return {
            "ready": True,
            "backend": "neural-prosthesis",
            "model": self.model_id,
            "revision": self.model_revision,
            "device": str(self.device),
            "layer_path": self.layer_path,
            "loaded_adapters": adapters,
            "default_adapter": self.default_adapter,
            "layer_force": (
                {
                    **self.layer_force.snapshot(),
                    "enabled": bool(self.default_layer_force_profile),
                    "default_profile": self.default_layer_force_profile,
                }
                if self.layer_force is not None
                else {
                    "enabled": False,
                    "default_profile": None,
                    "loaded_profiles": [],
                    "registered_hook_count": 0,
                    "applied_hook_calls": 0,
                    "applied_token_count": 0,
                    "precision_fallback_tokens": 0,
                }
            ),
            "max_context_tokens": self.max_context_tokens,
            "remote_model_downloads": False,
        }

    def complete(self, request: dict[str, Any]) -> dict[str, Any]:
        messages = request.get("messages")
        if not isinstance(messages, list) or not 1 <= len(messages) <= MAX_MESSAGES:
            raise RequestError(400, "messages-invalid")
        normalized = []
        for message in messages:
            if not isinstance(message, dict) or message.get("role") not in ("system", "user", "assistant"):
                raise RequestError(400, "message-role-invalid")
            content = message.get("content")
            if not isinstance(content, str) or not content.strip() or len(content) > MAX_MESSAGE_CHARS:
                raise RequestError(400, "message-content-invalid")
            normalized.append({"role": message["role"], "content": content})
        requested_model = request.get("model")
        if requested_model and str(requested_model) != self.model_id:
            raise RequestError(404, "model-not-loaded")
        adapter_id = request.get("adapter_id", self.default_adapter)
        if adapter_id is not None:
            if not isinstance(adapter_id, str) or adapter_id not in self._adapter_manifest_digests:
                raise RequestError(404, "adapter-not-loaded")
            if not self._is_approved(adapter_id):
                raise RequestError(403, "adapter-quarantined")
        max_tokens = request.get("max_tokens", 512)
        temperature = request.get("temperature", 0.7)
        max_tokens = _output_token_limit(max_tokens, self.max_context_tokens)
        if isinstance(temperature, bool) or not isinstance(temperature, (int, float)) or not math.isfinite(float(temperature)) or not 0 <= float(temperature) <= 2:
            raise RequestError(400, "temperature-out-of-range")
        stream = request.get("stream", False)
        if stream is not False:
            raise RequestError(400, "streaming-not-supported")

        try:
            prompt = self.tokenizer.apply_chat_template(
                normalized,
                tokenize=False,
                add_generation_prompt=True,
            )
        except Exception:
            prompt = "\n".join(f"{item['role']}: {item['content']}" for item in normalized) + "\nassistant:"
        input_limit = max(1, self.max_context_tokens - max_tokens)
        encoded = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=input_limit,
        )
        input_ids = encoded["input_ids"].to(self.device)
        attention_mask = encoded.get("attention_mask")
        if attention_mask is not None:
            attention_mask = attention_mask.to(self.device)
        do_sample = float(temperature) > 0
        generation_kwargs: dict[str, Any] = {
            "max_new_tokens": max_tokens,
            "do_sample": do_sample,
            "pad_token_id": self.tokenizer.pad_token_id,
            "use_cache": True,
        }
        if do_sample:
            generation_kwargs["temperature"] = max(0.01, float(temperature))
            generation_kwargs["top_p"] = 0.9
        if attention_mask is not None:
            generation_kwargs["attention_mask"] = attention_mask

        steering_context = (
            self.layer_force.activate(self.default_layer_force_profile)
            if self.layer_force is not None and self.default_layer_force_profile is not None
            else nullcontext()
        )
        with self._generation_lock, torch.inference_mode():
            with self.bank.activate(adapter_id), steering_context:
                generated = self.model.generate(input_ids=input_ids, **generation_kwargs)
        completion_tokens = generated[0, input_ids.shape[-1]:]
        generated_token_count = int(completion_tokens.shape[-1])
        finish_reason = "length" if generated_token_count >= max_tokens else "stop"
        text = self.tokenizer.decode(completion_tokens, skip_special_tokens=True).strip()
        if not text:
            raise RequestError(503, "empty-model-response")
        return {
            "id": "neural-prosthesis-local",
            "object": "chat.completion",
            "model": self.model_id,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": finish_reason}],
            "usage": {
                "prompt_tokens": int(input_ids.shape[-1]),
                "completion_tokens": generated_token_count,
                "total_tokens": int(input_ids.shape[-1]) + generated_token_count,
            },
        }

    def close(self) -> None:
        self.bank.close()
        if self.layer_force is not None:
            self.layer_force.close()


def _send_json(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("content-length", str(len(body)))
    handler.send_header("cache-control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def create_handler(runtime: TransformersRuntime):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def _host_allowed(self) -> bool:
            try:
                host = urlparse("//" + str(self.headers.get("host", ""))).hostname
            except Exception:
                return False
            return host in ("127.0.0.1", "localhost")

        def _authorized(self) -> bool:
            expected = getattr(runtime, "api_token", None)
            if not expected:
                return True
            supplied = str(self.headers.get("authorization", ""))
            return hmac.compare_digest(supplied, "Bearer " + expected)

        def log_message(self, _format: str, *args: Any) -> None:
            # Never log message contents, prompts, completions, or adapter weights.
            return

        def do_GET(self) -> None:
            if not self._host_allowed():
                _send_json(self, 403, {"error": "host-not-allowed"})
                return
            path = urlparse(self.path).path
            if path in ("/health", "/api/health"):
                _send_json(self, 200, {"ready": True, "backend": "neural-prosthesis"})
            elif path == "/neural-prosthesis/status":
                if not self._authorized():
                    _send_json(self, 401, {"error": "unauthorized"})
                    return
                _send_json(self, 200, runtime.status())
            else:
                _send_json(self, 404, {"error": "not-found"})

        def do_POST(self) -> None:
            if not self._host_allowed():
                _send_json(self, 403, {"error": "host-not-allowed"})
                return
            if not self._authorized():
                _send_json(self, 401, {"error": "unauthorized"})
                return
            if urlparse(self.path).path != "/v1/chat/completions":
                _send_json(self, 404, {"error": "not-found"})
                return
            if self.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
                _send_json(self, 415, {"error": "application-json-required"})
                return
            try:
                length = int(self.headers.get("content-length", "0"))
            except ValueError:
                _send_json(self, 400, {"error": "content-length-invalid"})
                return
            if length <= 0 or length > MAX_REQUEST_BYTES:
                _send_json(self, 413, {"error": "request-too-large"})
                return
            try:
                raw = self.rfile.read(length)
                payload = json.loads(raw.decode("utf-8"))
                if not isinstance(payload, dict):
                    raise RequestError(400, "request-object-required")
                response = runtime.complete(payload)
                _send_json(self, 200, response)
            except RequestError as error:
                _send_json(self, error.status, {"error": error.code})
            except (UnicodeDecodeError, json.JSONDecodeError):
                _send_json(self, 400, {"error": "invalid-json"})
            except Exception:
                _send_json(self, 503, {"error": "inference-failed"})
    return Handler


def main() -> None:
    host = str(os.environ.get("NEURO_NP_HOST", "127.0.0.1")).strip().lower()
    if host not in ("127.0.0.1", "localhost"):
        raise RuntimeError("Neural Prosthesis HTTP service must bind to 127.0.0.1 or localhost")
    port = int(os.environ.get("NEURO_NP_PORT", "8091"))
    if not 1 <= port <= 65535:
        raise RuntimeError("NEURO_NP_PORT-out-of-range")
    runtime = TransformersRuntime()
    server = ThreadingHTTPServer((host, port), create_handler(runtime))
    server.daemon_threads = True
    print(f"NEURAL_PROSTHESIS_READY http://{host}:{port} model={runtime.model_id} device={runtime.device}")
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()
        server.server_close()
        runtime.close()


if __name__ == "__main__":
    main()
