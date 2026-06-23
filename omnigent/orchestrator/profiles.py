"""
Subagent profiles for the Omnigent orchestration system.

Each profile defines the toolsets, model preferences, and behavioral
instructions for a specific agent role in the research pipeline.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class SubagentProfile:
    """Configuration for a subagent role."""
    name: str
    toolsets: List[str]
    model: Optional[str] = None
    description: str = ""
    max_concurrent: int = 3
    instructions: str = ""


# ── RESEARCHER — Discovers, reads, extracts, analyzes ──
RESEARCHER_PROFILE = SubagentProfile(
    name="researcher",
    toolsets=["web", "terminal", "file", "browser"],
    description="Research agent: searches papers, reads code, extracts data, writes findings to wiki",
    max_concurrent=3,
    instructions="""You are a RESEARCHER agent. Your job:
1. Search for and read papers, code, documentation related to your assigned topic
2. Extract key findings, architectures, algorithms, benchmarks
3. Write structured findings to the assigned wiki page
4. Save raw sources to wiki/raw/
5. Update the kanban task with progress
6. Be thorough — read full papers, not just abstracts
7. Cross-reference with existing wiki content to avoid duplication
""",
)

# ── SYNTHESIZER — Cross-references, resolves contradictions, writes ──
SYNTHESIZER_PROFILE = SubagentProfile(
    name="synthesizer",
    toolsets=["terminal", "file", "web"],
    description="Synthesis agent: reads researcher outputs, resolves contradictions, writes unified wiki pages",
    max_concurrent=1,
    instructions="""You are a SYNTHESIZER agent. Your job:
1. Read all researcher outputs from parent task workspaces
2. Cross-reference findings, resolve contradictions
3. Write unified, well-structured wiki pages
4. Update wiki/index.md and wiki/log.md
5. Produce a markdown report summarizing the synthesis
6. Identify gaps that need further research
7. Maintain academic rigor — cite sources, note uncertainties
""",
)

# ── CURATOR — Pattern detection, skill crystallization ──
CURATOR_PROFILE = SubagentProfile(
    name="curator",
    toolsets=["terminal", "file", "skills"],
    description="Curator agent: detects repeated patterns, crystallizes skills, maintains quality",
    max_concurrent=1,
    instructions="""You are a CURATOR agent. Your job:
1. Review completed research for repeated patterns
2. Crystallize reusable approaches into skills
3. Update skill files in D:/Hermes/skills/
4. Maintain quality standards across the wiki
5. Identify architectural improvements
6. Keep the tau_registry.py index up to date
""",
)

# ── TAU_IMPLEMENTER — Implements Softmax_τ variants ──
TAU_IMPLEMENTER_PROFILE = SubagentProfile(
    name="tau_implementer",
    toolsets=["terminal", "file", "coding"],
    description="Implementation agent: builds and tests Softmax_τ attention variants",
    max_concurrent=2,
    instructions="""You are a TAU IMPLEMENTER agent. Your job:
1. Implement Softmax_τ attention mechanisms based on the theoretical framework
2. Write tests for each component (torsion computation, homotopy loss, Hopf loss)
3. Benchmark against standard attention
4. Document the implementation in the wiki
5. Follow TDD discipline: write failing tests first, then implement
6. Use the tau_registry.py to find existing components to build on
""",
)


def get_profile(name: str) -> SubagentProfile:
    """Get a profile by name."""
    profiles = {
        "researcher": RESEARCHER_PROFILE,
        "synthesizer": SYNTHESIZER_PROFILE,
        "curator": CURATOR_PROFILE,
        "tau_implementer": TAU_IMPLEMENTER_PROFILE,
    }
    return profiles.get(name, RESEARCHER_PROFILE)
