from __future__ import annotations
from typing import Optional
import torch
import torch.nn as nn

class VisionAdapter(nn.Module):
    """Tiny image-to-latent adapter.

    Input: [B,3,H,W] normalized float tensor. This is intentionally small and
    content-agnostic; it provides the contract for a future trained vision expert.
    """
    def __init__(self, latent_dim: int = 96):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(3, 16, 5, stride=2, padding=2), nn.SiLU(),
            nn.Conv2d(16, 24, 3, stride=2, padding=1), nn.SiLU(),
            nn.AdaptiveAvgPool2d((1, 1)), nn.Flatten(),
            nn.Linear(24, latent_dim), nn.LayerNorm(latent_dim), nn.SiLU(),
        )
    def forward(self, image: torch.Tensor) -> torch.Tensor:
        if image.ndim == 3: image = image.unsqueeze(0)
        return self.net(image.float())

class AudioAdapter(nn.Module):
    """Tiny waveform-to-latent adapter using differentiable log energy features."""
    def __init__(self, latent_dim: int = 96, bins: int = 64):
        super().__init__()
        self.bins = bins
        self.proj = nn.Sequential(nn.Linear(bins, latent_dim), nn.LayerNorm(latent_dim), nn.SiLU(), nn.Linear(latent_dim, latent_dim))
    def forward(self, waveform: torch.Tensor) -> torch.Tensor:
        if waveform.ndim == 1: waveform = waveform.unsqueeze(0)
        x = waveform.float()
        window = torch.hann_window(128, device=x.device, dtype=x.dtype)
        x = torch.stft(x, n_fft=128, hop_length=64, window=window, return_complex=True)
        mag = (x.abs() + 1e-5).log()
        feat = mag.mean(dim=-1)
        feat = nn.functional.interpolate(feat.unsqueeze(1), size=self.bins, mode="linear", align_corners=False).squeeze(1)
        return self.proj(feat)

class ModalityFusion(nn.Module):
    """Maps an arbitrary subset of modality latents into one shared state."""
    def __init__(self, latent_dim: int = 96):
        super().__init__()
        self.gate = nn.Sequential(nn.Linear(latent_dim * 3, latent_dim), nn.Sigmoid())
        self.mix = nn.Linear(latent_dim * 3, latent_dim)
    def forward(self, text: Optional[torch.Tensor] = None,
                vision: Optional[torch.Tensor] = None,
                audio: Optional[torch.Tensor] = None) -> torch.Tensor:
        xs = []
        ref = next(x for x in (text, vision, audio) if x is not None)
        for x in (text, vision, audio):
            if x is None: x = torch.zeros_like(ref)
            xs.append(x)
        cat = torch.cat(xs, dim=-1)
        return self.mix(cat) * self.gate(cat) + ref
