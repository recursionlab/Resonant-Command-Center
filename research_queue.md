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

<!-- Topics go here -->

## Completed Topics

<!-- Moved here when done -->
