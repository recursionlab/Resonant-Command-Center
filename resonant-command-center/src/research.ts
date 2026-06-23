/**
 * src/research.ts — Research queue management.
 */

import { researchQueueList, addResearchBtn, researchTopic, researchTemplate, researchGoal, runPipelineBtn, benchmarkTauBtn } from './dom';
import { state, persistResearchQueue, ResearchGoal } from './state';
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

// ── Event Listeners ──

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
}
