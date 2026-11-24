from __future__ import annotations

"""Canonical skill-retrieval facade backed by the verified v2 implementation."""

from .neural_skill_retrieval_v2 import NeuralSkillRetrievalV2, RetrievalResultV2

NeuralSkillRetrieval = NeuralSkillRetrievalV2
RetrievalResult = RetrievalResultV2

__all__ = ["NeuralSkillRetrieval", "RetrievalResult", "NeuralSkillRetrievalV2", "RetrievalResultV2"]
