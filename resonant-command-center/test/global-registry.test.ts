import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSandbox, registerGlobal, getGlobal, clearGlobals } from '../src/global-registry';

describe('createSandbox', () => {
  it('creates an isolated DOM sandbox', () => {
    const sandbox = createSandbox();
    expect(sandbox.querySelector).toBeDefined();
    expect(sandbox.createElement).toBeDefined();
  });

  it('can set and retrieve innerHTML safely', () => {
    const sandbox = createSandbox();
    const div = sandbox.createElement('div');
    div.innerHTML = '<b>test</b>';
    expect(div.innerHTML).toBe('<b>test</b>');
  });
});

describe('registerGlobal / getGlobal', () => {
  beforeEach(() => {
    clearGlobals();
  });

  it('registers and retrieves a function', () => {
    const fn = vi.fn();
    registerGlobal('testFn', fn);
    expect(getGlobal('testFn')).toBe(fn);
  });

  it('returns undefined for unregistered keys', () => {
    expect(getGlobal('nonexistent')).toBeUndefined();
  });

  it('overwrites on duplicate registration', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    registerGlobal('key', fn1);
    registerGlobal('key', fn2);
    expect(getGlobal('key')).toBe(fn2);
  });

  it('clearGlobals removes all registrations', () => {
    registerGlobal('a', () => {});
    registerGlobal('b', () => {});
    clearGlobals();
    expect(getGlobal('a')).toBeUndefined();
    expect(getGlobal('b')).toBeUndefined();
  });
});
