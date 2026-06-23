"""
Pipeline runner — multi-agent orchestration harness for Softmax_τ research.

This is the main entry point that ties together:
  1. Goal decomposition (what to research)
  2. Kanban task management (tracking progress)
  3. Subagent delegation (parallel researchers)
  4. Synthesis (cross-reference and write wiki)
  5. Curation (pattern detection, skill crystallization)

Can be run:
  - Directly: python -m omnigent.pipeline run --goal "..."
  - Via cron: scheduled research/synthesis/curator cycles
  - Via Resonant Command Center: dashboard-triggered orchestration
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from omnigent.orchestrator import (
    Orchestrator,
    ResearchGoal,
    ResearchTask,
    decompose_goal,
    create_synthesis_task,
    RESEARCHER_PROFILE,
    SYNTHESIZER_PROFILE,
    CURATOR_PROFILE,
    TAU_IMPLEMENTER_PROFILE,
    WikiWriter,
)
from omnigent.models.tau_attention import (
    TauAttention,
    TauTransformerBlock,
    HomotopyLoss,
    HopfLoss,
    TorsionComputer,
)


# ── PIPELINE PHASES ──

class PipelinePhase:
    """Base class for pipeline phases."""
    
    def __init__(self, name: str):
        self.name = name
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
        self.status = "pending"
        self.output: Dict[str, Any] = {}
    
    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status,
            "start": self.start_time.isoformat() if self.start_time else None,
            "end": self.end_time.isoformat() if self.end_time else None,
            "output": self.output,
        }


class DecomposePhase(PipelinePhase):
    """Phase 1: Decompose goal into research tasks."""
    
    def __init__(self):
        super().__init__("decompose")
    
    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        self.start_time = datetime.now()
        self.status = "running"
        
        goal: ResearchGoal = context["goal"]
        
        # Decompose into research tasks
        research_tasks = decompose_goal(goal)
        
        # Create synthesis task
        synthesis_task = create_synthesis_task(goal, research_tasks)
        
        self.output = {
            "research_tasks": [t.__dict__ for t in research_tasks],
            "synthesis_task": synthesis_task.__dict__,
            "n_researchers": len(research_tasks),
        }
        self.status = "complete"
        self.end_time = datetime.now()
        
        context["research_tasks"] = research_tasks
        context["synthesis_task"] = synthesis_task
        return context


class KanbanPhase(PipelinePhase):
    """Phase 2: Create kanban board and tasks."""
    
    def __init__(self):
        super().__init__("kanban")
    
    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        self.start_time = datetime.now()
        self.status = "running"
        
        goal: ResearchGoal = context["goal"]
        wiki_page = goal.wiki_page
        
        # Initialize wiki
        wiki = WikiWriter()
        
        # Create wiki page for this research
        wiki.create_page(
            name=wiki_page,
            content=f"# {goal.topic}\n\n## Status: In Progress\n\n*Research started at {datetime.now().isoformat()}*\n",
            template=goal.template,
        )
        
        self.output = {
            "wiki_page": wiki_page,
            "wiki_root": str(wiki.wiki_root),
        }
        self.status = "complete"
        self.end_time = datetime.now()
        
        context["wiki"] = wiki
        return context


class ResearchPhase(PipelinePhase):
    """Phase 3: Dispatch researcher subagents."""
    
    def __init__(self, delegate_fn=None):
        super().__init__("research")
        self.delegate_fn = delegate_fn
    
    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        self.start_time = datetime.now()
        self.status = "running"
        
        tasks: List[ResearchTask] = context["research_tasks"]
        wiki: WikiWriter = context["wiki"]
        
        if not self.delegate_fn:
            self.status = "skipped"
            self.output = {"message": "No delegate_fn — running in local mode"}
            self.end_time = datetime.now()
            return context
        
        # Dispatch each researcher task
        dispatched = []
        for task in tasks:
            # Save task spec for subagent
            task_spec = {
                "id": task.id,
                "title": task.title,
                "goal": task.goal,
                "context": task.context,
                "toolsets": task.toolsets,
            }
            
            # Dispatch via delegate_task
            self.delegate_fn(
                goal=task.goal,
                context=task.context,
                toolsets=task.toolsets,
                background=True,
            )
            
            dispatched.append(task.id)
            wiki._append_log(f"Dispatched researcher: {task.id} — {task.title}")
        
        self.output = {
            "dispatched": dispatched,
            "n_dispatched": len(dispatched),
        }
        self.status = "dispatched"
        self.end_time = datetime.now()
        
        return context


class SynthesisPhase(PipelinePhase):
    """Phase 4: Synthesize researcher outputs into wiki."""
    
    def __init__(self, delegate_fn=None):
        super().__init__("synthesis")
        self.delegate_fn = delegate_fn
    
    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        self.start_time = datetime.now()
        self.status = "running"
        
        goal: ResearchGoal = context["goal"]
        wiki: WikiWriter = context["wiki"]
        research_tasks: List[ResearchTask] = context["research_tasks"]
        synthesis_task: ResearchTask = context["synthesis_task"]
        
        if not self.delegate_fn:
            # Local mode: write a placeholder synthesis
            wiki.append_to_page(
                name=goal.wiki_page,
                section="Synthesis",
                content=f"*Synthesis pending — {len(research_tasks)} researcher tasks dispatched*\n",
            )
            self.status = "pending"
        else:
            # Dispatch synthesizer subagent
            parent_ids = [t.id for t in research_tasks]
            context_str = (
                f"SYNTHESIS TASK: {synthesis_task.id}\n"
                f"PARENT TASKS: {', '.join(parent_ids)}\n"
                f"WIKI PAGE: {goal.wiki_page}\n"
                f"WIKI ROOT: {wiki.wiki_root}\n\n"
                f"Read all researcher outputs and produce a unified synthesis.\n"
            )
            
            self.delegate_fn(
                goal=synthesis_task.goal,
                context=context_str,
                toolsets=SYNTHESIZER_PROFILE.toolsets,
                background=True,
            )
            
            wiki._append_log(f"Dispatched synthesizer: {synthesis_task.id}")
            self.status = "dispatched"
        
        self.output = {
            "synthesis_task_id": synthesis_task.id,
            "parent_ids": [t.id for t in research_tasks],
        }
        self.end_time = datetime.now()
        
        return context


class CuratorPhase(PipelinePhase):
    """Phase 5: Curate — detect patterns, crystallize skills."""
    
    def __init__(self, delegate_fn=None):
        super().__init__("curation")
        self.delegate_fn = delegate_fn
    
    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        self.start_time = datetime.now()
        self.status = "running"
        
        wiki: WikiWriter = context["wiki"]
        goal: ResearchGoal = context["goal"]
        
        if not self.delegate_fn:
            self.status = "skipped"
            self.output = {"message": "No delegate_fn — curation skipped"}
            self.end_time = datetime.now()
            return context
        
        # Dispatch curator
        context_str = (
            f"CURATION TASK for: {goal.topic}\n"
            f"WIKI PAGE: {goal.wiki_page}\n"
            f"WIKI ROOT: {wiki.wiki_root}\n"
            f"TAU REGISTRY: D:/CODEX/Omnigent/extracted_tech_library/tau_registry.py\n\n"
            f"Review the wiki page for:\n"
            f"1. Repeated patterns that could become skills\n"
            f"2. Components that should be added to tau_registry\n"
            f"3. Quality issues or gaps\n"
            f"4. Opportunities for skill crystallization\n"
        )
        
        self.delegate_fn(
            goal=f"Curate research on {goal.topic}",
            context=context_str,
            toolsets=CURATOR_PROFILE.toolsets,
            background=True,
        )
        
        wiki._append_log(f"Dispatched curator for: {goal.topic}")
        
        self.output = {"curator_dispatched": True}
        self.status = "dispatched"
        self.end_time = datetime.now()
        
        return context


# ── MAIN PIPELINE ──

class Pipeline:
    """
    Full research pipeline: Decompose → Kanban → Research → Synthesize → Curate.
    
    Usage:
        pipeline = Pipeline(delegate_fn=my_delegate)
        result = pipeline.run(ResearchGoal(
            topic="Softmax_τ",
            goal="Survey topological attention mechanisms",
            wiki_page="softmax-tau",
            template="survey",
        ))
    """
    
    def __init__(self, delegate_fn=None):
        self.delegate_fn = delegate_fn
        self.phases: List[PipelinePhase] = [
            DecomposePhase(),
            KanbanPhase(),
            ResearchPhase(delegate_fn=delegate_fn),
            SynthesisPhase(delegate_fn=delegate_fn),
            CuratorPhase(delegate_fn=delegate_fn),
        ]
        self.context: Dict[str, Any] = {}
        self.run_id: str = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    def run(self, goal: ResearchGoal) -> Dict[str, Any]:
        """Execute the full pipeline."""
        self.context = {"goal": goal, "run_id": self.run_id}
        
        print(f"\n{'='*60}")
        print(f"  OMNIGENT PIPELINE — Run {self.run_id}")
        print(f"  Goal: {goal.topic}")
        print(f"  Template: {goal.template}")
        print(f"{'='*60}\n")
        
        for phase in self.phases:
            print(f"▶ {phase.name.upper()}")
            try:
                self.context = phase.run(self.context)
                print(f"  ✓ {phase.name}: {phase.status}")
            except Exception as e:
                phase.status = "error"
                phase.output = {"error": str(e)}
                print(f"  ✗ {phase.name}: ERROR — {e}")
                # Continue with next phase
        
        # Save run report
        report = self._generate_report()
        report_path = Path(f"D:/CODEX/Omnigent/reports/pipeline_{self.run_id}.json")
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2, default=str))
        
        print(f"\n{'='*60}")
        print(f"  Pipeline complete — report: {report_path}")
        print(f"{'='*60}\n")
        
        return report
    
    def _generate_report(self) -> Dict[str, Any]:
        """Generate a run report."""
        return {
            "run_id": self.run_id,
            "timestamp": datetime.now().isoformat(),
            "goal": self.context.get("goal", {}).__dict__ if isinstance(self.context.get("goal"), ResearchGoal) else {},
            "phases": [p.to_dict() for p in self.phases],
            "wiki_page": self.context.get("goal", {}).wiki_page if isinstance(self.context.get("goal"), ResearchGoal) else None,
        }


# ── CLI ENTRY POINT ──

def main():
    parser = argparse.ArgumentParser(description="Omnigent Research Pipeline")
    subparsers = parser.add_subparsers(dest="command")
    
    # Run command
    run_parser = subparsers.add_parser("run", help="Run the research pipeline")
    run_parser.add_argument("--topic", required=True, help="Research topic")
    run_parser.add_argument("--goal", default=None, help="Specific goal (defaults to topic)")
    run_parser.add_argument("--wiki-page", default=None, help="Wiki page name")
    run_parser.add_argument("--template", default="survey", choices=["survey", "compare", "implement", "custom"])
    run_parser.add_argument("--item-a", default=None, help="For compare template")
    run_parser.add_argument("--item-b", default=None, help="For compare template")
    run_parser.add_argument("--paper", default=None, help="For implement template")
    run_parser.add_argument("--framework", default="PyTorch", help="For implement template")
    
    # Tau benchmark command
    bench_parser = subparsers.add_parser("bench", help="Benchmark Softmax_τ vs standard attention")
    bench_parser.add_argument("--seq-len", type=int, default=512)
    bench_parser.add_argument("--d-model", type=int, default=256)
    bench_parser.add_argument("--n-heads", type=int, default=8)
    bench_parser.add_argument("--n-classes", type=int, default=4)
    bench_parser.add_argument("--batch-size", type=int, default=4)
    bench_parser.add_argument("--iterations", type=int, default=100)
    
    args = parser.parse_args()
    
    if args.command == "run":
        goal = ResearchGoal(
            topic=args.topic,
            goal=args.goal or f"Research: {args.topic}",
            wiki_page=args.wiki_page or args.topic.lower().replace(" ", "-"),
            template=args.template,
            custom_params={
                k: v for k, v in {
                    "item_a": args.item_a,
                    "item_b": args.item_b,
                    "paper": args.paper,
                    "framework": args.framework,
                }.items() if v is not None
            },
        )
        
        pipeline = Pipeline(delegate_fn=None)  # Local mode for CLI
        result = pipeline.run(goal)
        
    elif args.command == "bench":
        _run_benchmark(args)
    
    else:
        parser.print_help()


def _run_benchmark(args):
    """Benchmark Softmax_τ vs standard softmax attention."""
    import time
    
    print(f"\n{'='*60}")
    print(f"  SOFTMAX_τ BENCHMARK")
    print(f"  seq_len={args.seq_len}, d_model={args.d_model}, n_heads={args.n_heads}")
    print(f"  n_classes={args.n_classes}, batch_size={args.batch_size}")
    print(f"{'='*60}\n")
    
    # Create models
    tau_attn = TauAttention(
        d_model=args.d_model,
        n_heads=args.n_heads,
        n_torsion_classes=args.n_classes,
    )
    
    # Standard attention for comparison
    class StandardAttention(nn.Module):
        def __init__(self, d_model, n_heads):
            super().__init__()
            self.n_heads = n_heads
            self.d_k = d_model // n_heads
            self.W_q = nn.Linear(d_model, d_model, bias=False)
            self.W_k = nn.Linear(d_model, d_model, bias=False)
            self.W_v = nn.Linear(d_model, d_model, bias=False)
            self.W_o = nn.Linear(d_model, d_model, bias=False)
            self.scale = math.sqrt(self.d_k)
        
        def forward(self, x):
            B, S, D = x.shape
            Q = self.W_q(x).view(B, S, self.n_heads, self.d_k).transpose(1, 2)
            K = self.W_k(x).view(B, S, self.n_heads, self.d_k).transpose(1, 2)
            V = self.W_v(x).view(B, S, self.n_heads, self.d_k).transpose(1, 2)
            scores = torch.matmul(Q, K.transpose(-2, -1)) / self.scale
            attn = F.softmax(scores, dim=-1)
            out = torch.matmul(attn, V)
            out = out.transpose(1, 2).contiguous().view(B, S, D)
            return self.W_o(out), {}
    
    std_attn = StandardAttention(args.d_model, args.n_heads)
    
    # Random input
    x = torch.randn(args.batch_size, args.seq_len, args.d_model)
    
    # Warmup
    for _ in range(10):
        tau_attn(x)
        std_attn(x)
    
    # Benchmark TauAttention
    start = time.time()
    for _ in range(args.iterations):
        out, info = tau_attn(x, return_torsion=True)
    tau_time = (time.time() - start) / args.iterations
    
    # Benchmark StandardAttention
    start = time.time()
    for _ in range(args.iterations):
        out, _ = std_attn(x)
    std_time = (time.time() - start) / args.iterations
    
    # Report
    tau_params = sum(p.numel() for p in tau_attn.parameters())
    std_params = sum(p.numel() for p in std_attn.parameters())
    
    print(f"  TauAttention:")
    print(f"    Time:   {tau_time*1000:.2f} ms/iter")
    print(f"    Params: {tau_params:,}")
    print(f"    Classes used: {info.get('class_sizes', 'N/A')}")
    
    print(f"\n  Standard Attention:")
    print(f"    Time:   {std_time*1000:.2f} ms/iter")
    print(f"    Params: {std_params:,}")
    
    print(f"\n  Speedup: {std_time/tau_time:.2f}x")
    print(f"  Overhead: {(tau_time/std_time - 1)*100:.1f}%")
    print()


if __name__ == "__main__":
    main()
