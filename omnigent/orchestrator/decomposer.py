"""
Goal decomposer — breaks high-level research goals into executable sub-tasks.

Takes a ResearchGoal and produces a list of ResearchTask objects that can
be dispatched to researcher subagents in parallel.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid


@dataclass
class ResearchTask:
    """A single research task to be executed by a subagent."""
    id: str
    title: str
    goal: str
    context: str
    toolsets: List[str] = field(default_factory=lambda: ["web", "terminal", "file"])
    priority: int = 5
    parent_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    status: str = "pending"  # pending, in_progress, complete, blocked
    output_path: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


def decompose_goal(goal: 'ResearchGoal') -> List[ResearchTask]:
    """
    Decompose a high-level research goal into parallel research tasks.
    
    Strategy:
    - Survey goals → 3-5 parallel researcher tasks (different angles)
    - Compare goals → 2 researcher tasks (one per item) + 1 synthesis
    - Implement goals → 1-2 researcher tasks (paper reading) + 1 implementation
    """
    tasks = []
    base_id = str(uuid.uuid4())[:8]
    
    if goal.template == "survey":
        # Survey: multiple researchers cover different angles
        angles = _get_survey_angles(goal)
        for i, angle in enumerate(angles):
            task_id = f"res-{base_id}-{i}"
            tasks.append(ResearchTask(
                id=task_id,
                title=f"Research: {angle['title']}",
                goal=angle['goal'],
                context=f"Topic: {goal.topic}\nGoal: {goal.goal}\nFocus: {angle['focus']}\n\nWiki page: {goal.wiki_page}",
                toolsets=angle.get('toolsets', ["web", "terminal", "file"]),
                priority=goal.priority,
                metadata={"angle": angle['title'], "wiki_page": goal.wiki_page},
            ))
    
    elif goal.template == "compare":
        # Compare: one researcher per item + synthesis
        item_a = goal.custom_params.get("item_a", goal.topic)
        item_b = goal.custom_params.get("item_b", "baseline")
        
        tasks.append(ResearchTask(
            id=f"res-{base_id}-a",
            title=f"Analyze: {item_a}",
            goal=f"Deep analysis of {item_a}: architecture, strengths, weaknesses, benchmarks",
            context=f"Comparison topic: {goal.topic}\nFocus on: {item_a}\n\nWiki page: {goal.wiki_page}",
            toolsets=["web", "terminal", "file"],
            priority=goal.priority,
            metadata={"item": item_a, "wiki_page": goal.wiki_page},
        ))
        
        tasks.append(ResearchTask(
            id=f"res-{base_id}-b",
            title=f"Analyze: {item_b}",
            goal=f"Deep analysis of {item_b}: architecture, strengths, weaknesses, benchmarks",
            context=f"Comparison topic: {goal.topic}\nFocus on: {item_b}\n\nWiki page: {goal.wiki_page}",
            toolsets=["web", "terminal", "file"],
            priority=goal.priority,
            metadata={"item": item_b, "wiki_page": goal.wiki_page},
        ))
    
    elif goal.template == "implement":
        # Implement: paper reading + implementation
        paper = goal.custom_params.get("paper", goal.topic)
        framework = goal.custom_params.get("framework", "PyTorch")
        
        tasks.append(ResearchTask(
            id=f"res-{base_id}-paper",
            title=f"Read: {paper}",
            goal=f"Read and extract key algorithms from {paper}. Identify core equations, architecture diagrams, and implementation details.",
            context=f"Paper: {paper}\nFramework: {framework}\n\nWiki page: {goal.wiki_page}",
            toolsets=["web", "terminal", "file"],
            priority=goal.priority,
            metadata={"paper": paper, "wiki_page": goal.wiki_page},
        ))
        
        tasks.append(ResearchTask(
            id=f"impl-{base_id}-code",
            title=f"Implement: {paper}",
            goal=f"Implement the core algorithm from {paper} in {framework}. Write tests. Benchmark.",
            context=f"Paper: {paper}\nFramework: {framework}\n\nWiki page: {goal.wiki_page}\nRead researcher output from: res-{base_id}-paper",
            toolsets=["terminal", "file", "coding"],
            priority=goal.priority,
            metadata={"paper": paper, "framework": framework, "wiki_page": goal.wiki_page},
        ))
    
    else:
        # Custom: single researcher task
        tasks.append(ResearchTask(
            id=f"res-{base_id}-0",
            title=f"Research: {goal.topic}",
            goal=goal.goal,
            context=f"Topic: {goal.topic}\nGoal: {goal.goal}\n\nWiki page: {goal.wiki_page}",
            toolsets=["web", "terminal", "file"],
            priority=goal.priority,
            metadata={"wiki_page": goal.wiki_page},
        ))
    
    return tasks


def create_synthesis_task(
    goal: 'ResearchGoal',
    researcher_tasks: List[ResearchTask],
) -> ResearchTask:
    """Create a synthesis task that depends on all researcher tasks."""
    base_id = str(uuid.uuid4())[:8]
    parent_ids = [t.id for t in researcher_tasks]
    
    return ResearchTask(
        id=f"syn-{base_id}",
        title=f"Synthesize: {goal.topic}",
        goal=f"Synthesize research findings on {goal.topic} into a unified wiki page",
        context=f"Topic: {goal.topic}\nWiki page: {goal.wiki_page}\n"
                f"Parent tasks: {', '.join(parent_ids)}\n"
                f"Read all researcher outputs and produce a unified synthesis.",
        toolsets=["terminal", "file", "web"],
        priority=goal.priority,
        parent_id=parent_ids[0] if parent_ids else None,
        metadata={
            "parent_ids": parent_ids,
            "wiki_page": goal.wiki_page,
            "template": goal.template,
        },
    )


def _get_survey_angles(goal: 'ResearchGoal') -> List[Dict[str, Any]]:
    """Generate research angles for a survey-type goal."""
    topic = goal.topic
    
    return [
        {
            "title": f"{topic} — Foundations & Theory",
            "goal": f"Research the theoretical foundations of {topic}. Key papers, mathematical formulations, first principles.",
            "focus": "Theory, math, foundational papers",
        },
        {
            "title": f"{topic} — Implementations & Code",
            "goal": f"Find and analyze implementations of {topic}. Open source code, libraries, benchmarks.",
            "focus": "Code, implementations, reproducibility",
        },
        {
            "title": f"{topic} — State of the Art",
            "goal": f"Identify the current state-of-the-art in {topic}. Recent papers (2024-2025), benchmarks, leaderboards.",
            "focus": "Recent advances, SOTA, benchmarks",
        },
        {
            "title": f"{topic} — Applications & Use Cases",
            "goal": f"Document real-world applications of {topic}. Industry use cases, deployed systems, practical considerations.",
            "focus": "Applications, deployments, practical",
        },
    ]
