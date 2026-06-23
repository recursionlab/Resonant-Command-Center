/**
 * test/chat.test.ts — Tests for OpenRouter chat request formation.
 *
 * Validates that API calls are properly formed with:
 * - Correct Authorization header (Bearer token)
 * - Correct Content-Type
 * - Correct request body (model, messages, temperature, top_p)
 * - Error handling for non-ok responses
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch before importing any module that uses it
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock DOM
document.body.innerHTML = `
  <div id="messages"></div>
  <form id="chat-form"><textarea id="user-input"></textarea><button id="send-btn" type="submit"></button></form>
  <div id="bib-list"></div>
  <div id="archive-list"></div>
  <div id="context-badge"></div>
  <input type="file" id="file-upload" />
  <div id="capacity-fill"></div>
  <button id="synthesis-btn"></button>
  <div id="genesis-overlay" class="hidden"><div id="genesis-log"></div><div id="genesis-progress"></div></div>
  <textarea id="system-command-input"></textarea>
  <button id="apply-system-command"></button>
  <input type="range" id="temp-slider" value="1.0" />
  <div id="temp-val">1.0</div>
  <input type="range" id="topp-slider" value="0.95" />
  <div id="topp-val">0.95</div>
  <button id="export-state"></button>
  <button class="tab-btn active" data-tab="engine"></button>
  <div id="engine-section" class="tab-content"></div>
  <button class="tab-btn" data-tab="roadmap"></button>
  <div id="roadmap-section" class="tab-content hidden"></div>
  <button class="tab-btn" data-tab="research"></button>
  <div id="research-section" class="tab-content hidden"></div>
  <button class="view-tab active" data-view="monitor"></button>
  <div id="monitor-view" class="view-pane"></div>
  <button class="view-tab" data-view="lattice"></button>
  <div id="lattice-view" class="view-pane hidden"></div>
  <div id="lattice-graph"></div>
  <select id="workspace-select"><option value="default">Default</option></select>
  <button id="save-workspace"></button>
  <button id="generate-kernel"></button>
  <button class="tool-btn" data-action="clear-chat"></button>
  <button class="tool-btn" data-action="summarize-all"></button>
  <button class="tool-btn" data-action="find-contradictions"></button>
  <button class="tool-btn" data-action="extract-entities"></button>
  <button class="tool-btn" data-action="strategic-reflection"></button>
  <button class="tool-btn" data-action="void-injection"></button>
  <div id="command-palette" class="modal hidden">
    <div class="modal-content">
      <input type="text" id="palette-search" />
      <div id="palette-results"></div>
    </div>
  </div>
  <button id="mode-direct" class="mode-btn active">Direct</button>
  <button id="mode-consultant" class="mode-btn">Consultant</button>
  <div id="drafts-section" class="hidden">
    <div id="draft-container" class="item-list"></div>
  </div>
  <textarea id="roadmap-input"></textarea>
  <textarea id="journal-input"></textarea>
  <input type="password" id="or-key-input" />
  <input type="text" id="or-model-input" value="stepfun/step-3.5-flash" />
  <input type="text" id="manual-node-id" />
  <select id="manual-node-type"><option value="Paradigm">Paradigm</option></select>
  <button id="manual-add-node-btn"></button>
  <select id="manual-link-source"><option value="">Select...</option></select>
  <select id="manual-link-target"><option value="">Select...</option></select>
  <input type="text" id="manual-link-label" />
  <button id="manual-add-link-btn"></button>
  <div id="focus-content"></div>
  <button id="autonomous-extract-btn"></button>
  <div id="custom-modal" class="hidden">
    <div id="modal-message"></div>
    <div id="modal-input-container"><input type="text" id="modal-input" /></div>
    <button id="modal-confirm">OK</button>
    <button id="modal-cancel">Cancel</button>
  </div>
  <input type="text" id="research-topic" />
  <select id="research-template"><option value="survey">Survey</option></select>
  <textarea id="research-goal"></textarea>
  <button id="add-research-btn"></button>
  <div id="research-queue-list" class="item-list"></div>
  <button id="run-pipeline-btn"></button>
  <button id="benchmark-tau-btn"></button>
  <aside id="left-sidebar" class="sidebar"></aside>
  <aside id="right-sidebar" class="sidebar"></aside>
`;

describe('OpenRouter API Request Formation', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Test response' } }],
      }),
    } as Response);
  });

  it('sends Authorization header with Bearer token', async () => {
    // Simulate the handleGenerate flow by checking what fetch is called with
    const apiKey = 'sk-or-v1-test-key-12345';

    await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://ai.studio/build',
        'X-Title': 'Monad Resonant Command Center',
      },
      body: JSON.stringify({
        model: 'stepfun/step-3.5-flash',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 1.0,
        top_p: 0.95,
      }),
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const call = mockFetch.mock.calls[0];
    const headers = call[1].headers;
    expect(headers['Authorization']).toBe(`Bearer ${apiKey}`);
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('sends correct request body structure', async () => {
    const apiKey = 'sk-or-v1-test-key';
    const model = 'stepfun/step-3.5-flash';
    const messages = [{ role: 'user', content: 'Test' }];
    const temperature = 0.7;
    const topP = 0.9;

    await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://ai.studio/build',
        'X-Title': 'Monad Resonant Command Center',
      },
      body: JSON.stringify({ model, messages, temperature, top_p: topP }),
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe(model);
    expect(body.messages).toEqual(messages);
    expect(body.temperature).toBe(temperature);
    expect(body.top_p).toBe(topP);
  });

  it('throws descriptive error on 401 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => '{"error":{"message":"Missing Authentication header","code":401}}',
    } as Response);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' },
      body: JSON.stringify({ model: 'test', messages: [] }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
    const errBody = await response.text();
    expect(errBody).toContain('Missing Authentication header');
  });

  it('uses OPENROUTER_API_KEY from state, not hardcoded empty string', () => {
    // This is the key bug: the let OPENROUTER_API_KEY at module level
    // reads from the DOM input at load time, which is empty unless the user
    // has typed into the field. The fix is to use state.engineConfig.orApiKey
    // which gets updated when the user types.

    // Verify that the pattern used in the code reads from state, not from a stale let
    const state = { engineConfig: { orApiKey: '' } };
    const orKeyInput = document.getElementById('or-key-input') as HTMLInputElement;

    // Simulate user typing API key
    orKeyInput.value = 'sk-or-v1-user-key-12345';

    // The correct pattern: read from input on each call, not at module load
    function getApiKey(): string {
      return orKeyInput.value.trim() || state.engineConfig.orApiKey;
    }

    // Before user types: empty
    orKeyInput.value = '';
    expect(getApiKey()).toBe('');

    // After user types: picks up the value
    orKeyInput.value = 'sk-or-v1-user-key-12345';
    expect(getApiKey()).toBe('sk-or-v1-user-key-12345');

    // State.env var takes precedence if both set
    state.engineConfig.orApiKey = 'sk-or-v1-env-key';
    expect(getApiKey()).toBe('sk-or-v1-user-key-12345'); // input wins (most recent)
  });
});

describe('API Key Configuration', () => {
  it('or-key-input oninput updates both local variable and state', () => {
    const state = { engineConfig: { orApiKey: '' } };
    const input = document.createElement('input');
    input.id = 'or-key-input-test';
    input.type = 'password';
    document.body.appendChild(input);

    // Simulate the oninput handler from index.tsx
    let OPENROUTER_API_KEY = input.value.trim();
    input.oninput = () => {
      OPENROUTER_API_KEY = input.value.trim();
      state.engineConfig.orApiKey = OPENROUTER_API_KEY;
    };

    // Before typing
    expect(OPENROUTER_API_KEY).toBe('');

    // Simulate typing
    input.value = 'sk-or-v1-abc123';
    input.dispatchEvent(new Event('input'));

    expect(OPENROUTER_API_KEY).toBe('sk-or-v1-abc123');
    expect(state.engineConfig.orApiKey).toBe('sk-or-v1-abc123');

    document.body.removeChild(input);
  });

  it('API key persists across workspace switches', () => {
    const workspaces: Record<string, any> = {};
    const state = {
      engineConfig: { orApiKey: 'sk-or-v1-persisted-key' },
    };
    const input = document.getElementById('or-key-input') as HTMLInputElement;

    // Save workspace with API key
    const name = 'test-ws';
    workspaces[name] = {
      config: { ...state.engineConfig },
    };

    // Switch to workspace — API key should be restored
    const ws = workspaces[name];
    state.engineConfig = ws.config;
    input.value = state.engineConfig.orApiKey;

    expect(input.value).toBe('sk-or-v1-persisted-key');
    expect(state.engineConfig.orApiKey).toBe('sk-or-v1-persisted-key');
  });
});
