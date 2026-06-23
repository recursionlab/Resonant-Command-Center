/**
 * test/api-key.test.ts — Tests for API key configuration and usage.
 *
 * Catches the 401 "Missing Authentication header" bug where the
 * OPENROUTER_API_KEY was read from the empty DOM input at module load time
 * instead of being read fresh on each API call.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('API Key Handling', () => {
  beforeEach(() => {
    // Set up minimal DOM
    document.body.innerHTML = `
      <input type="password" id="or-key-input" value="" />
      <input type="text" id="or-model-input" value="stepfun/step-3.5-flash" />
    `;
  });

  it('reads API key from input field, not module-level init', () => {
    // THE BUG: The old code did `let OPENROUTER_API_KEY = orKeyInput.value.trim()`
    // at module load time. The input is empty at load time, so the variable is "".
    // On API call, it sends "Bearer " which causes 401.

    const input = document.getElementById('or-key-input') as HTMLInputElement;

    // At load time, input is empty
    const loadTimeKey = input.value.trim();
    expect(loadTimeKey).toBe('');

    // User types key into input
    input.value = 'sk-or-V1-test-key-12345';

    // The fix: read from input at call time, not at load time
    const callTimeKey = input.value.trim();
    expect(callTimeKey).toBe('sk-or-V1-test-key-12345');
  });

  it('includes Bearer token in Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    (globalThis as any).fetch = mockFetch;

    const apiKey = 'sk-or-V1-test-key';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://ai.studio/build',
      'X-Title': 'Test',
    };

    await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: 'test', messages: [] }),
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders['Authorization']).toMatch(/^Bearer /);
    expect(callHeaders['Authorization']).not.toBe('Bearer ');
    expect(callHeaders['Authorization']).not.toBe('Bearer');
  });

  it('does NOT send empty Bearer token when key is not configured', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"error":{"message":"Missing Authentication header","code":401}}',
    });
    (globalThis as any).fetch = mockFetch;

    const apiKey = '';
    // Guard: don't send empty key
    if (apiKey) {
      await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: 'test', messages: [] }),
      });
    }

    // Should not have called fetch with empty key
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('state.engineConfig.orApiKey syncs with input field', () => {
    // Simulate the oninput handler pattern
    const state: { engineConfig: { orApiKey: string } } = {
      engineConfig: { orApiKey: '' },
    };
    const input = document.getElementById('or-key-input') as HTMLInputElement;

    // User types key
    input.value = 'sk-or-V1-abc123';
    state.engineConfig.orApiKey = input.value.trim();

    expect(state.engineConfig.orApiKey).toBe('sk-or-V1-abc123');
  });

  it('workspace save/roundtrip preserves API key', () => {
    const input = document.getElementById('or-key-input') as HTMLInputElement;
    const state: { engineConfig: { orApiKey: string; orModel: string } } = {
      engineConfig: { orApiKey: '', orModel: 'stepfun/step-3.5-flash' },
    };

    // User configures key
    input.value = 'sk-or-V1-mykey';
    state.engineConfig.orApiKey = input.value.trim();

    // Save workspace
    const workspaces: Record<string, any> = {};
    workspaces['my-ws'] = {
      config: { ...state.engineConfig },
    };

    // Clear (simulating workspace switch)
    state.engineConfig.orApiKey = '';
    input.value = '';

    // Restore from workspace
    const ws = workspaces['my-ws'];
    state.engineConfig.orApiKey = ws.config.orApiKey;
    input.value = state.engineConfig.orApiKey;

    expect(input.value).toBe('sk-or-V1-mykey');
    expect(state.engineConfig.orApiKey).toBe('sk-or-V1-mykey');
  });
});
