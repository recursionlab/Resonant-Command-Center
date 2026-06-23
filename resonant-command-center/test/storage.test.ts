import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeJsonParse, safeJsonParseOr } from '../src/storage';

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns fallback for invalid JSON', () => {
    const fallback = { default: true };
    expect(safeJsonParse('not json', fallback)).toEqual(fallback);
  });

  it('returns fallback for null input', () => {
    const fallback = {};
    expect(safeJsonParse(null, fallback)).toEqual(fallback);
  });

  it('returns fallback for undefined input', () => {
    const fallback = {};
    expect(safeJsonParse(undefined, fallback)).toEqual(fallback);
  });

  it('returns fallback for empty string', () => {
    const fallback = {};
    expect(safeJsonParse('', fallback)).toEqual(fallback);
  });

  it('returns fallback for corrupted localStorage data', () => {
    const fallback = { workspaces: {} };
    expect(safeJsonParse('{corrupted:::data', fallback)).toEqual(fallback);
  });

  it('does not throw on any input', () => {
    expect(() => safeJsonParse('{{{')).not.toThrow();
    expect(() => safeJsonParse('')).not.toThrow();
    expect(() => safeJsonParse(null as any)).not.toThrow();
    expect(() => safeJsonParse(undefined as any)).not.toThrow();
  });
});

describe('safeJsonParseOr', () => {
  it('is an alias that returns empty object as default fallback', () => {
    expect(safeJsonParseOr('invalid')).toEqual({});
    expect(safeJsonParseOr('{"x":1}')).toEqual({ x: 1 });
  });
});
