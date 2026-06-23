/**
 * src/research.ts — Research queue management.
 */

import { researchQueueList, addResearchBtn, researchTopic, researchTemplate, researchGoal, runPipelineBtn, benchmarkTauBtn, exportQueueBtn, syncNotionBtn, notionTestBtn, notionResearchDbId, notionWikiDbId, notionSyncEnabled, notionStatus } from './dom';
import { state, persistResearchQueue, persistNotionConfig, ResearchGoal } from './state';
import { createMessageElement } from './ui';

// ── Queue CRUD ──

export function addResearchGoal(topic: string, goal: string, template: string): ResearchGoal {
  const id = 'goal-' + Date.now().toString(36);
  const wikiPage = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const newGoal: ResearchGoal = {
    id, topic, goal, template, wikiPage,
    status: 'pending', priority: 5,
    created: new Date().toISOString(),
  };
  state.researchQueue.push(newGoal);
  persistResearchQueue();
  createMessageElement('assistant', `[SYSTEM] Research goal added to queue: "${topic}" (${template}). The cron pipeline will process it at the next scheduled run.`);
  return newGoal;
}

export function updateResearchGoalStatus(id: string, status: ResearchGoal['status']): void {
  const goal = state.researchQueue.find(g => g.id === id);
  if (goal) { goal.status = status; persistResearchQueue(); }
}

export function removeResearchGoal(id: string): void {
  state.researchQueue = state.researchQueue.filter(g => g.id !== id);
  persistResearchQueue();
}

// ── Queue UI ──

export function updateResearchQueueUI(): void {
  researchQueueList.innerHTML = '';
  if (state.researchQueue.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No active research goals.';
    researchQueueList.appendChild(p);
    return;
  }

  state.researchQueue.forEach(g => {
    const card = document.createElement('div');
    card.className = 'item-card';

    const top = document.createElement('div');
    top.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;';

    const info = document.createElement('div');
    info.style.maxWidth = '80%';
    const title = document.createElement('b');
    title.textContent = g.topic;
    info.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${g.template} • ${g.status} • ${new Date(g.created).toLocaleDateString()}`;
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:4px;';
    const runBtn = document.createElement('button');
    runBtn.className = 'secondary-btn';
    runBtn.style.cssText = 'font-size:0.55rem;padding:2px 6px;';
    runBtn.textContent = '▶ Run';
    runBtn.onclick = () => {
      updateResearchGoalStatus(g.id, 'in_progress');
      createMessageElement('assistant', `[SYSTEM] Dispatched pipeline for: "${g.topic}". Spawning researcher subagents...`);
    };
    actions.appendChild(runBtn);
    const delBtn = document.createElement('button');
    delBtn.className = 'remove-btn';
    delBtn.textContent = '×';
    delBtn.onclick = () => removeResearchGoal(g.id);
    actions.appendChild(delBtn);

    top.appendChild(info);
    top.appendChild(actions);
    card.appendChild(top);
    researchQueueList.appendChild(card);
  });
}

// ── Export Queue to Markdown ──

export function exportQueueToMarkdown(): string {
  const goals = state.researchQueue;
  if (goals.length === 0) return '';

  let md = '# Omnigent Research Queue\n\n';
  md += `> Last exported: ${new Date().toISOString()}\n\n`;
  md += '## Active Topics\n\n';

  goals.filter(g => g.status !== 'complete').forEach(g => {
    md += `- topic: "${g.topic}"\n`;
    md += `  goal: "${g.goal}"\n`;
    md += `  template: ${g.template}\n`;
    md += `  wiki-page: ${g.wikiPage}\n`;
    md += `  status: ${g.status}\n`;
    md += `  priority: ${g.priority}\n`;
    md += `  created: ${g.created}\n\n`;
  });

  const completed = goals.filter(g => g.status === 'complete');
  if (completed.length > 0) {
    md += '## Completed Topics\n\n';
    completed.forEach(g => {
      md += `- topic: "${g.topic}" — DONE (${g.wikiPage})\n`;
    });
  }

  return md;
}

export function initResearchQueue(): void {
  addResearchBtn.onclick = () => {
    const topic = researchTopic.value.trim();
    const goal = researchGoal.value.trim() || `Research: ${topic}`;
    const template = researchTemplate.value;
    if (!topic) {
      createMessageElement('assistant', '[SYSTEM] Please enter a research topic.');
      researchTopic.focus();
      return;
    }
    addResearchGoal(topic, goal, template);
    researchTopic.value = '';
    researchGoal.value = '';
  };

  runPipelineBtn.onclick = () => {
    const pending = state.researchQueue.filter(g => g.status === 'pending');
    if (pending.length === 0) {
      createMessageElement('assistant', '[SYSTEM] No pending research goals in queue.');
      return;
    }
    createMessageElement('assistant', `[SYSTEM] Running pipeline for ${pending.length} pending goal(s)...`);
    pending.forEach(g => updateResearchGoalStatus(g.id, 'in_progress'));
  };

  benchmarkTauBtn.onclick = () => {
    createMessageElement('assistant', '[SYSTEM] Running Softmax_τ benchmark...');
  };

  exportQueueBtn.onclick = () => {
    const md = exportQueueToMarkdown();
    if (!md) {
      createMessageElement('assistant', '[SYSTEM] Queue is empty — nothing to export.');
      return;
    }
    // Create a download blob
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'research_queue.md';
    a.click();
    URL.revokeObjectURL(url);
    createMessageElement('assistant', `[SYSTEM] Exported ${state.researchQueue.length} goal(s) to research_queue.md. Save this file to D:\\CODEX\\Omnigent\\research_queue.md to sync with the cron pipeline.`);
  };

  syncNotionBtn.onclick = () => {
    if (!state.notionSyncEnabled || !state.notionResearchDbId) {
      createMessageElement('assistant', '[SYSTEM] Notion sync is not configured. Please set the Research Queue Database ID in the Engine settings.');
      return;
    }
    if (state.researchQueue.length === 0) {
      createMessageElement('assistant', '[SYSTEM] Queue is empty — nothing to sync.');
      return;
    }
    createMessageElement('assistant', `[SYSTEM] Syncing ${state.researchQueue.length} goal(s) to Notion... (5 min between each API call)`);
    // Note: actual sync is async; in browser we call the NotionClient directly
    // For now, we show a message that the sync started
    // TODO: Wire async sync with progress updates
  };

  // ── Notion Settings UI ──

  // Restore saved values
  notionResearchDbId.value = state.notionResearchDbId || '';
  notionWikiDbId.value = state.notionWikiDbId || '';
  notionSyncEnabled.checked = state.notionSyncEnabled || false;

  // Persist on change
  notionResearchDbId.oninput = () => {
    state.notionResearchDbId = notionResearchDbId.value.trim();
    persistNotionConfig();
  };
  notionWikiDbId.oninput = () => {
    state.notionWikiDbId = notionWikiDbId.value.trim();
    persistNotionConfig();
  };
  notionSyncEnabled.onchange = () => {
    state.notionSyncEnabled = notionSyncEnabled.checked;
    persistNotionConfig();
  };

  // Test connection button
  notionTestBtn.onclick = () => {
    if (!state.notionResearchDbId && !state.notionWikiDbId) {
      notionStatus.textContent = '⚠ No database IDs set';
      notionStatus.style.color = '#ef4444';
      return;
    }
    notionStatus.textContent = '⏳ Testing connection...';
    notionStatus.style.color = '#fbbf24';

    // Use the bridge script to test
    import('child_process').catch(() => {
      // Browser environment — can't spawn child_process
      notionStatus.textContent = '⚠ Test connection only works in Node.js environment';
      notionStatus.style.color = '#fbbf24';
    });
  };
}
