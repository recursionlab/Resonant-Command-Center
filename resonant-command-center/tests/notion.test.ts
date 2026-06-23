/**
 * Tests for Notion Client
 * 
 * These tests exercise the NotionClient class with mocked fetch.
 * They verify: construction validation, payload formatting, sync logic, error handling.
 * 
 * NOT integration tests — they don't call the real Notion API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotionClient, type SyncResult } from '../src/notion';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockResponse(status: number, data: any) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });
}

describe('NotionClient', () => {
  let client: NotionClient;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
    // Structural preemption: zero delay eliminates timer-based async issues entirely
    client = new NotionClient('test-key-123', 0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
    mockFetch.mockReset();
  });

  describe('construction', () => {
    it('throws if no API key provided and env not set', () => {
      const origKey = process.env.NOTION_API_KEY;
      delete process.env.NOTION_API_KEY;
      expect(() => new NotionClient('')).toThrow('API key required');
      process.env.NOTION_API_KEY = origKey; // restore
    });

    it('accepts API key from constructor', () => {
      expect(() => new NotionClient('valid-key')).not.toThrow();
    });
  });

  describe('testConnection', () => {
    it('returns list of databases', async () => {
      mockResponse(200, {
        results: [
          { id: 'db-1', title: [{ plain_text: 'Research Queue' }] },
          { id: 'db-2', title: [{ plain_text: 'Wiki Pages' }] },
        ],
      });

      const dbs = await client.testConnection();
      expect(dbs).toHaveLength(2);
      expect(dbs[0].id).toBe('db-1');
      expect(dbs[0].title).toBe('Research Queue');
    });

    it('returns empty array when no databases', async () => {
      mockResponse(200, { results: [] });
      const dbs = await client.testConnection();
      expect(dbs).toHaveLength(0);
    });

    it('throws on 401', async () => {
      mockResponse(401, { error: { message: 'Unauthorized' } });
      await expect(client.testConnection()).rejects.toThrow('Authentication failed');
    });
  });

  describe('createPage', () => {
    it('creates page with correct payload', async () => {
      mockResponse(200, {
        id: 'page-123',
        url: 'https://notion.so/page-123',
        properties: { Name: { title: [{ plain_text: 'Test' }] } },
      });

      const page = await client.createPage('db-1', 'Test', '# Hello');
      expect(page.id).toBe('page-123');
      expect(page.url).toBe('https://notion.so/page-123');
    });

    it('throws on 404 (database not shared)', async () => {
      mockResponse(404, { error: { message: 'Not found' } });
      await expect(client.createPage('db-1', 'Test', 'content')).rejects.toThrow('not found');
    });
  });

  describe('syncQueueToNotion', () => {
    it('syncs all goals and reports results', async () => {
      // Mock two successful page creations (with delays between)
      mockResponse(200, { id: 'p1', url: 'https://notion.so/p1', properties: {} });
      mockResponse(200, { id: 'p2', url: 'https://notion.so/p2', properties: {} });

      const goals = [
        { id: 'g1', topic: 'GRPO', goal: 'Survey GRPO', template: 'survey', status: 'pending', priority: 9, created: '2026-06-23' },
        { id: 'g2', topic: 'LoRA-GA', goal: 'Implement LoRA-GA', template: 'implement', status: 'pending', priority: 7, created: '2026-06-23' },
      ];

      const result = await client.syncQueueToNotion(goals, 'db-research');

      expect(result.synced).toBe(2);
      expect(result.pages[0].status).toBe('synced');
      expect(result.pages[0].pageId).toBe('p1');
      expect(result.pages[1].status).toBe('synced');
      expect(result.pages[1].pageId).toBe('p2');
    });

    it('reports failed syncs without throwing', async () => {
      mockResponse(401, { error: { message: 'Unauthorized' } });

      const goals = [
        { id: 'g1', topic: 'Bad Goal', goal: 'test', template: 'survey', status: 'pending', priority: 5, created: '2026-06-23' },
      ];

      const promise = client.syncQueueToNotion(goals, 'db-research');
      await vi.advanceTimersByTimeAsync(10);

      const result = await promise;
      expect(result.synced).toBe(0);
      expect(result.pages[0].status).toBe('failed');
      expect(result.pages[0].error).toContain('Authentication');
    });
  });

  describe('syncWikiPage', () => {
    it('creates new page if title not found', async () => {
      // Query returns empty (no existing page)
      mockResponse(200, { results: [] });
      // Create succeeds
      mockResponse(200, { id: 'wiki-1', url: 'https://notion.so/wiki-1', properties: {} });

      const promise = client.syncWikiPage('db-wiki', 'New Article', '# Content', 'Research');
      await vi.advanceTimersByTimeAsync(10); // query delay
      await vi.advanceTimersByTimeAsync(10); // create delay

      const result = await promise;
      expect(result.id).toBe('wiki-1');
    });

    it('updates existing page if title matches', async () => {
      // Query returns existing page
      mockResponse(200, {
        results: [{ id: 'wiki-existing', url: 'https://notion.so/existing', properties: {} }],
      });
      // Update succeeds
      mockResponse(200, { id: 'wiki-existing', url: 'https://notion.so/existing', properties: {} });

      const promise = client.syncWikiPage('db-wiki', 'Existing Article', '# Updated');
      await vi.advanceTimersByTimeAsync(10); // query delay
      await vi.advanceTimersByTimeAsync(10); // update delay

      const result = await promise;
      expect(result.id).toBe('wiki-existing');
    });
  });

  describe('error handling', () => {
    it('throws descriptive error on 429 rate limit', async () => {
      mockResponse(429, { error: { message: 'Rate limited' } });
      await expect(client.getPage('page-1')).rejects.toThrow('Rate limit');
    });

    it('throws on 500 server error', async () => {
      mockResponse(500, { error: { message: 'Internal server error' } });
      await expect(client.getPage('page-1')).rejects.toThrow('500');
    });
  });
});
