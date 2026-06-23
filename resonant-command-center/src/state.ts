/**
 * src/state.ts — Application state.
 *
 * All mutable state lives in a single `state` object.
 * Modules import { state } and mutate its properties (not reassign the binding).
 * This avoids the ES module read-only binding problem:
 *   import { foo } from './state' → foo is read-only
 *   import { state } from './state' → state is read-only BUT state.foo is mutable
 */

import { safeJsonParse } from './storage';

// ── Types ──

export interface EngineConfig {
  temperature: number;
  topP: number;
  systemInstruction: string;
  mode: 'direct' | 'consultant';
  roadmap: string;
  journal: string;
  orApiKey: string;
  orModel: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GraphNode {
  id: string;
  type: string;
  label?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  label: string;
}

export interface Substrate {
  name: string;
  content: string;
  summary?: string;
  status: 'pending' | 'ingesting' | 'ready';
}

export interface BibliographyEntry {
  title: string;
  url: string;
}

export interface ResearchGoal {
  id: string;
  topic: string;
  goal: string;
  template: string;
  wikiPage: string;
  status: 'pending' | 'in_progress' | 'complete' | 'blocked';
  priority: number;
  created: string;
}

export interface Workspace {
  archive: Substrate[];
  bibliography: BibliographyEntry[];
  config: EngineConfig;
  chatHistory: string;
}

// ── Mutable State Container ──

export const state = {
  // Engine / LLM
  engineConfig: {
    temperature: 1.0,
    topP: 0.95,
    systemInstruction: '',
    mode: 'direct' as const,
    roadmap: '',
    journal: '',
    orApiKey: (import.meta as any).env.VITE_OPENROUTER_API_KEY || '',
    orModel: (import.meta as any).env.VITE_OPENROUTER_MODEL || 'openrouter/owl-alpha',
  } as EngineConfig,

  API_KEY: (import.meta as any).env.VITE_OPENROUTER_API_KEY || '' as string,

  // Chat
  activeChatHistory: [] as ChatMessage[],
  activeChat: null as unknown,

  // Knowledge Graph — populated by src/graph.ts seed data on first load
  chatGraphNodes: [] as GraphNode[],

  chatGraphLinks: [] as GraphLink[],

  selectedGraphElement: null as { type: 'node' | 'link'; id: string } | null,

  // Archive / Bibliography
  internalArchive: [] as Substrate[],
  savedBibliography: [] as BibliographyEntry[],

  // Research Queue
  researchQueue: [] as ResearchGoal[],

  // Workspaces
  workspaces: {} as Record<string, Workspace>,

  // Drafts
  activeDrafts: [] as Array<{ id: string; title: string; content: string }>,

  // Constants
  MAX_CHARS_TOTAL: 4_000_000,
};

// ── Initialize persisted state ──

function loadResearchQueue(): ResearchGoal[] {
  try {
    const stored = localStorage.getItem('omnigent_research_queue');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

state.researchQueue = loadResearchQueue();
state.workspaces = safeJsonParse(localStorage.getItem('monad_workspaces'), {});

// ── Persistence Helpers ──

export function persistResearchQueue(): void {
  localStorage.setItem('omnigent_research_queue', JSON.stringify(state.researchQueue));
}

export function persistWorkspaces(): void {
  localStorage.setItem('monad_workspaces', JSON.stringify(state.workspaces));
}

export function removeDraft(id: string): void {
  state.activeDrafts = state.activeDrafts.filter(d => d.id !== id);
}
