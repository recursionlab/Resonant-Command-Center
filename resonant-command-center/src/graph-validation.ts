/**
 * Pure validation functions for graph node/link injection.
 * Extracted from index.tsx onclick handlers for testability.
 */

export function validateNode(
  nodes: Array<{ id: string }>,
  input: string
): { valid: boolean; error?: string } {
  if (!input || !input.trim()) {
    return { valid: false, error: 'Please enter a node name.' };
  }
  const isDuplicate = nodes.some(
    n => n.id.toLowerCase() === input.toLowerCase()
  );
  if (isDuplicate) {
    return { valid: false, error: 'Node already exists.' };
  }
  return { valid: true };
}

export function validateLink(
  links: Array<{ source: string; target: string }>,
  src: string,
  tgt: string
): { valid: boolean; error?: string } {
  if (!src || !tgt) {
    return { valid: false, error: 'Please select both source and target nodes.' };
  }
  if (src === tgt) {
    return { valid: false, error: 'Source and target must be different nodes.' };
  }
  const isDuplicate = links.some(
    l => l.source === src && l.target === tgt
  );
  if (isDuplicate) {
    return { valid: false, error: 'Link already exists.' };
  }
  return { valid: true };
}
