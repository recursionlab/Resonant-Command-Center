/**
 * TDD: Extract node/link validation into testable functions
 * 
 * RED: This test should FAIL because the validation logic is currently
 *      embedded in onclick handlers (not importable, not testable).
 * 
 * GREEN: Extract the validation into pure functions, then test them.
 */
import { describe, it, expect } from 'vitest';

// Attempt to import the handler logic — this will fail because the handlers
// are closures, not exported functions.
// After the fix, we'll extract and import { validateNode, validateLink }

describe('Node/Link validation — pure functions', () => {
  // These imports should exist after the fix
  // @ts-ignore — will fail before extraction
  let validateNode: (nodes: Array<{id: string}>, input: string) => { valid: boolean; error?: string };
  // @ts-ignore
  let validateLink: (links: Array<{source: string, target: string}>, src: string, tgt: string) => { valid: boolean; error?: string };

  beforeAll(async () => {
    try {
      // This import path will be created during GREEN phase
      const mod = await import('../src/graph-validation');
      validateNode = mod.validateNode;
      validateLink = mod.validateLink;
    } catch {
      // Expected to fail in RED phase — module doesn't exist yet
    }
  });

  describe('validateNode', () => {
    it('rejects duplicate node names (case-insensitive)', () => {
      if (!validateNode) {
        // RED: function doesn't exist yet — this assertion proves the test is meaningful
        expect(validateNode, 'validateNode should be exported from src/graph-validation.ts').toBeDefined();
        return;
      }

      const nodes = [{ id: 'THE MONAD' }, { id: 'Fluxon' }];
      const result = validateNode(nodes, 'the monad');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Node already exists.');
    });

    it('accepts unique node names', () => {
      if (!validateNode) return;
      
      const nodes = [{ id: 'THE MONAD' }];
      const result = validateNode(nodes, 'Resonon');
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects empty input', () => {
      if (!validateNode) return;
      
      const nodes = [{ id: 'THE MONAD' }];
      const result = validateNode(nodes, '');
      
      expect(result.valid).toBe(false);
    });
  });

  describe('validateLink', () => {
    it('rejects missing source or target', () => {
      if (!validateLink) {
        expect(validateLink, 'validateLink should be exported from src/graph-validation.ts').toBeDefined();
        return;
      }

      const links: Array<{source: string, target: string}> = [];
      const result = validateLink(links, '', 'target');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Please select both source and target nodes.');
    });

    it('rejects same source and target', () => {
      if (!validateLink) return;
      
      const links: Array<{source: string, target: string}> = [];
      const result = validateLink(links, 'NODE_A', 'NODE_A');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Source and target must be different nodes.');
    });

    it('rejects duplicate links', () => {
      if (!validateLink) return;
      
      const links = [{ source: 'A', target: 'B' }];
      const result = validateLink(links, 'A', 'B');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Link already exists.');
    });

    it('accepts valid new links', () => {
      if (!validateLink) return;
      
      const links = [{ source: 'A', target: 'B' }];
      const result = validateLink(links, 'B', 'A');
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
