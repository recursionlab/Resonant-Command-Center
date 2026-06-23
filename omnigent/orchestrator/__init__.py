"""
Omnigent Orchestrator — Multi-agent research pipeline.

Orchestrates: Goal → Decompose → Kanban → Delegate Researchers → Synthesize → Wiki → Curate
"""

from .engine import Orchestrator, ResearchGoal, OrchestrationResult
from .decomposer import ResearchTask, decompose_goal, create_synthesis_task
from .profiles import (
    SubagentProfile,
    RESEARCHER_PROFILE,
    SYNTHESIZER_PROFILE,
    CURATOR_PROFILE,
    TAU_IMPLEMENTER_PROFILE,
    get_profile,
)
from .wiki_writer import WikiWriter

__all__ = [
    "Orchestrator",
    "ResearchGoal",
    "OrchestrationResult",
    "ResearchTask",
    "decompose_goal",
    "create_synthesis_task",
    "SubagentProfile",
    "RESEARCHER_PROFILE",
    "SYNTHESIZER_PROFILE",
    "CURATOR_PROFILE",
    "TAU_IMPLEMENTER_PROFILE",
    "get_profile",
    "WikiWriter",
]
