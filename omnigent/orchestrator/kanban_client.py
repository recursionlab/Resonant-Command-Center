"""
Kanban Client — Interface to Hermes Kanban board for task management.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from .decomposer import ResearchTask


@dataclass
class KanbanTask:
    """Kanban task representation."""
    id: str
    title: str
    body: str
    assignee: str
    status: str = "todo"
    parents: List[str] = None
    priority: int = 0
    metadata: Dict[str, Any] = None


class KanbanClient:
    """Client for interacting with Hermes Kanban board."""
    
    def __init__(self, board: str = "omni"):
        self.board = board
        # In real implementation, these would be injected kanban_* tools
        self.kanban_create = None
        self.kanban_show = None
        self.kanban_list = None
        self.kanban_complete = None
        self.kanban_block = None
        self.kanban_heartbeat = None
        self.kanban_comment = None
    
    def set_tools(self, tools: Dict[str, Any]):
        """Inject kanban tool functions."""
        self.kanban_create = tools.get("kanban_create")
        self.kanban_show = tools.get("kanban_show")
        self.kanban_list = tools.get("kanban_list")
        self.kanban_complete = tools.get("kanban_complete")
        self.kanban_block = tools.get("kanban_block")
        self.kanban_heartbeat = tools.get("kanban_heartbeat")
        self.kanban_comment = tools.get("kanban_comment")
    
    def create_task(
        self,
        title: str,
        body: str,
        assignee: str,
        parents: List[str] = None,
        priority: int = 0,
        **kwargs,
    ) -> str:
        """Create a kanban task. Returns task ID."""
        if not self.kanban_create:
            # Mock for testing
            import uuid
            return f"t_{uuid.uuid4().hex[:8]}"
        
        result = self.kanban_create(
            title=title,
            body=body,
            assignee=assignee,
            parents=parents or [],
            priority=priority,
            **kwargs,
        )
        return result.get("id", "")
    
    def get_task(self, task_id: str) -> Dict:
        """Get full task state."""
        if not self.kanban_show:
            return {}
        return self.kanban_show(task_id=task_id, board=self.board)
    
    def list_tasks(self, **filters) -> List[Dict]:
        """List tasks with filters."""
        if not self.kanban_list:
            return []
        return self.kanban_list(board=self.board, **filters)
    
    def complete_task(
        self,
        task_id: str,
        summary: str,
        metadata: Dict = None,
        artifacts: List[str] = None,
    ) -> None:
        """Mark task complete with handoff."""
        if not self.kanban_complete:
            return
        self.kanban_complete(
            task_id=task_id,
            summary=summary,
            metadata=metadata or {},
            artifacts=artifacts or [],
            board=self.board,
        )
    
    def block_task(self, task_id: str, reason: str) -> None:
        """Block task awaiting human input."""
        if not self.kanban_block:
            return
        self.kanban_block(task_id=task_id, reason=reason, board=self.board)
    
    def comment(self, task_id: str, body: str) -> None:
        """Add comment to task."""
        if not self.kanban_comment:
            return
        self.kanban_comment(task_id=task_id, body=body, board=self.board)
    
    def heartbeat(self, task_id: str, note: str = "") -> None:
        """Send heartbeat for long-running task."""
        if not self.kanban_heartbeat:
            return
        self.kanban_heartbeat(task_id=task_id, note=note, board=self.board)


def format_researcher_task(task: ResearchTask) -> str:
    """Format a ResearchTask as kanban task body."""
    return f"""## Task: {task.title}
**Priority:** {'high' if task.priority > 5 else 'medium' if task.priority > 0 else 'low'}
**Goal:** {task.goal}
**Context:** {task.context}
**Toolsets:** {', '.join(task.toolsets) if task.toolsets else 'default'}
**Status:** {task.status}
"""


def format_synthesis_task(task: ResearchTask) -> str:
    """Format a synthesis task as kanban task body."""
    return f"""## Task: {task.title}
**Type:** synthesis
**Priority:** high
**Goal:** {task.goal}
**Context:** {task.context}
**Parent Tasks:** {', '.join(task.metadata.get('parent_ids', []))}
**Wiki Page:** {task.metadata.get('wiki_page', 'TBD')}
**Toolsets:** {', '.join(task.toolsets) if task.toolsets else 'terminal,file,web'}
"""


from .profiles import SYNTHESIZER_PROFILE