/**
 * src/archive.ts — Substrate archive and bibliography management.
 */

import { sanitize } from './security';
import { archiveList, bibList, contextBadge, capacityFill, messagesContainer, fileUpload } from './dom';
import { state, persistResearchQueue } from './state';
import { marked } from 'marked';
import { createMessageElement, showModal } from './ui';

// ── Capacity ──

function updateCapacity(): void {
  const totalChars = state.internalArchive.reduce((acc, p) => acc + p.content.length, 0);
  const usagePercent = Math.min(100, (totalChars / state.MAX_CHARS_TOTAL) * 100);
  contextBadge.textContent = `${state.internalArchive.length} Papers Active`;
  capacityFill.style.width = `${usagePercent}%`;
  capacityFill.style.background = usagePercent > 90 ? '#ef4444' : usagePercent > 70 ? '#f59e0b' : 'var(--accent-signal)';
}

// ── Archive UI ──

export function updateArchiveUI(): void {
  updateCapacity();

  if (state.internalArchive.length === 0) {
    archiveList.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'Upload documents to begin indexing.';
    archiveList.appendChild(p);
    return;
  }

  archiveList.innerHTML = '';
  state.internalArchive.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = `item-card ${item.status}`;

    const top = document.createElement('div');
    top.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;';

    const info = document.createElement('div');
    info.style.maxWidth = '80%';

    const title = document.createElement('b');
    title.textContent = item.name;
    info.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${(item.content.length / 1000).toFixed(1)}k chars • <span class="status-tag">${item.status.toUpperCase()}</span>`;
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'secondary-btn';
    viewBtn.style.cssText = 'font-size:0.6rem;padding:2px 6px;';
    viewBtn.textContent = 'View Logic';
    viewBtn.disabled = item.status !== 'ready';
    viewBtn.onclick = () => { handleViewLogic(idx); };
    actions.appendChild(viewBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'remove-btn';
    delBtn.textContent = '×';
    delBtn.onclick = () => { state.internalArchive.splice(idx, 1); updateArchiveUI(); };
    actions.appendChild(delBtn);

    top.appendChild(info);
    top.appendChild(actions);
    card.appendChild(top);
    archiveList.appendChild(card);
  });
}

export async function handleViewLogic(idx: number): Promise<void> {
  const item = state.internalArchive[idx];
  if (!item.summary) return;

  const parsedHtml = marked.parse(item.summary);
  const html = typeof parsedHtml === 'string' ? parsedHtml : await parsedHtml;

  const div = document.createElement('div');
  div.className = 'message assistant';
  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';
  const heading = document.createElement('h3');
  heading.textContent = `Document Index: ${item.name}`;
  contentDiv.appendChild(heading);
  const sanitizedDiv = document.createElement('div');
  sanitizedDiv.innerHTML = sanitize(html);
  while (sanitizedDiv.firstChild) {
    contentDiv.appendChild(sanitizedDiv.firstChild);
  }
  div.appendChild(contentDiv);
  messagesContainer.appendChild(div);
  messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
}

// ── Bibliography UI ──

export function updateBibUI(): void {
  bibList.innerHTML = '';
  if (state.savedBibliography.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No sources saved yet.';
    bibList.appendChild(p);
    return;
  }

  state.savedBibliography.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'item-card';

    const titleEl = document.createElement('b');
    titleEl.textContent = item.title;
    card.appendChild(titleEl);
    card.appendChild(document.createElement('br'));

    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.style.cssText = 'font-size:0.7rem;color:#6366f1;';
    link.textContent = item.url;
    card.appendChild(link);

    const removeBtn = document.createElement('button');
    removeBtn.style.cssText = 'float:right;background:none;border:none;color:var(--text-muted);cursor:pointer;';
    removeBtn.textContent = '×';
    removeBtn.onclick = () => { state.savedBibliography.splice(idx, 1); updateBibUI(); };
    card.appendChild(removeBtn);

    bibList.appendChild(card);
  });
}

export function addReference(title: string, url: string): void {
  if (!state.savedBibliography.some(ref => ref.url === url)) {
    state.savedBibliography.push({ title, url });
    updateBibUI();
  }
}

// ── File Upload ──

export function initFileUpload(): void {
  fileUpload.addEventListener('change', async (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        if (text.startsWith('%PDF')) {
          createMessageElement('assistant', '[SYSTEM] Please upload .txt or .md files. Binary PDFs are unreadable by browsers.');
          continue;
        }

        const newPaper = { name: file.name, content: text, status: 'ingesting' as const };
        state.internalArchive.push(newPaper);
        updateArchiveUI();
        ingestPaper(newPaper, state.engineConfig.orApiKey, state.engineConfig.orModel);
      } catch (err) {
        console.error('Read Error', err);
      }
    }
  });
}

async function ingestPaper(paper: typeof state.internalArchive[0], apiKey: string, model: string): Promise<void> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://ai.studio/build',
        'X-Title': 'Monad Resonant Command Center',
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: `[PROTOCOL: INDEXING SUBSTRATE]\nCOMMAND SUBSTRATE for THE MONAD: INFINITE LIBRARY.\nAnalyze the structural dominance and recursive potential of this text for the library index.\n\nStructure your response as follows:\n1. CORE DIRECTIVE: What is the primary purpose of this document?\n2. KNOWLEDGE VECTORS: What are the key themes and data points?\n3. STRUCTURAL WEIGHT: Which sections command the most importance?\n4. LATTICE DELTA (Δ): The unique contribution of this document to the global lattice.\n5. SINGULARITY: A one-sentence summary of the document's essence.\n\nKeep it high-density, technical, and absolute.\n\nSUBSTRATE:\n${paper.content.substring(0, 300000)}`,
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter Ingestion failed: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    paper.summary = data.choices?.[0]?.message?.content || 'No response received via OpenRouter.';
    paper.status = 'ready';
  } catch (err: any) {
    console.error('Indexing failed', err);
    paper.summary = `[INDEXING ERROR: SAFETY TRIGGER]\nThe requested syntax reached a forbidden frequency.\nError: ${err.message}.\nAdjust the substrate and re-upload.`;
    paper.status = 'ready';
  }
  updateArchiveUI();
}
