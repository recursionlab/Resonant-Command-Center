#!/usr/bin/env node
/**
 * Notion API Bridge Script
 * 
 * Handles Notion API authentication, CRUD, and queries.
 * Works on Windows (no ntn dependency) via HTTP + fetch.
 * 
 * Usage:
 *   node scripts/notion-sync.mjs --test-connection
 *   node scripts/notion-sync.mjs search --query "Research"
 *   node scripts/notion-sync.mjs create-page --database-id XXX --title "Title" --markdown-file content.md
 *   node scripts/notion-sync.mjs query-database --database-id XXX
 *   node scripts/notion-sync.mjs sync-queue --database-id XXX --markdown-file queue.md
 * 
 * Architectural constraint: Minimum 300000ms (5 min) between any agent-initiated API call.
 */

const NOTION_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = '2025-09-03';
const BASE_URL = 'https://api.notion.com/v1';
const DELAY_MS = 300000; // 5 minutes between API calls

// ── HTTP Helper ──

async function notionRequest(method, path, body = null, delayMs = DELAY_MS) {
  if (!NOTION_KEY) {
    console.error('ERROR: NOTION_API_KEY environment variable is not set');
    process.exit(1);
  }

  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${NOTION_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  // Enforce minimum delay between API calls
  if (delayMs > 0) {
    await new Promise(r => setTimeout(r, delayMs));
  }

  const res = await fetch(`${BASE_URL}${path}`, opts);
  
  if (!res.ok) {
    const errText = await res.text();
    let errMsg;
    try {
      const errJson = JSON.parse(errText);
      errMsg = errJson?.error?.message || errText;
    } catch {
      errMsg = errText;
    }
    
    if (res.status === 401) {
      console.error('ERROR: Notion API authentication failed. Check NOTION_API_KEY.');
    } else if (res.status === 404) {
      console.error('ERROR: Notion resource not found. Ensure the database/page is shared with the integration.');
    } else if (res.status === 429) {
      console.error('ERROR: Notion rate limit exceeded. Wait and retry.');
    } else {
      console.error(`ERROR: Notion API ${res.status}: ${errMsg}`);
    }
    process.exit(1);
  }

  return res.json();
}

// ── Commands ──

async function testConnection() {
  console.log('Testing Notion API connection...');
  const data = await notionRequest('POST', '/search', { page_size: 100 }, 0);
  
  const databases = data.results?.filter(r => r.object === 'data_source' || r.object === 'database') || [];
  
  if (databases.length === 0) {
    console.log('✓ Connection successful, but no databases found.');
    console.log('  → Share databases with your Notion integration to use them.');
    console.log('  → Go to page menu (...) → Connect to → [Your Integration]');
  } else {
    console.log(`✓ Connection successful — ${databases.length} database(s) accessible:`);
    for (const db of databases) {
      const title = db.title?.[0]?.plain_text || 'Untitled';
      console.log(`  - ${title}`);
      console.log(`    database_id: ${db.id}`);
      if (db.data_source_id) {
        console.log(`    data_source_id: ${db.data_source_id}`);
      }
    }
  }
}

async function searchNotion(query) {
  console.log(`Searching Notion for: "${query}"`);
  const data = await notionRequest('POST', '/search', { query }, 0);
  
  const results = data.results || [];
  if (results.length === 0) {
    console.log('No results found.');
    return;
  }
  
  console.log(`Found ${results.length} result(s):`);
  for (const r of results.slice(0, 10)) {
    const title = r.title?.[0]?.plain_text || r.properties?.Name?.title?.[0]?.plain_text || 'Untitled';
    console.log(`  - ${title} (${r.id})`);
  }
}

async function createPage(databaseId, title, markdown) {
  console.log(`Creating page "${title}" in database ${databaseId}...`);
  
  const body = {
    parent: { database_id: databaseId },
    properties: {
      Name: { title: [{ text: { content: title } }] },
    },
    markdown: markdown,
  };
  
  const data = await notionRequest('POST', '/pages', body);
  const pageId = data.id;
  const pageUrl = data.url;
  
  console.log(`✓ Page created:`);
  console.log(`  id:  ${pageId}`);
  console.log(`  url: ${pageUrl}`);
  
  // Output as JSON for programmatic use
  console.log(JSON.stringify({ id: pageId, url: pageUrl, title }, null, 2));
}

async function queryDatabase(databaseId, filter = null) {
  console.log(`Querying database ${databaseId}...`);
  
  const body = {
    page_size: 100,
  };
  if (filter) body.filter = filter;
  
  const data = await notionRequest('POST', `/data_sources/${databaseId}/query`, body);
  
  const results = data.results || [];
  console.log(`Found ${results.length} record(s):`);
  
  for (const page of results) {
    const title = page.properties?.Name?.title?.[0]?.plain_text || 'Untitled';
    const status = page.properties?.Status?.select?.name || '';
    console.log(`  - ${title}${status ? ` [${status}]` : ''} (${page.id})`);
  }
}

async function syncQueueToDatabase(databaseId, markdownFile) {
  const fs = await import('fs');
  const markdown = fs.readFileSync(markdownFile, 'utf-8');
  
  // Parse markdown into queue items (## Heading per item)
  const items = markdown.split(/^## /m).filter(s => s.trim());
  
  console.log(`Syncing ${items.length} item(s) to Notion database ${databaseId}...`);
  console.log(`(5 minute delay between each API call)`);
  
  const results = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const lines = item.split('\n');
    const title = lines[0]?.trim() || `Item ${i + 1}`;
    const content = lines.slice(1).join('\n').trim();
    
    console.log(`  [${i + 1}/${items.length}] Syncing: ${title}`);
    
    try {
      await createPage(databaseId, title, content);
      results.push({ title, status: 'synced' });
    } catch (err) {
      console.error(`  ✗ Failed to sync "${title}": ${err.message}`);
      results.push({ title, status: 'failed', error: err.message });
    }
  }
  
  console.log(`\nSync complete: ${results.filter(r => r.status === 'synced').length}/${items.length} synced`);
}

// ── CLI ──

const [,, command, ...args] = process.argv;

function getFlag(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return null;
  return args[idx + 1];
}

async function main() {
  switch (command) {
    case 'test-connection':
    case 'test':
      await testConnection();
      break;
    
    case 'search': {
      const query = getFlag('query') || args[1];
      if (!query) {
        console.error('Usage: node scripts/notion-sync.mjs search --query "term"');
        process.exit(1);
      }
      await searchNotion(query);
      break;
    }
    
    case 'create-page': {
      const databaseId = getFlag('database-id');
      const title = getFlag('title');
      const markdownFile = getFlag('markdown-file');
      
      if (!databaseId || !title || !markdownFile) {
        console.error('Usage: node scripts/notion-sync.mjs create-page --database-id XXX --title "Title" --markdown-file path.md');
        process.exit(1);
      }
      
      const fs = await import('fs');
      const markdown = fs.readFileSync(markdownFile, 'utf-8');
      await createPage(databaseId, title, markdown);
      break;
    }
    
    case 'query-database': {
      const databaseId = getFlag('database-id');
      if (!databaseId) {
        console.error('Usage: node scripts/notion-sync.mjs query-database --database-id XXX');
        process.exit(1);
      }
      await queryDatabase(databaseId);
      break;
    }
    
    case 'sync-queue': {
      const databaseId = getFlag('database-id');
      const markdownFile = getFlag('markdown-file');
      
      if (!databaseId || !markdownFile) {
        console.error('Usage: node scripts/notion-sync.mjs sync-queue --database-id XXX --markdown-file queue.md');
        process.exit(1);
      }
      await syncQueueToDatabase(databaseId, markdownFile);
      break;
    }
    
    default:
      console.log(`
Notion API Bridge — CLI

Commands:
  test-connection                    Test API key and list accessible databases
  search --query "term"              Search Notion workspace
  create-page --database-id XXX --title "Title" --markdown-file path.md
  query-database --database-id XXX  List items in a database
  sync-queue --database-id XXX --markdown-file queue.md

Options:
  NOTION_API_KEY env var required for all commands

Examples:
  NOTION_API_KEY=ntn_xxx node scripts/notion-sync.mjs test-connection
  NOTION_API_KEY=ntn_xxx node scripts/notion-sync.mjs search --query "Research"
      `);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
