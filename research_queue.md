# Omnigent Research Queue

This file is the shared state between the Resonant Command Center dashboard
and the orchestration pipeline. The dashboard writes goals here; the pipeline
reads and executes them.

## Format

Each entry is a YAML-like block:

```
- topic: <research topic>
  goal: <specific goal description>
  template: survey | compare | implement | custom
  wiki-page: <wiki-page-name>
  status: pending | in_progress | complete | blocked
  priority: 1-10
  created: <ISO timestamp>
  params:
    item_a: <for compare>
    item_b: <for compare>
    paper: <for implement>
    framework: <for implement>
```

## Active Topics

- topic: "GRPO Distributed Training Optimization"
  goal: "Survey GRPO (Group Relative Policy Optimization) as a communication-efficient alternative to PPO for RLHF. Map the theoretical foundations: U-statistics baseline, group size scaling laws, federated variants (FGRPO). Identify integration points with the Omnigent pipeline."
  template: survey
  wiki-page: "grpo-distributed-training"
  status: complete
  priority: 9
  created: 2026-06-23T15:30:00Z
  completed: 2026-06-23T21:30:00Z
  researchers: dispatched 2026-06-23T21:00:00Z
  wiki: synthesized 2026-06-24

- topic: "DiLoCo vs FetchSGD Communication Efficiency"
  goal: "Compare DiLoCo (inner AdamW + outer Nesterov momentum, 500x comm reduction) against FetchSGD (Count Sketch compression, linear sketch accumulation) for distributed fine-tuning. Determine which is better suited for the Omnigent federated knowledge lattice."
  template: compare
  wiki-page: "diloco-vs-fetchsgd"
  status: complete
  priority: 8
  created: 2026-06-23T15:30:00Z
  completed: 2026-06-23T21:30:00Z
  researchers: dispatched 2026-06-23T21:00:00Z
  wiki: synthesized 2026-06-24
  params:
    item_a: "DiLoCo"
    item_b: "FetchSGD"

- topic: "LoRA-GA Initialization for Knowledge Graph Embeddings"
  goal: "Implement LoRA-GA (Low-Rank Adaptation with Gradient Approximation) initialization using eigenvector alignment of full gradient matrix. Apply to tau_attention module fine-tuning. Measure convergence parity vs full fine-tuning."
  template: implement
  wiki-page: "lora-ga-knowledge-graph"
  status: complete
  priority: 7
  created: 2026-06-23T15:30:00Z
  completed: 2026-06-23T21:30:00Z
  researchers: dispatched 2026-06-23T21:00:00Z
  wiki: synthesized 2026-06-24
  params:
    paper: "LoRA-GA NeurIPS 2024"
    framework: "PyTorch"

- topic: "Softmax_τ Theoretical Bounds Revisited"
  goal: "Re-examine the theoretical complexity claims of Softmax_τ — specifically the O(n·k) complexity via torsion class partitioning. Verify against Chinchilla scaling law parameters. Identify whether the torsion mask provides communication reduction benefits in a distributed (FSDP-QLoRA) setting."
  template: survey
  wiki-page: "softmax-tau-theory"
  status: in_progress
  priority: 6
  created: 2026-06-23T15:30:00Z
  researchers: dispatched 2026-06-24T09:00:00Z

- topic: "Hopf Exceptional Points in Attention Landscapes"
  goal: "Survey the paper 'Hopf Exceptional Points' as a theoretical framework for understanding attention head dynamics. Map the mathematical structure (non-Hermitian degeneracies, exceptional point topology) to practical attention mechanisms in the Omnigent lattice."
  template: survey
  wiki-page: "hopf-exceptional-points-attention"
  status: in_progress
  priority: 5
  created: 2026-06-23T15:30:00Z
  researchers: dispatched 2026-06-24T09:00:00Z

## Completed Topics

<!-- Moved here when done -->
