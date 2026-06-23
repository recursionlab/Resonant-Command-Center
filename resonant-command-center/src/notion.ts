/**
 * src/notion.ts — Notion API Client
 * 
 * Typed client wrapping Notion API operations.
 * Used by the RCC app and cron jobs.
 * 
 * Architectural constraint: Minimum 300000ms (5 min) between any agent-initiated API call.
 */

// ── Types ──

export interface NotionPage {
  id: string;
  title: string;
  url: string;
  properties: Record<string, any>;
}

export interface NotionDatabase {
  id: string;
  title: string;
  data_source_id: string;
}

export interface SyncResult {
  synced: number;
  pages: Array<{ goalId?: string; title: string; pageId?: string; url?: string; status: 'synced' | 'failed'; error?: string }>;
}

export interface NotionConfig {
  researchQueueDbId: string;
  wikiDbId: string;
  enabled: boolean;
}

// ── Notion Client ──

export class NotionClient {
  private apiKey: string;
  private baseUrl = 'https://api.notion.com/v1';
  private notionVersion = '2025-09-03';
  private delayMs = 300000; // 5 minutes between API calls

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NOTION_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('NotionClient: API key required. Set NOTION_API_KEY or pass to constructor.');
    }
  }

  private async request(method: string, path: string, body: any = null, enforceDelay = true): Promise<any> {
    if (enforceDelay) {
      await new Promise(r => setTimeout(r, this.delayMs));
    }

    const opts: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Notion-Version': this.notionVersion,
        'Content-Type': 'application/json',
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${this.baseUrl}${path}`, opts);
    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      if (res.status === 401) throw new Error('Notion API: Authentication failed. Check NOTION_API_KEY.');
      if (res.status === 404) throw new Error('Notion API: Resource not found. Ensure database is shared with integration.');
      if (res.status === 429) throw new Error('Notion API: Rate limit exceeded.');
      throw new Error(`Notion API ${res.status}: ${errMsg}`);
    }

    return data;
  }

  // ── Connection Test ──

  async testConnection(): Promise<NotionDatabase[]> {
    const data = await this.request('POST', '/search?filter=data_source', { page_size: 100 }, false);
    const databases = (data.results || []).map((r: any) => ({
      id: r.id,
      title: r.title?.[0]?.plain_text || 'Untitled',
      data_source_id: r.id,
    }));
    return databases;
  }

  // ── Page Operations ──

  async createPage(databaseId: string, title: string, markdown: string): Promise<NotionPage> {
    const data = await this.request('POST', '/pages', {
      parent: { database_id: databaseId },
      properties: {
        Name: { title: [{ text: { content: title } }] },
      },
      markdown: markdown,
    });

    return {
      id: data.id,
      title,
      url: data.url,
      properties: data.properties,
    };
  }

  async updatePage(pageId: string, markdown: string): Promise<NotionPage> {
    const data = await this.request('PATCH', `/pages/${pageId}/markdown`, { markdown });
    return {
      id: data.id,
      title: data.properties?.Name?.title?.[0]?.plain_text || '',
      url: data.url,
      properties: data.properties,
    };
  }

  async getPage(pageId: string): Promise<any> {
    return this.request('GET', `/pages/${pageId}`, null, false);
  }

  // ── Database Operations ──

  async queryDatabase(databaseId: string, filter: any = null, pageSize = 100): Promise<NotionPage[]> {
    const body: any = { page_size: pageSize };
    if (filter) body.filter = filter;

    const data = await this.request('POST', `/data_sources/${databaseId}/query`, body);
    return (data.results || []).map((r: any) => ({
      id: r.id,
      title: r.properties?.Name?.title?.[0]?.plain_text || 'Untitled',
      url: r.url,
      properties: r.properties,
    }));
  }

  async searchDatabases(query: string): Promise<NotionDatabase[]> {
    const data = await this.request('POST', '/search', { query, filter: 'data_source' }, false);
    return (data.results || []).map((r: any) => ({
      id: r.id,
      title: r.title?.[0]?.plain_text || 'Untitled',
      data_source_id: r.id,
    }));
  }

  // ── Sync Operations ──

  /**
   * Sync research goals to Notion Research Queue database.
   * Returns sync results for each goal.
   */
  async syncQueueToNotion(
    goals: Array<{ id: string; topic: string; goal: string; template: string; status: string; priority: number; created: string }>,
    databaseId: string
  ): Promise<SyncResult> {
    const results: SyncResult['pages'] = [];

    for (const goal of goals) {
      try {
        const markdown = this.goalToMarkdown(goal);
        const page = await this.createPage(databaseId, goal.topic, markdown);
        results.push({
          goalId: goal.id,
          title: goal.topic,
          pageId: page.id,
          url: page.url,
          status: 'synced',
        });
      } catch (err: any) {
        results.push({
          goalId: goal.id,
          title: goal.topic,
          status: 'failed',
          error: err.message,
        });
      }
    }

    return {
      synced: results.filter(r => r.status === 'synced').length,
      pages: results,
    };
  }

  /**
   * Sync a wiki page to Notion. Upsert by title.
   */
  async syncWikiPage(
    databaseId: string,
    title: string,
    markdown: string,
    category?: string
  ): Promise<NotionPage> {
    // Check if page with this title exists
    const existing = await this.queryDatabase(databaseId, {
      property: 'Title',
      title: { equals: title },
    });

    if (existing.length > 0) {
      return this.updatePage(existing[0].id, markdown);
    }

    return this.createPage(databaseId, title, markdown);
  }

  // ── Helpers ──

  private goalToMarkdown(goal: { topic: string; goal: string; template: string; status: string; priority: number; created: string }): string {
    return [
      `## Goal`,
      goal.goal,
      ``,
      `## Template`,
      goal.template,
      ``,
      `## Status`,
      goal.status,
      ``,
      `## Priority`,
      `${goal.priority}/10`,
      ``,
      `## Created`,
      goal.created,
      ``,
      `---`,
      `_Synced from Resonant Command Center_`,
    ].join('\n');
  }
}
