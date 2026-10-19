from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Iterable, Iterator, Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from .core import CurrentConfig, NeuroCoreCurrent


@dataclass(frozen=True)
class ByteTextConfig:
    """Configuration for the raw UTF-8 byte language interface."""

    vocab_size: int = 256
    bos_index: int = 256
    embedding_dim: int = 9
    role_dim: int = 8
    max_context_bytes: int = 4096

    def __post_init__(self) -> None:
        if self.vocab_size != 256:
            raise ValueError("ByteTextConfig currently requires the closed UTF-8 byte vocabulary of size 256")
        if self.bos_index != 256:
            raise ValueError("bos_index must be 256 for the reserved BOS embedding")
        if self.embedding_dim != 9:
            raise ValueError("embedding_dim must match NeuroCore raw_observation_dim=9")
        if self.role_dim != 8:
            raise ValueError("role_dim must match NeuroCore goal_dim=8")
        if self.max_context_bytes <= 0:
            raise ValueError("max_context_bytes must be positive")

    def as_dict(self) -> dict[str, int]:
        return asdict(self)


class UTF8ByteCodec:
    """Closed tokenizer-free UTF-8 byte codec.

    Every valid Python string maps to bytes in [0,255], and decoding is performed only after
    reconstructing a complete byte stream. Invalid byte streams are rejected instead of silently
    replacing data, which keeps the language interface honest about byte fidelity.
    """

    vocab_size = 256
    bos_index = 256

    @staticmethod
    def encode(text: str) -> list[int]:
        if not isinstance(text, str):
            raise TypeError("text must be str")
        return list(text.encode("utf-8"))

    @staticmethod
    def decode(tokens: Iterable[int], *, errors: str = "strict") -> str:
        values = [int(x) for x in tokens]
        if any(x < 0 or x > 255 for x in values):
            raise ValueError("decode accepts only UTF-8 byte values [0,255]")
        return bytes(values).decode("utf-8", errors=errors)

    @staticmethod
    def validate_roundtrip(text: str) -> bool:
        return UTF8ByteCodec.decode(UTF8ByteCodec.encode(text)) == text


class ByteRoleFeatures:
    """Deterministic byte-class features supplied through the Core goal channel.

    The goal channel is not another learned memory. It carries local byte role information:
    whitespace, newline, alphabetic, numeric, punctuation, UTF-8 continuation, control, or other.
    These features are deliberately deterministic so benchmark comparisons do not hide extra
    learned capacity in an auxiliary encoder.
    """

    ROLE_WHITESPACE = 0
    ROLE_NEWLINE = 1
    ROLE_ALPHA = 2
    ROLE_DIGIT = 3
    ROLE_PUNCT = 4
    ROLE_UTF8_CONT = 5
    ROLE_CONTROL = 6
    ROLE_OTHER = 7

    @classmethod
    def role(cls, token: int) -> int:
        b = int(token)
        if b == 10:
            return cls.ROLE_NEWLINE
        if b in (9, 11, 12, 13, 32):
            return cls.ROLE_WHITESPACE
        if 65 <= b <= 90 or 97 <= b <= 122:
            return cls.ROLE_ALPHA
        if 48 <= b <= 57:
            return cls.ROLE_DIGIT
        if b >= 128 and (b & 0xC0) == 0x80:
            return cls.ROLE_UTF8_CONT
        if b < 32 or b == 127:
            return cls.ROLE_CONTROL
        if b in b".,;:!?()[]{}'\"-_/\\@#$%^&*+=<>|`~":
            return cls.ROLE_PUNCT
        return cls.ROLE_OTHER

    @classmethod
    def tensor(cls, tokens: list[int], *, device: torch.device, dtype: torch.dtype) -> Tensor:
        roles = torch.tensor([cls.role(t) for t in tokens], device=device, dtype=torch.long)
        return F.one_hot(roles, num_classes=8).to(dtype=dtype)


class ByteTextEncoder(nn.Module):
    """Small trainable raw-byte front end for NeuroCore.

    It keeps the core observation size fixed at 9 while learning a compact byte embedding. The
    goal channel contains deterministic local role features from ByteRoleFeatures, making the
    semantic interface explicit rather than smuggling in a second model.
    """

    def __init__(self, cfg: ByteTextConfig | None = None) -> None:
        super().__init__()
        self.cfg = cfg or ByteTextConfig()
        self.embedding = nn.Embedding(self.cfg.vocab_size + 1, self.cfg.embedding_dim)
        nn.init.normal_(self.embedding.weight, mean=0.0, std=0.02)

    def forward(self, token_ids: Tensor) -> tuple[Tensor, Tensor]:
        if token_ids.ndim != 2:
            raise ValueError("token_ids must be [B,T]")
        if torch.any(token_ids < 0) or torch.any(token_ids > self.cfg.bos_index):
            raise ValueError("token_ids contain values outside byte/BOS vocabulary")
        obs = self.embedding(token_ids)
        b = token_ids
        bos = b.eq(self.cfg.bos_index)
        role_ids = torch.full_like(b, ByteRoleFeatures.ROLE_OTHER)
        role_ids = torch.where(bos, torch.zeros_like(role_ids), role_ids)
        role_ids = torch.where((b.eq(10) & ~bos), torch.full_like(role_ids, ByteRoleFeatures.ROLE_NEWLINE), role_ids)
        role_ids = torch.where(((b.eq(9) | b.eq(11) | b.eq(12) | b.eq(13) | b.eq(32))) & ~bos, torch.full_like(role_ids, ByteRoleFeatures.ROLE_WHITESPACE), role_ids)
        role_ids = torch.where((((b >= 65) & (b <= 90)) | ((b >= 97) & (b <= 122))) & ~bos, torch.full_like(role_ids, ByteRoleFeatures.ROLE_ALPHA), role_ids)
        role_ids = torch.where((b >= 48) & (b <= 57) & ~bos, torch.full_like(role_ids, ByteRoleFeatures.ROLE_DIGIT), role_ids)
        role_ids = torch.where((b >= 128) & ((b & 0xC0) == 0x80) & ~bos, torch.full_like(role_ids, ByteRoleFeatures.ROLE_UTF8_CONT), role_ids)
        role_ids = torch.where(((b < 32) | b.eq(127)) & ~bos & ~b.eq(10), torch.full_like(role_ids, ByteRoleFeatures.ROLE_CONTROL), role_ids)
        punctuation = torch.zeros_like(b, dtype=torch.bool)
        for value in b".,;:!?()[]{}'\"-_/\\@#$%^&*+=<>|`~":
            punctuation |= b.eq(int(value))
        role_ids = torch.where(punctuation & ~bos, torch.full_like(role_ids, ByteRoleFeatures.ROLE_PUNCT), role_ids)
        goal = F.one_hot(role_ids, num_classes=self.cfg.role_dim).to(dtype=obs.dtype)
        return obs, goal

    def parameter_report(self) -> dict[str, int]:
        return {"embedding_parameters": int(self.embedding.weight.numel())}


class ByteLanguageModel(nn.Module):
    """Tokenizer-free byte language interface wrapped around the canonical NeuroCore trunk."""

    def __init__(self, core: NeuroCoreCurrent | None = None, *, config: ByteTextConfig | None = None) -> None:
        super().__init__()
        self.text_cfg = config or ByteTextConfig()
        self.core = core or NeuroCoreCurrent(CurrentConfig.mobile(9))
        self.encoder = ByteTextEncoder(self.text_cfg)
        self.lm_head = nn.Linear(self.core.cfg.trunk.latent_dim, self.text_cfg.vocab_size)

    @property
    def vocab_size(self) -> int:
        return self.text_cfg.vocab_size

    def encode_text(self, text: str, *, add_bos: bool = False, device: Optional[torch.device] = None) -> Tensor:
        values = UTF8ByteCodec.encode(text)
        if add_bos:
            values = [self.text_cfg.bos_index, *values]
        target_device = device or next(self.parameters()).device
        return torch.tensor(values, device=target_device, dtype=torch.long).unsqueeze(0)

    def logits_from_tokens(self, token_ids: Tensor) -> Tensor:
        obs, goals = self.encoder(token_ids)
        outputs = self.core(obs, goals)
        return self.lm_head(outputs["predictive"])

    def next_byte_loss(self, token_ids: Tensor) -> Tensor:
        if token_ids.ndim != 2 or token_ids.size(1) < 2:
            raise ValueError("next_byte_loss requires [B,T] with T>=2")
        logits = self.logits_from_tokens(token_ids[:, :-1])
        targets = token_ids[:, 1:]
        return F.cross_entropy(logits.reshape(-1, self.vocab_size), targets.reshape(-1))

    @torch.no_grad()
    def next_byte_logits_stream(self, prefix: str) -> Tensor:
        """Run true recurrent streaming decode over a prefix and return logits for its next byte."""
        self.eval()
        token_values = UTF8ByteCodec.encode(prefix)
        if not token_values:
            token_values = [self.text_cfg.bos_index]
        token_ids = torch.tensor(token_values, device=next(self.parameters()).device, dtype=torch.long).unsqueeze(0)
        obs, goals = self.encoder(token_ids)
        trunk = self.core.trunk
        device, dtype = obs.device, obs.dtype
        state = trunk.reset_state(1, device, dtype)
        prev = torch.zeros(1, self.core.cfg.trunk.latent_dim, device=device, dtype=dtype)
        for t in range(obs.size(1)):
            out = trunk.forward_step(obs[:, t], goals[:, t], state, prev)
            state, prev = out["state"], out["latent"]
        return self.lm_head(out["predictive"])

    @torch.no_grad()
    def generate(self, prefix: str, *, max_new_bytes: int = 64, temperature: float = 1.0, greedy: bool = True) -> str:
        if max_new_bytes < 0:
            raise ValueError("max_new_bytes must be >= 0")
        if temperature <= 0:
            raise ValueError("temperature must be > 0")
        generated = UTF8ByteCodec.encode(prefix)
        device = next(self.parameters()).device
        # Preserve a deterministic UTF-8 prefix. We use the real streaming trunk path for each
        # generated byte rather than recomputing the full prefix through forward().
        token_values = generated if generated else [self.text_cfg.bos_index]
        token_ids = torch.tensor(token_values, device=device, dtype=torch.long).unsqueeze(0)
        obs, goals = self.encoder(token_ids)
        trunk = self.core.trunk
        dtype = next(self.parameters()).dtype
        state = trunk.reset_state(1, device, dtype)
        prev = torch.zeros(1, self.core.cfg.trunk.latent_dim, device=device, dtype=dtype)
        last_out = None
        for t in range(obs.size(1)):
            last_out = trunk.forward_step(obs[:, t], goals[:, t], state, prev)
            state, prev = last_out["state"], last_out["latent"]
        import codecs
        decoder = codecs.getincrementaldecoder("utf-8")("strict")
        if generated:
            decoder.decode(bytes(generated), final=False)
        for step_idx in range(max_new_bytes):
            logits = self.lm_head(last_out["predictive"]).squeeze(0)
            probs = torch.softmax(logits / temperature, dim=-1)
            # Constrain generation to byte prefixes that keep the UTF-8 stream valid. On the last
            # generation step also require a complete UTF-8 sequence so the returned string is strict.
            ranked = torch.argsort(probs, descending=True)
            next_byte = None
            current_state = decoder.getstate()
            is_last = step_idx == max_new_bytes - 1
            for candidate in ranked.tolist():
                decoder.setstate(current_state)
                try:
                    decoder.decode(bytes([int(candidate)]), final=is_last)
                    next_byte = int(candidate)
                    break
                except UnicodeDecodeError:
                    continue
            if next_byte is None:
                decoder.setstate(current_state)
                if is_last:
                    # The model predicted an unfinished multibyte prefix; stop early rather than
                    # fabricate a replacement character.
                    break
                raise RuntimeError("no UTF-8-valid next byte candidate")
            generated.append(next_byte)
            token = torch.tensor([[next_byte]], device=device, dtype=torch.long)
            next_obs, next_goal = self.encoder(token)
            last_out = trunk.forward_step(next_obs[:, 0], next_goal[:, 0], state, prev)
            state, prev = last_out["state"], last_out["latent"]
        try:
            UTF8ByteCodec.decode(generated, errors="strict")
        except UnicodeDecodeError as exc:
            raise RuntimeError("generation ended with an incomplete UTF-8 sequence") from exc
        return UTF8ByteCodec.decode(generated, errors="strict")


def causal_text_pairs(text: str, *, context_bytes: int = 256, stride: int | None = None) -> Iterator[tuple[list[int], list[int]]]:
    """Yield overlapping byte-level next-token training pairs from real UTF-8 text."""
    data = UTF8ByteCodec.encode(text)
    if len(data) < 2:
        return
    if context_bytes < 2:
        raise ValueError("context_bytes must be >= 2")
    stride = int(stride or max(1, context_bytes // 2))
    for start in range(0, max(1, len(data) - 1), stride):
        window = data[start : start + context_bytes]
        if len(window) < 2:
            break
        yield window[:-1], window[1:]


def build_byte_language_model(*, seed: int = 141, config: ByteTextConfig | None = None, core: NeuroCoreCurrent | None = None) -> ByteLanguageModel:
    torch.manual_seed(int(seed))
    return ByteLanguageModel(core=core, config=config)


@dataclass
class ByteLanguageStreamCheckpoint:
    """Explicit stream checkpoint for restart-safe byte language inference."""

    version: int
    recurrent_state: Tensor
    prev_latent: Tensor
    runtime_state: dict[str, object]


class ByteLanguageStream:
    """Stateful streaming language wrapper with explicit checkpoint/restore semantics."""

    STATE_VERSION = 1

    def __init__(self, model: ByteLanguageModel) -> None:
        self.model = model
        self.device = next(model.parameters()).device
        self.dtype = next(model.parameters()).dtype
        self.reset()

    @torch.no_grad()
    def reset(self) -> None:
        trunk = self.model.core.trunk
        self.recurrent_state = trunk.reset_state(1, self.device, self.dtype)
        self.prev_latent = torch.zeros(1, self.model.core.cfg.trunk.latent_dim, device=self.device, dtype=self.dtype)
        self.last_predictive = torch.zeros(1, self.model.core.cfg.trunk.latent_dim, device=self.device, dtype=self.dtype)

    @torch.no_grad()
    def prime(self, text: str) -> Tensor:
        token_ids = self.model.encode_text(text)
        obs, goals = self.model.encoder(token_ids)
        trunk = self.model.core.trunk
        self.recurrent_state = trunk.reset_state(1, self.device, self.dtype)
        self.prev_latent = torch.zeros(1, self.model.core.cfg.trunk.latent_dim, device=self.device, dtype=self.dtype)
        self.last_predictive = torch.zeros_like(self.prev_latent)
        for t in range(obs.size(1)):
            out = trunk.forward_step(obs[:, t], goals[:, t], self.recurrent_state, self.prev_latent)
            self.recurrent_state, self.prev_latent = out["state"], out["latent"]
            self.last_predictive = out["predictive"]
        return self.model.lm_head(self.last_predictive)

    @torch.no_grad()
    def step_byte(self, value: int) -> Tensor:
        value = int(value)
        if value < 0 or value > 255:
            raise ValueError("step_byte expects one UTF-8 byte [0,255]")
        token = torch.tensor([[value]], device=self.device, dtype=torch.long)
        obs, goals = self.model.encoder(token)
        out = self.model.core.trunk.forward_step(obs[:, 0], goals[:, 0], self.recurrent_state, self.prev_latent)
        self.recurrent_state, self.prev_latent = out["state"], out["latent"]
        self.last_predictive = out["predictive"]
        return self.model.lm_head(self.last_predictive)

    @torch.no_grad()
    def step_text(self, text: str) -> Tensor:
        values = UTF8ByteCodec.encode(text)
        if not values:
            return self.next_logits()
        result = None
        for value in values:
            result = self.step_byte(value)
        return result if result is not None else self.next_logits()

    @torch.no_grad()
    def next_logits(self) -> Tensor:
        return self.model.lm_head(self.last_predictive)

    @torch.no_grad()
    def checkpoint(self) -> ByteLanguageStreamCheckpoint:
        return ByteLanguageStreamCheckpoint(
            version=self.STATE_VERSION,
            recurrent_state=self.recurrent_state.detach().clone(),
            prev_latent=self.prev_latent.detach().clone(),
            runtime_state=self.model.core.trunk.runtime_state_dict(),
        )

    @torch.no_grad()
    def restore(self, checkpoint: ByteLanguageStreamCheckpoint) -> None:
        if checkpoint.version != self.STATE_VERSION:
            raise ValueError(f"unsupported stream checkpoint version: {checkpoint.version}")
        self.recurrent_state = checkpoint.recurrent_state.to(device=self.device, dtype=self.dtype).clone()
        self.prev_latent = checkpoint.prev_latent.to(device=self.device, dtype=self.dtype).clone()
        self.model.core.trunk.load_runtime_state_dict(checkpoint.runtime_state)
        self.last_predictive = self.prev_latent.clone()
