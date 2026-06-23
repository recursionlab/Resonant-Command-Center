import { describe, it, expect } from 'vitest';
import {
  mergeNodes,
  mergeLinks,
  validateLinks,
  getReachableNodes,
  findIsolatedNodes,
  countByType,
  type GraphNode,
  type GraphLink,
} from '../src/seed';

// ── Test Data ────────────────────────────────────────────────────────────────

const BASE_NODES: GraphNode[] = [
  { id: 'THE MONAD', type: 'Core' },
  { id: 'RCOS', type: 'Framework' },
  { id: 'Monoid', type: 'Structure' },
];

const BASE_LINKS: GraphLink[] = [
  { source: 'THE MONAD', target: 'RCOS', label: 'powers' },
  { source: 'THE MONAD', target: 'Monoid', label: 'is' },
  { source: 'RCOS', target: 'Monoid', label: 'uses' },
];

// ── mergeNodes ───────────────────────────────────────────────────────────────

describe('mergeNodes', () => {
  it('adds all seed nodes when existing is empty', () => {
    const result = mergeNodes([], BASE_NODES);
    expect(result.added).toBe(3);
    expect(result.merged).toHaveLength(3);
  });

  it('adds only new nodes, skipping duplicates', () => {
    const seed: GraphNode[] = [
      { id: 'RCOS', type: 'Framework' },  // duplicate
      { id: 'QRFT', type: 'Framework' },  // new
    ];
    const result = mergeNodes(BASE_NODES, seed);
    expect(result.added).toBe(1);
    expect(result.merged).toHaveLength(4);
    expect(result.merged.find(n => n.id === 'QRFT')).toBeDefined();
  });

  it('returns zero added when all nodes already exist', () => {
    const result = mergeNodes(BASE_NODES, BASE_NODES);
    expect(result.added).toBe(0);
    expect(result.merged).toHaveLength(3);
  });

  it('preserves existing node order', () => {
    const seed: GraphNode[] = [{ id: 'NEW', type: 'Concept' }];
    const result = mergeNodes(BASE_NODES, seed);
    expect(result.merged[0].id).toBe('THE MONAD');
    expect(result.merged[1].id).toBe('RCOS');
    expect(result.merged[2].id).toBe('Monoid');
    expect(result.merged[3].id).toBe('NEW');
  });

  it('handles nodes with same type but different IDs', () => {
    const seed: GraphNode[] = [
      { id: 'QRFT', type: 'Framework' },
      { id: 'OFTM', type: 'Framework' },
    ];
    const result = mergeNodes(BASE_NODES, seed);
    expect(result.added).toBe(2);
    expect(result.merged.filter(n => n.type === 'Framework')).toHaveLength(3);
  });
});

// ── mergeLinks ───────────────────────────────────────────────────────────────

describe('mergeLinks', () => {
  it('adds all seed links when existing is empty', () => {
    const result = mergeLinks([], BASE_LINKS);
    expect(result.added).toBe(3);
    expect(result.merged).toHaveLength(3);
  });

  it('skips duplicate source->target pairs', () => {
    const seed: GraphLink[] = [
      { source: 'THE MONAD', target: 'RCOS', label: 'powers' },  // duplicate
      { source: 'RCOS', target: 'Monoid', label: 'new label' },  // duplicate pair
    ];
    const result = mergeLinks(BASE_LINKS, seed);
    expect(result.added).toBe(0);
    expect(result.merged).toHaveLength(3);
  });

  it('allows same source with different target', () => {
    const seed: GraphLink[] = [
      { source: 'THE MONAD', target: 'QRFT', label: 'extends' },
    ];
    const result = mergeLinks(BASE_LINKS, seed);
    expect(result.added).toBe(1);
    expect(result.merged).toHaveLength(4);
  });

  it('allows same target with different source', () => {
    const seed: GraphLink[] = [
      { source: 'QRFT', target: 'Monoid', label: 'uses' },
    ];
    const result = mergeLinks(BASE_LINKS, seed);
    expect(result.added).toBe(1);
  });

  it('preserves link labels from existing links', () => {
    const seed: GraphLink[] = [
      { source: 'THE MONAD', target: 'RCOS', label: 'different label' },
    ];
    const result = mergeLinks(BASE_LINKS, seed);
    const existing = result.merged.find(
      l => l.source === 'THE MONAD' && l.target === 'RCOS'
    );
    expect(existing?.label).toBe('powers');  // original preserved
  });
});

// ── validateLinks ────────────────────────────────────────────────────────────

describe('validateLinks', () => {
  it('returns empty when all links are valid', () => {
    const orphans = validateLinks(BASE_NODES, BASE_LINKS);
    expect(orphans).toHaveLength(0);
  });

  it('detects links with missing source node', () => {
    const links: GraphLink[] = [
      { source: 'NONEXISTENT', target: 'RCOS', label: 'bad' },
    ];
    const orphans = validateLinks(BASE_NODES, links);
    expect(orphans).toHaveLength(1);
  });

  it('detects links with missing target node', () => {
    const links: GraphLink[] = [
      { source: 'RCOS', target: 'NONEXISTENT', label: 'bad' },
    ];
    const orphans = validateLinks(BASE_NODES, links);
    expect(orphans).toHaveLength(1);
  });

  it('detects both missing source and target', () => {
    const links: GraphLink[] = [
      { source: 'A', target: 'B', label: 'bad' },
    ];
    const orphans = validateLinks(BASE_NODES, links);
    expect(orphans).toHaveLength(1);
  });

  it('handles empty inputs', () => {
    expect(validateLinks([], [])).toHaveLength(0);
    expect(validateLinks(BASE_NODES, [])).toHaveLength(0);
    expect(validateLinks([], BASE_LINKS)).toHaveLength(3);
  });
});

// ── getReachableNodes ────────────────────────────────────────────────────────

describe('getReachableNodes', () => {
  it('returns just the start node when no links exist', () => {
    const reachable = getReachableNodes(BASE_NODES, [], 'THE MONAD');
    expect(reachable.size).toBe(1);
    expect(reachable.has('THE MONAD')).toBe(true);
  });

  it('finds direct neighbors', () => {
    const reachable = getReachableNodes(BASE_NODES, BASE_LINKS, 'THE MONAD');
    expect(reachable.has('THE MONAD')).toBe(true);
    expect(reachable.has('RCOS')).toBe(true);
    expect(reachable.has('Monoid')).toBe(true);
  });

  it('respects maxHops limit', () => {
    const nodes: GraphNode[] = [
      { id: 'A', type: 'Test' },
      { id: 'B', type: 'Test' },
      { id: 'C', type: 'Test' },
      { id: 'D', type: 'Test' },
    ];
    const links: GraphLink[] = [
      { source: 'A', target: 'B', label: 'ab' },
      { source: 'B', target: 'C', label: 'bc' },
      { source: 'C', target: 'D', label: 'cd' },
    ];
    const reachable = getReachableNodes(nodes, links, 'A', 1);
    expect(reachable.has('A')).toBe(true);
    expect(reachable.has('B')).toBe(true);
    expect(reachable.has('C')).toBe(false);
    expect(reachable.has('D')).toBe(false);
  });

  it('handles cycles without infinite looping', () => {
    const nodes: GraphNode[] = [
      { id: 'A', type: 'Test' },
      { id: 'B', type: 'Test' },
    ];
    const links: GraphLink[] = [
      { source: 'A', target: 'B', label: 'ab' },
      { source: 'B', target: 'A', label: 'ba' },
    ];
    const reachable = getReachableNodes(nodes, links, 'A');
    expect(reachable.size).toBe(2);
  });

  it('returns just start node for non-existent startId', () => {
    const reachable = getReachableNodes(BASE_NODES, BASE_LINKS, 'NONEXISTENT');
    expect(reachable.size).toBe(1);
    expect(reachable.has('NONEXISTENT')).toBe(true);
  });
});

// ── findIsolatedNodes ────────────────────────────────────────────────────────

describe('findIsolatedNodes', () => {
  it('returns empty when all nodes are connected', () => {
    const isolated = findIsolatedNodes(BASE_NODES, BASE_LINKS);
    expect(isolated).toHaveLength(0);
  });

  it('finds nodes with no links', () => {
    const nodes: GraphNode[] = [
      ...BASE_NODES,
      { id: 'ORPHAN', type: 'Concept' },
    ];
    const isolated = findIsolatedNodes(nodes, BASE_LINKS);
    expect(isolated).toHaveLength(1);
    expect(isolated[0].id).toBe('ORPHAN');
  });

  it('considers a node connected if it is a link source', () => {
    const nodes: GraphNode[] = [
      { id: 'A', type: 'Test' },
      { id: 'B', type: 'Test' },
    ];
    const links: GraphLink[] = [
      { source: 'A', target: 'B', label: 'ab' },
    ];
    const isolated = findIsolatedNodes(nodes, links);
    expect(isolated).toHaveLength(0);
  });

  it('considers a node connected if it is a link target only', () => {
    const nodes: GraphNode[] = [
      { id: 'A', type: 'Test' },
      { id: 'B', type: 'Test' },
    ];
    const links: GraphLink[] = [
      { source: 'A', target: 'B', label: 'ab' },
    ];
    const isolated = findIsolatedNodes(nodes, links);
    expect(isolated).toHaveLength(0);  // B is a target, so connected
  });

  it('handles empty inputs', () => {
    expect(findIsolatedNodes([], [])).toHaveLength(0);
    expect(findIsolatedNodes(BASE_NODES, [])).toHaveLength(3);
  });
});

// ── countByType ──────────────────────────────────────────────────────────────

describe('countByType', () => {
  it('counts nodes by type correctly', () => {
    const nodes: GraphNode[] = [
      { id: 'A', type: 'Framework' },
      { id: 'B', type: 'Framework' },
      { id: 'C', type: 'Structure' },
      { id: 'D', type: 'Person' },
    ];
    const counts = countByType(nodes);
    expect(counts).toEqual({
      Framework: 2,
      Structure: 1,
      Person: 1,
    });
  });

  it('returns empty object for empty input', () => {
    expect(countByType([])).toEqual({});
  });

  it('handles single type', () => {
    const nodes: GraphNode[] = [
      { id: 'A', type: 'Test' },
      { id: 'B', type: 'Test' },
    ];
    expect(countByType(nodes)).toEqual({ Test: 2 });
  });
});

// ── Integration: Full Seed Pipeline ──────────────────────────────────────────

describe('seed pipeline integration', () => {
  it('merges seed data without duplicates', () => {
    const existingNodes: GraphNode[] = [
      { id: 'THE MONAD', type: 'Core' },
    ];
    const existingLinks: GraphLink[] = [];

    const seedNodes: GraphNode[] = [
      { id: 'THE MONAD', type: 'Core' },  // duplicate
      { id: 'RCOS', type: 'Framework' },  // new
      { id: 'QRFT', type: 'Framework' },  // new
    ];
    const seedLinks: GraphLink[] = [
      { source: 'THE MONAD', target: 'RCOS', label: 'powers' },
      { source: 'RCOS', target: 'QRFT', label: 'extends' },
    ];

    const nodeResult = mergeNodes(existingNodes, seedNodes);
    expect(nodeResult.added).toBe(2);
    expect(nodeResult.merged).toHaveLength(3);

    const linkResult = mergeLinks(existingLinks, seedLinks);
    expect(linkResult.added).toBe(2);
    expect(linkResult.merged).toHaveLength(2);

    // Validate: no orphaned links
    const orphans = validateLinks(nodeResult.merged, linkResult.merged);
    expect(orphans).toHaveLength(0);
  });

  it('detects orphaned links after merge', () => {
    const nodes: GraphNode[] = [{ id: 'A', type: 'Test' }];
    const links: GraphLink[] = [
      { source: 'A', target: 'B', label: 'ab' },  // B doesn't exist
    ];
    const orphans = validateLinks(nodes, links);
    expect(orphans).toHaveLength(1);
  });

  it('full graph connectivity from THE MONAD', () => {
    const nodes: GraphNode[] = [
      { id: 'THE MONAD', type: 'Core' },
      { id: 'RCOS', type: 'Framework' },
      { id: 'QRFT', type: 'Framework' },
      { id: 'Monoid', type: 'Structure' },
      { id: 'ORPHAN', type: 'Concept' },
    ];
    const links: GraphLink[] = [
      { source: 'THE MONAD', target: 'RCOS', label: 'powers' },
      { source: 'THE MONAD', target: 'Monoid', label: 'is' },
      { source: 'RCOS', target: 'QRFT', label: 'extends' },
    ];

    const reachable = getReachableNodes(nodes, links, 'THE MONAD');
    expect(reachable.size).toBe(4);  // MONAD, RCOS, QRFT, Monoid
    expect(reachable.has('ORPHAN')).toBe(false);

    const isolated = findIsolatedNodes(nodes, links);
    expect(isolated).toHaveLength(1);
    expect(isolated[0].id).toBe('ORPHAN');
  });
});
