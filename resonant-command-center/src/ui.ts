/**
 * src/ui.ts — Shared UI helpers.
 *
 * Message creation, modal system, tab switching, palette, draft UI.
 * Pure DOM manipulation with no business logic.
 */

import { messagesContainer, modalEl, modalMessage, modalInputContainer, modalInput, modalConfirmBtn, modalCancelBtn, draftContainer, tabBtns, tabContents, viewTabs, viewPanes, commandPalette, paletteSearch, paletteResults, latticeGraph } from './dom';
import { sanitize } from './security';
import { engineConfig, activeDrafts, removeDraft } from './state';

// ── Message Creation ──

export function createMessageElement(role: 'user' | 'assistant', content: string = ''): HTMLDivElement {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';
  contentDiv.textContent = content;
  div.appendChild(contentDiv);
  messagesContainer.appendChild(div);
  messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
  return div;
}

// ── Custom Modal (replaces confirm/prompt/alert) ──

let modalResolver: ((value: string | null) => void) | null = null;

export function showModal(message: string, inputDefault: string = ''): Promise<string | null> {
  modalMessage.textContent = message;
  if (inputDefault !== '__no_input__') {
    modalInputContainer.classList.remove('hidden');
    modalInput.value = inputDefault;
  } else {
    modalInputContainer.classList.add('hidden');
  }
  modalEl.classList.remove('hidden');
  setTimeout(() => modalInput.focus(), 50);
  return new Promise(resolve => { modalResolver = resolve; });
}

function closeModal(value: string | null): void {
  modalEl.classList.add('hidden');
  if (modalResolver) { modalResolver(value); modalResolver = null; }
}

modalConfirmBtn.onclick = () => closeModal(modalInputContainer.classList.contains('hidden') ? '__confirmed__' : modalInput.value);
modalCancelBtn.onclick = () => closeModal(null);
modalInput.onkeydown = (e: KeyboardEvent) => { if (e.key === 'Enter') closeModal(modalInput.value); };
modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(null); });

// ── Tab Switching ──

export function initTabSwitching(): void {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tabContents.forEach(content => {
        content.classList.toggle('hidden', content.id !== `${tab}-section`);
      });
    });
  });
}

export function initViewTabs(onLatticeView: () => void): void {
  viewTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      viewTabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      viewPanes.forEach(pane => {
        pane.classList.toggle('hidden', pane.id !== `${view}-view`);
      });
      if (view === 'lattice') onLatticeView();
    });
  });
}

// ── Command Palette ──

let paletteIndex = -1;

interface Command {
  label: string;
  action: () => void;
  shortcut: string;
}

const commands: Command[] = [
  { label: 'Upload Substrate', action: () => document.getElementById('file-upload')?.dispatchEvent(new Event('click')), shortcut: 'U' },
  { label: 'Synchronize Lattice', action: () => document.getElementById('synthesis-btn')?.dispatchEvent(new Event('click')), shortcut: 'S' },
  { label: 'Save Workspace', action: () => document.getElementById('save-workspace')?.dispatchEvent(new Event('click')), shortcut: 'W' },
  { label: 'Clear Monitor', action: () => document.querySelector('[data-action="clear-chat"]')?.dispatchEvent(new Event('click')), shortcut: 'C' },
  { label: 'Switch to Lattice View', action: () => document.querySelector('[data-view="lattice"]')?.dispatchEvent(new Event('click')), shortcut: 'L' },
  { label: 'Switch to Monitor', action: () => document.querySelector('[data-view="monitor"]')?.dispatchEvent(new Event('click')), shortcut: 'M' },
];

export function initCommandPalette(): void {
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      commandPalette.classList.remove('hidden');
      paletteSearch.focus();
      updatePaletteResults('');
    }
    if (e.key === 'Escape') {
      commandPalette.classList.add('hidden');
      const genesisOverlay = document.getElementById('genesis-overlay')!;
      if (!genesisOverlay.classList.contains('hidden')) {
        genesisOverlay.classList.add('hidden');
      }
    }
  });

  paletteSearch.oninput = () => updatePaletteResults(paletteSearch.value);
  paletteSearch.onkeydown = (e) => {
    const items = paletteResults.querySelectorAll('.palette-item');
    if (e.key === 'ArrowDown') {
      paletteIndex = (paletteIndex + 1) % items.length;
      updatePaletteResults(paletteSearch.value);
    } else if (e.key === 'ArrowUp') {
      paletteIndex = (paletteIndex - 1 + items.length) % items.length;
      updatePaletteResults(paletteSearch.value);
    } else if (e.key === 'Enter' && paletteIndex >= 0) {
      const filtered = commands.filter(c => c.label.toLowerCase().includes(paletteSearch.value.toLowerCase()));
      filtered[paletteIndex].action();
      commandPalette.classList.add('hidden');
    }
  };
}

function updatePaletteResults(query: string): void {
  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));
  paletteResults.innerHTML = '';
  filtered.forEach((c, i) => {
    const item = document.createElement('div');
    item.className = `palette-item ${i === paletteIndex ? 'selected' : ''}`;
    item.innerHTML = `<span>${c.label}</span><span class="shortcut">${c.shortcut}</span>`;
    item.addEventListener('click', () => {
      c.action();
      commandPalette.classList.add('hidden');
    });
    paletteResults.appendChild(item);
  });
}

// ── Draft UI ──

export function addDraft(title: string, content: string): void {
  const id = Math.random().toString(36).substring(7);
  activeDrafts.push({ id, title, content });
  updateDraftUI();
}

export function updateDraftUI(): void {
  draftContainer.innerHTML = '';
  if (activeDrafts.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.style.fontSize = '0.6rem';
    p.textContent = 'No active proposals.';
    draftContainer.appendChild(p);
    return;
  }

  activeDrafts.forEach(d => {
    const card = document.createElement('div');
    card.className = 'draft-card';

    const title = document.createElement('div');
    title.className = 'draft-title';
    title.textContent = d.title;
    card.appendChild(title);

    const preview = document.createElement('div');
    preview.className = 'draft-preview';
    preview.textContent = d.content.substring(0, 50) + '...';
    card.appendChild(preview);

    card.addEventListener('click', async () => {
      const result = await showModal(`Apply draft: ${d.title}?`, '__no_input__');
      if (result === '__confirmed__') {
        const sysInput = document.getElementById('system-command-input') as HTMLTextAreaElement;
        const applyBtn = document.getElementById('apply-system-command')!;
        sysInput.value = d.content;
        applyBtn.dispatchEvent(new Event('click'));
        activeDrafts = activeDrafts.filter(x => x.id !== d.id);
        updateDraftUI();
      }
    });

    draftContainer.appendChild(card);
  });
}
