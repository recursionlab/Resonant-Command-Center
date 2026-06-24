const https = require('https');
const fs = require('fs');
const path = require('path');

const k = process.env['NOTION_API_KEY'];
if (!k) { console.error('No NOTION_API_KEY'); process.exit(1); }

const RQ_DB_ID = 'bc1c86cb-1631-4f16-8952-92523a965bc1';
const WIKI_DB_ID = '6506df75-ca99-4471-ae08-1aaf146c2bd5';
const KANBAN_DB_ID = 'd06bf94c-2b46-4855-b88e-801b9dbca20a';

function req(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const r = https.request({
      hostname: 'api.notion.com', path: p, method,
      headers: {
        'Authorization': 'Bearer ' + k,
        'Notion-Version': '2025-09-03',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let c = '';
      res.on('data', d => c += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(c) }); }
        catch(e) { resolve({ status: res.statusCode, body: c }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function rf(fp) { return fs.readFileSync(fp, 'utf8'); }

async function main() {
  const results = [];

  console.log('=== SYNCING RESEARCH TO NOTION ===\n');

  // Research Queue - add research goals
  console.log('--- Research Queue Database ---');
  const goals = [
    { title: 'GRPO Distributed Training Optimization', file: 'wiki/raw/grpo-distributed-training/survey.md' },
    { title: 'DiLoCo vs FetchSGD Communication Efficiency', file: 'wiki/raw/diloco-vs-fetchsgd/compare.md' },
    { title: 'LoRA-GA for Knowledge Graph Embeddings', file: 'wiki/raw/lora-ga-knowledge-graph/research_report.md' },
  ];

  for (const g of goals) {
    const r = await req('POST', '/v1/pages', {
      parent: { database_id: RQ_DB_ID },
      properties: { 'Name': { title: [{ text: { content: g.title } }] } },
      markdown: rf(g.file),
    });
    console.log('  ' + (r.status === 200 ? 'OK' : 'FAIL') + ' - ' + g.title);
    results.push(r.status === 200);
  }

  // Wiki database - add wiki pages
  console.log('\n--- Wiki Database ---');
  const wikiPages = [
    { title: 'GRPO Distributed Training', file: 'wiki/raw/grpo-distributed-training/survey.md' },
    { title: 'DiLoCo vs FetchSGD', file: 'wiki/raw/diloco-vs-fetchsgd/compare.md' },
    { title: 'LoRA-GA Knowledge Graph Embeddings', file: 'wiki/raw/lora-ga-knowledge-graph/research_report.md' },
  ];

  for (const p of wikiPages) {
    const r = await req('POST', '/v1/pages', {
      parent: { database_id: WIKI_DB_ID },
      properties: { 'Name': { title: [{ text: { content: p.title } }] } },
      markdown: rf(p.file),
    });
    console.log('  ' + (r.status === 200 ? 'OK' : 'FAIL') + ' - ' + p.title);
    results.push(r.status === 200);
  }

  // Agent Tasks - add to Kanban
  console.log('\n--- Agent Tasks Kanban ---');
  const tasks = [
    'Review GRPO findings and integrate with pipeline',
    'Evaluate DiLoCo for federated lattice architecture',
    'Test LoRA-GA initialization on tau_attention module',
  ];

  for (const t of tasks) {
    const r = await req('POST', '/v1/pages', {
      parent: { database_id: KANBAN_DB_ID },
      properties: { 'Task': { title: [{ text: { content: t } }] } },
    });
    console.log('  ' + (r.status === 200 ? 'OK' : 'FAIL') + ' - ' + t.substring(0, 40));
    results.push(r.status === 200);
  }

  console.log('\n=== RESULTS: ' + results.filter(r=>r).length + '/' + results.length + ' passed ===');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
