/**
 * Omnigent Research Library — Seed Data & Graph Utilities
 * Pure functions for graph deduplication and seed data validation.
 */

export interface GraphNode {
  id: string;
  type: string;
  description?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  label: string;
}

/**
 * Merge seed nodes into an existing graph, avoiding duplicates.
 */
export function mergeNodes(
  existing: GraphNode[],
  seed: GraphNode[]
): { merged: GraphNode[]; added: number } {
  const existingIds = new Set(existing.map(n => n.id));
  const merged = [...existing];
  let added = 0;
  for (const node of seed) {
    if (!existingIds.has(node.id)) {
      merged.push({ id: node.id, type: node.type });
      existingIds.add(node.id);
      added++;
    }
  }
  return { merged, added };
}

/**
 * Merge seed links, avoiding duplicate source->target pairs.
 */
export function mergeLinks(
  existing: GraphLink[],
  seed: GraphLink[]
): { merged: GraphLink[]; added: number } {
  const existingKeys = new Set(existing.map(l => `${l.source}->${l.target}`));
  const merged = [...existing];
  let added = 0;
  for (const link of seed) {
    const key = `${link.source}->${link.target}`;
    if (!existingKeys.has(key)) {
      merged.push({ source: link.source, target: link.target, label: link.label });
      existingKeys.add(key);
      added++;
    }
  }
  return { merged, added };
}

/**
 * Validate that all link endpoints reference existing nodes.
 */
export function validateLinks(nodes: GraphNode[], links: GraphLink[]): GraphLink[] {
  const nodeIds = new Set(nodes.map(n => n.id));
  return links.filter(l => !nodeIds.has(l.source) || !nodeIds.has(l.target));
}

/**
 * Get all nodes reachable from a given node within N hops (BFS).
 */
export function getReachableNodes(
  nodes: GraphNode[],
  links: GraphLink[],
  startId: string,
  maxHops: number = 10
): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const link of links) {
    const src = adjacency.get(link.source) || [];
    src.push(link.target);
    adjacency.set(link.source, src);
  }
  const visited = new Set<string>([startId]);
  const queue: Array<[string, number]> = [[startId, 0]];
  while (queue.length > 0) {
    const [current, hops] = queue.shift()!;
    if (hops >= maxHops) continue;
    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, hops + 1]);
      }
    }
  }
  return visited;
}

/**
 * Find isolated nodes (no incoming or outgoing links).
 */
export function findIsolatedNodes(nodes: GraphNode[], links: GraphLink[]): GraphNode[] {
  const connectedIds = new Set<string>();
  for (const link of links) {
    connectedIds.add(link.source);
    connectedIds.add(link.target);
  }
  return nodes.filter(n => !connectedIds.has(n.id));
}

/**
 * Count nodes by type.
 */
export function countByType(nodes: GraphNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of nodes) {
    counts[node.type] = (counts[node.type] || 0) + 1;
  }
  return counts;
}
