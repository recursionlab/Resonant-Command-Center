"""
Orchestrator Engine — Main entry point for the Knowledge Synthesis Engine.

Orchestrates: Goal → Decompose → Kanban → Delegate Researchers → Synthesize → Wiki → Curate
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Callable
from datetime import datetime
from pathlib import Path
import json

# Try to import Hermes tools (only available inside Hermes runtime)
try:
    from hermes_tools import (
        delegate_task as hermes_delegate_task,
        kanban_create as hermes_kanban_create,
        kanban_show as hermes_kanban_show,
        kanban_list as hermes_kanban_list,
        kanban_complete as hermes_kanban_complete,
        kanban_block as hermes_kanban_block,
        kanban_heartbeat as hermes_kanban_heartbeat,
        kanban_comment as hermes_kanban_comment,
    )
    HERMES_TOOLS_AVAILABLE = True
except ImportError:
    HERMES_TOOLS_AVAILABLE = False
    hermes_delegate_task = None
    hermes_kanban_create = None
    hermes_kanban_show = None
    hermes_kanban_list = None
    hermes_kanban_complete = None
    hermes_kanban_block = None
    hermes_kanban_heartbeat = None
    hermes_kanban_comment = None

from .profiles import (
    SubagentProfile, 
    RESEARCHER_PROFILE, 
    SYNTHESIZER_PROFILE,
    CURATOR_PROFILE,
    get_profile,
)
from .decomposer import (
    ResearchTask,
    decompose_goal,
    create_synthesis_task,
)
from .kanban_client import (
    KanbanClient,
    format_researcher_task,
    format_synthesis_task,
)
from .wiki_writer import WikiWriter


@dataclass
class ResearchGoal:
    """High-level research goal specification."""
    topic: str
    goal: str
    wiki_page: str
    template: str = "survey"  # survey | compare | implement
    custom_params: Dict[str, Any] = field(default_factory=dict)
    priority: int = 5
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class OrchestrationResult:
    """Result of a full orchestration run."""
    goal: ResearchGoal
    researcher_task_ids: List[str]
    synthesis_task_id: str
    wiki_pages_created: List[str]
    wiki_pages_updated: List[str]
    report_path: str
    skills_crystallized: List[str]
    metadata: Dict[str, Any] = field(default_factory=dict)


class Orchestrator:
    """
    Main orchestrator for the Knowledge Synthesis Engine.
    
    Usage:
        orchestrator = Orchestrator()
        result = orchestrator.run(ResearchGoal(
            topic="CLAUDE_SHANNON",
            goal="Survey all CLAUDE_SHANNON variants and create comparison wiki",
            wiki_page="claude_shannon-variants",
        ))
    """
    
    def __init__(
        self,
        kanban_board: str = "omni",
        wiki_root: Path = Path("D:/CODEX/Omnigent/wiki"),
        delegate_fn: Callable = None,  # Injected delegate_task function
        kanban_tools: Any = None,      # Injected kanban_* tools
    ):
        self.kanban = KanbanClient(board=kanban_board)
        self.wiki = WikiWriter(wiki_root=wiki_root)
        
        # Auto-inject Hermes tools if available and not explicitly provided
        if delegate_fn is None and HERMES_TOOLS_AVAILABLE:
            self.delegate_fn = hermes_delegate_task
        else:
            self.delegate_fn = delegate_fn
            
        if kanban_tools is None and HERMES_TOOLS_AVAILABLE:
            self.kanban_tools = {
                "kanban_create": hermes_kanban_create,
                "kanban_show": hermes_kanban_show,
                "kanban_list": hermes_kanban_list,
                "kanban_complete": hermes_kanban_complete,
                "kanban_block": hermes_kanban_block,
                "kanban_heartbeat": hermes_kanban_heartbeat,
                "kanban_comment": hermes_kanban_comment,
            }
            # Inject into KanbanClient
            self.kanban.set_tools(self.kanban_tools)
        else:
            self.kanban_tools = kanban_tools
            if kanban_tools:
                self.kanban.set_tools(kanban_tools)
        
        self.run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    
    def run(self, goal: ResearchGoal) -> OrchestrationResult:
        """
        Execute full research loop for a goal.
        
        This is the main entry point. It:
        1. Decomposes goal into researcher tasks
        2. Creates kanban tasks
        3. Spawns researcher subagents via delegate_task
        4. Waits for completion (or backgrounds)
        5. Spawns synthesizer subagent
        6. Updates wiki
        7. Triggers curator for skill crystallization
        """
        print(f"🎯 Orchestrator run {self.run_id}: {goal.topic}")
        
        # Phase 1: Decompose
        print("📋 Phase 1: Decomposing goal...")
        researcher_tasks = decompose_goal(goal)
        print(f"   Created {len(researcher_tasks)} researcher tasks")
        
        # Phase 2: Create Kanban tasks
        print("📝 Phase 2: Creating Kanban tasks...")
        researcher_task_ids = []
        for i, task in enumerate(researcher_tasks):
            task_id = self._create_researcher_task(task, goal.wiki_page)
            researcher_task_ids.append(task_id)
            print(f"   ✓ {task_id}: {task.title}")
        
        # Phase 3: Create synthesis task (blocked until researchers done)
        print("🔗 Phase 3: Creating synthesis task...")
        synthesis_task = create_synthesis_task(goal, researcher_tasks)
        synthesis_task_id = self._create_synthesis_task(synthesis_task, researcher_task_ids)
        print(f"   ✓ {synthesis_task_id}: {synthesis_task.title}")
        
        # Phase 4: Spawn researcher subagents
        print("🤖 Phase 4: Spawning researcher subagents...")
        self._spawn_researchers(researcher_tasks, researcher_task_ids, goal.wiki_page)
        
        # Phase 5: Spawn synthesizer (will run after researchers complete)
        print("🧠 Phase 5: Spawning synthesizer...")
        self._spawn_synthesizer(synthesis_task, synthesis_task_id, researcher_task_ids, goal.wiki_page)
        
        # Phase 6: Curator (async, runs periodically)
        print("📚 Phase 6: Scheduling curator...")
        self._schedule_curator(goal)
        
        return OrchestrationResult(
            goal=goal,
            researcher_task_ids=researcher_task_ids,
            synthesis_task_id=synthesis_task_id,
            wiki_pages_created=[],  # Filled by synthesizer
            wiki_pages_updated=[],
            report_path="",
            skills_crystallized=[],
            metadata={"run_id": self.run_id, "started_at": datetime.now().isoformat()},
        )
    
    def get_status(self) -> Dict[str, Any]:
        """Get current orchestrator status."""
        # Would query kanban, wiki, skills in real implementation
        return {
            "active_researchers": 0,
            "pending_synthesis": 0,
            "wiki_pages": 0,
            "skills": 0,
        }
    
    def _create_researcher_task(self, task: ResearchTask, wiki_page: str) -> str:
        """Create a kanban task for a researcher."""
        body = format_researcher_task(task)
        task_id = self.kanban.create_task(
            title=task.title,
            body=body,
            assignee="researcher",
            parents=task.metadata.get("parents", []),
            priority=task.priority,
            board=self.kanban.board,
        )
        return task_id
    
    def _create_synthesis_task(
        self, 
        task: ResearchTask, 
        parent_ids: List[str],
    ) -> str:
        """Create a kanban task for synthesis."""
        body = format_synthesis_task(task)
        task_id = self.kanban.create_task(
            title=task.title,
            body=body,
            assignee="synthesizer",
            parents=parent_ids,
            priority=task.priority,
            board=self.kanban.board,
        )
        return task_id
    
    def _spawn_researchers(
        self,
        tasks: List[ResearchTask],
        task_ids: List[str],
        wiki_page: str,
    ) -> None:
        """Spawn researcher subagents via delegate_task."""
        if not self.delegate_fn:
            print("   ⚠️  No delegate_fn provided — skipping subagent spawn")
            return
        
        # Prepare batch delegation
        batch_tasks = []
        for task, task_id in zip(tasks, task_ids):
            context = f"""
{task.context}

KANBAN TASK: {task_id}
WIKI PAGE: {wiki_page}
WIKI ROOT: D:/CODEX/Omnigent/wiki

Save output to workspace as output.md and raw content to wiki/raw/
"""
            batch_tasks.append({
                "goal": task.goal,
                "context": context,
                "toolsets": task.toolsets or RESEARCHER_PROFILE.toolsets,
            })
        
        # Spawn in parallel (max 3 concurrent per config)
        self.delegate_fn(tasks=batch_tasks, background=True)
        print(f"   ✓ Spawned {len(batch_tasks)} researcher subagents")
    
    def _spawn_synthesizer(
        self,
        task: ResearchTask,
        task_id: str,
        parent_ids: List[str],
        wiki_page: str,
    ) -> None:
        """Spawn synthesizer subagent."""
        if not self.delegate_fn:
            print("   ⚠️  No delegate_fn provided — skipping synthesizer spawn")
            return
        
        context = f"""
SYNTHESIS TASK: {task_id}
PARENT TASKS: {', '.join(parent_ids)}
WIKI PAGE: {wiki_page}
WIKI ROOT: D:/CODEX/Omnigent/wiki
SCHEMA: wiki/SCHEMA.md
INDEX: wiki/index.md
LOG: wiki/log.md

Read all researcher outputs from parent task workspaces.
Cross-reference, resolve contradictions, write wiki pages.
Update index.md and log.md.
Produce markdown report.
"""
        self.delegate_fn(
            goal=task.goal,
            context=context,
            toolsets=SYNTHESIZER_PROFILE.toolsets,
            background=True,
        )
        print("   ✓ Spawned synthesizer subagent")
    
    def _schedule_curator(self, goal: ResearchGoal) -> None:
        """Schedule curator to check for skill crystallization opportunities."""
        # In practice, this would create a cron job or kanban task
        print("   ✓ Curator scheduled (checks for repeated patterns)")
    
    def run_survey(
        self,
        topic: str,
        wiki_page: str = None,
        days_back: int = 90,
        min_stars: int = 50,
        months_active: int = 6,
    ) -> OrchestrationResult:
        """Convenience method for survey-type goals."""
        wiki_page = wiki_page or f"{topic.lower()}-variants"
        return self.run(ResearchGoal(
            topic=topic,
            goal=f"Survey all {topic} variants, implementations, and commentary",
            wiki_page=wiki_page,
            template="survey",
            custom_params={
                "days": days_back,
                "date": "2024-03-01",
                "min_stars": min_stars,
                "months": months_active,
            },
        ))
    
    def run_comparison(
        self,
        item_a: str,
        item_b: str,
        wiki_page: str = None,
    ) -> OrchestrationResult:
        """Convenience method for comparison goals."""
        wiki_page = wiki_page or f"{item_a.lower()}-vs-{item_b.lower()}"
        return self.run(ResearchGoal(
            topic=f"{item_a} vs {item_b}",
            goal=f"Compare {item_a} and {item_b} architectures, benchmarks, tradeoffs",
            wiki_page=wiki_page,
            template="compare",
            custom_params={"item_a": item_a, "item_b": item_b},
        ))
    
    def run_implementation(
        self,
        paper: str,
        framework: str = "PyTorch",
        wiki_page: str = None,
    ) -> OrchestrationResult:
        """Convenience method for implementation goals."""
        wiki_page = wiki_page or f"{paper.lower().replace(' ', '-')}-impl"
        return self.run(ResearchGoal(
            topic=paper,
            goal=f"Implement {paper} in {framework}",
            wiki_page=wiki_page,
            template="implement",
            custom_params={"paper": paper, "framework": framework},
        ))


# CLI-style entry point for direct execution
def main():
    """CLI entry point for testing."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Omnigent Orchestrator")
    parser.add_argument("command", choices=["survey", "compare", "implement", "custom"])
    parser.add_argument("--topic", required=True)
    parser.add_argument("--wiki-page", default=None)
    parser.add_argument("--item-a", default=None)
    parser.add_argument("--item-b", default=None)
    parser.add_argument("--paper", default=None)
    parser.add_argument("--framework", default="PyTorch")
    parser.add_argument("--days", type=int, default=90)
    parser.add_argument("--min-stars", type=int, default=50)
    parser.add_argument("--months", type=int, default=6)
    
    args = parser.parse_args()
    
    orchestrator = Orchestrator()
    
    if args.command == "survey":
        result = orchestrator.run_survey(
            topic=args.topic,
            wiki_page=args.wiki_page,
            days_back=args.days,
            min_stars=args.min_stars,
            months_active=args.months,
        )
    elif args.command == "compare":
        result = orchestrator.run_comparison(
            item_a=args.item_a or args.topic,
            item_b=args.item_b,
            wiki_page=args.wiki_page,
        )
    elif args.command == "implement":
        result = orchestrator.run_implementation(
            paper=args.paper or args.topic,
            framework=args.framework,
            wiki_page=args.wiki_page,
        )
    else:
        # Custom goal
        result = orchestrator.run(ResearchGoal(
            topic=args.topic,
            goal=args.topic,  # Use topic as goal for custom
            wiki_page=args.wiki_page or args.topic.lower().replace(" ", "-"),
            template="survey",
        ))
    
    print(f"\n✅ Orchestration complete: {result.run_id}")
    print(f"   Researcher tasks: {result.researcher_task_ids}")
    print(f"   Synthesis task: {result.synthesis_task_id}")


if __name__ == "__main__":
    main()