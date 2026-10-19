from __future__ import annotations
"""Canonical skill-transfer facade backed by the verified V4 implementation."""

from .skill_transfer_v4 import SkillTransferV4, SkillV4

SkillTransfer = SkillTransferV4
Skill = SkillV4
CANONICAL_SOURCE = "skill_transfer_v4"
VERSION = "skill-transfer-canonical-v1"

__all__ = ["SkillTransfer", "Skill", "SkillTransferV4", "SkillV4", "CANONICAL_SOURCE", "VERSION"]
