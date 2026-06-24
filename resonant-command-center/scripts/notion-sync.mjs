#!/usr/bin/env node
/**
 * notion-sync.mjs — Notion API Bridge Script
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

// ── Configured Databases ──
const DATABASES = {
  researchQueue: {
    name: 'Omnigent Research Queue',
    databaseId: 'bc1c86cb-1631-4f16-8952-92523a965bc1',
    dataSourceId: '2371c3ca-0ac7-4218-8d9d-f9e9f94de227',
  },
  wiki: {
    name: 'Omnigent Wiki',
    databaseId: '6506df75-ca99-4471-ae08-1aaf146c2bd5',
    dataSourceId: 'fe1060fd-8314-49bc-958d-b84215653cba',
  },
  agentTasks: {
    name: 'Omnigent Agent Tasks',
    databaseId: 'ea31f444-a250-4df3-8408-4167847c9ba5',
    dataSourceId: '6b0f070e-0900-4ad9-a033-af320138383d',
  },
};

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
      console.error('ERROR: Notion resource not found. Ensure database is shared with integration.');
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
  const data = await notionRequest('GET', '/users/me', null, 0);
  
  if (data) {
    console.log('✓ Connection successful — authenticated as:', data.name || data.display_name || 'unknown');
    console.log('  Configured databases:');
    for (const [key, db] of Object.entries(DATABASES)) {
      console.log(`  - ${db.name}: ${db.databaseId}`);
    }
  }

async function syncQueueToDatabase(dbKey) {
  const db = DATABASES[dbKey];
  if (!db) {
    console.error(`ERROR: Unknown database key "${dbKey}". Available: ${Object.keys(DATABASES).join(', ')}`);
    process.exit(1);
  }
  
  console.log(`Syncing research queue to "${db.name}"...`);
  console.log(`(5 minute delay between each API call)`);
  
  // Read queue from research_queue.md
  const fs = await import('fs');
  let markdown;
  try {
    markdown = fs.readFileSync('research_queue.md', 'utf-8');
  } catch (err) {
    console.error('ERROR: Could not read research_queue.md:', err.message);
    process.exit(1);
  }
  
  // Parse active topics from markdown
  const sections = markdown.split(/^## /m).filter(s => s.includes('topic:'));
  const items = sections.map(s => {
    const lines = s.split('\n');
    const titleLine = lines.find(l => l.includes('topic:'));
    const title = titleLine?.replace(/.*topic:\s*/, '').replace(/["']/g, '').trim() || 'Untitled';
    const content = lines.slice(0, 5).join('\n').trim();
    return { title, content };
  });
  
  console.log(`Found ${items.length} items to sync`);
  
  const results = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`  [${i + 1}/${items.length}] Syncing: ${item.title}`);
    
    try {
      const body = {
        parent: { database_id: db.databaseId },
        properties: {
          Name: { title: [{ text: { content: item.title } }] },
        },
        markdown: item.content,
      };
      
      await notionRequest('POST', '/pages', body);
      results.push({ title: item.title, status: 'synced' });
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
      results.push({ title: item.title, status: 'failed', error: err.message });
    }
  }
  
  console.log(`\nSync complete: ${results.filter(r => r.status === 'synced').length}/${items.length} synced`);
}

async function queryDatabase(dbKey) {
  const db = DATABASES[dbKey];
  if (!db) {
    console.error(`ERROR: Unknown database key "${dbKey}"`);
    process.exit(1);
  }
  
  console.log(`Querying "${db.name}"...`);
  const data = await notionRequest('POST', `/data_sources/${db.dataSourceId}/query`, {});
  
  const results = data.results || [];
  console.log(`${results.length} pages:`);
  for (const p of results) {
    const name = p.properties?.Name?.title?.[0]?.plain_text || '(untitled)';
    const created = p.created_time?.slice(0, 10) || '';
    console.log(`  • ${name} [${created}]`);
  }
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
    
    case 'sync-queue': {
      const dbKey = getFlag('db') || 'researchQueue';
      await syncQueueToDatabase(dbKey);
      break;
    }
    
    case 'query': {
      const dbKey = getFlag('db') || 'researchQueue';
      await queryDatabase(dbKey);
      break;
    }
    
    case 'list-all':
      for (const [key, db] of Object.entries(DATABASES)) {
        console.log(`\n=== ${db.name} ===`);
        const data = await notionRequest('POST', `/v1/data_sources/${db.dataSourceId}/query`, {}, 0);
        const results = data.results || [];
        console.log(`${results.length} pages:`);
        for (const p of results) {
          const name = p.properties?.Name?.title?.[0]?.plain_text || '(untitled)';
          const created = p.created_time?.slice(0, 10) || '';
          console.log(`  • ${name} [${created}]`);
        }
      }
      break;
    
    default:
      console.log(`
Notion API Bridge — CLI

Commands:
  test-connection              Test API key and list accessible databases
  sync-queue --db <key>        Sync research_queue.md to Notion (keys: researchQueue, wiki, agentTasks)
  query --db <key>             List pages in a database
  list-all                     List all pages across all configured databases

Examples:
  node scripts/notion-sync.mjs test-connection
  node scripts/notion-sync.mjs sync-queue --db researchQueue
  node scripts/notion-sync.mjs query --db wiki
  node scripts/notion-sync.mjs list-all
      `);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
