/**
 * src/state.ts — Application state.
 *
 * All mutable state lives here. Each module imports what it needs.
 * State is organized by domain: engine, chat, graph, archive, research.
 */

import { safeJsonParse } from './storage';

// ── Engine / LLM Configuration ──
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

export const engineConfig: EngineConfig = {
  temperature: 1.0,
  topP: 0.95,
  systemInstruction: '',
  mode: 'direct',
  roadmap: '',
  journal: '',
  orApiKey: (import.meta as any).env.VITE_OPENROUTER_API_KEY || '',
  orModel: (import.meta as any).env.VITE_OPENROUTER_MODEL || 'stepfun/step-3.5-flash',
};

export const API_KEY = (import.meta as any).env.VITE_GEMINI_API_KEY || '';

// ── Chat State ──
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export let activeChatHistory: ChatMessage[] = [];
export let activeChat: unknown = null;

// ── Knowledge Graph State ──
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

export let chatGraphNodes: GraphNode[] = [
  { id: 'Arithmetic', type: 'Paradigm' },
  { id: 'Algebra', type: 'Paradigm' },
  { id: 'Antiquity', type: 'Era' },
  { id: 'Greek Numeral System', type: 'System' },
  { id: 'Roman Numerals', type: 'System' },
  { id: 'Hindu-Arabic Numerals', type: 'System' },
  { id: 'Sampi', type: 'Entity' },
  { id: 'Archimedes', type: 'Person' },
  { id: 'Diophantus', type: 'Person' },
  { id: 'Symbolic Notation', type: 'Pivot' },
  { id: 'Syncopated Algebra', type: 'Paradigm' },
];

export let chatGraphLinks: GraphLink[] = [
  { source: 'Antiquity', target: 'Greek Numeral System', label: 'prevalent in' },
  { source: 'Antiquity', target: 'Roman Numerals', label: 'prevalent in' },
  { source: 'Greek Numeral System', target: 'Sampi', label: 'retained' },
  { source: 'Roman Numerals', target: 'Algebra', label: 'hindered development of' },
  { source: 'Greek Numeral System', target: 'Algebra', label: 'hindered development of' },
  { source: 'Antiquity', target: 'Syncopated Algebra', label: 'limited to' },
  { source: 'Hindu-Arabic Numerals', target: 'Algebra', label: 'unlocked symbolic' },
  { source: 'Symbolic Notation', target: 'Algebra', label: 'streamlined' },
  { source: 'Syncopated Algebra', target: 'Diophantus', label: 'used by' },
  { source: 'Arithmetic', target: 'Hindu-Arabic Numerals', label: 'encoded by' },
];

export let selectedGraphElement: { type: 'node' | 'link'; id: string } | null = null;

// ── Archive / Bibliography State ──
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

export let internalArchive: Substrate[] = [];
export let savedBibliography: BibliographyEntry[] = [];

// ── Research Queue State ──
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

export let researchQueue: ResearchGoal[] = loadResearchQueue();

function loadResearchQueue(): ResearchGoal[] {
  try {
    const stored = localStorage.getItem('omnigent_research_queue');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function persistResearchQueue(): void {
  localStorage.setItem('omnigent_research_queue', JSON.stringify(researchQueue));
}

// ── Workspace State ──
export interface Workspace {
  archive: Substrate[];
  bibliography: BibliographyEntry[];
  config: EngineConfig;
  chatHistory: string;
}

export let workspaces: Record<string, Workspace> = safeJsonParse(
  localStorage.getItem('monad_workspaces'),
  {}
);

export function persistWorkspaces(): void {
  localStorage.setItem('monad_workspaces', JSON.stringify(workspaces));
}

// ── Constants ──
export const MAX_CHARS_TOTAL = 4_000_000;

// ── Draft State ──
export let activeDrafts: Array<{ id: string; title: string; content: string }> = [];

export function removeDraft(id: string): void {
  activeDrafts = activeDrafts.filter(d => d.id !== id);
}
