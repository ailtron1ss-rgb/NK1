from __future__ import annotations

"""Stable canonical facade for the V4 joint-learning implementation."""

from .joint_learning_v4 import JointLearningV4, JointTrainV4Result

JointLearning = JointLearningV4
CANONICAL_SOURCE = "joint_learning_v4"
VERSION = "joint-learning-canonical-v1"

__all__ = ["JointLearning", "JointLearningV4", "JointTrainV4Result", "CANONICAL_SOURCE", "VERSION"]
