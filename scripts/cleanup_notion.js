const https = require('https');
const k = process.env['NOTION_API_KEY'];

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

async function main() {
  // Get all pages from Research Queue
  const dsId = '2371c3ca-0ac7-4218-8d9d-f9e9f94de227';
  const all = await req('POST', `/v1/data_sources/${dsId}/query`, { page_size: 100 });
  const pages = all.body.results || [];
  console.log(`Found ${pages.length} pages in Research Queue`);

  // Identify duplicates (keep first occurrence of each title)
  const seen = new Set();
  const toArchive = [];

  for (const p of pages) {
    const title = p.properties?.Name?.title?.[0]?.plain_text || '(untitled)';
    if (seen.has(title)) {
      toArchive.push({ id: p.id, title });
    } else {
      seen.add(title);
    }
  }

  console.log(`Archiving ${toArchive.length} duplicate pages...`);
  for (const p of toArchive) {
    const r = await req('PATCH', `/v1/pages/${p.id}`, { archived: true });
    console.log(`  Archived: ${p.title.substring(0, 40)} (${r.status})`);
  }

  // Also clean up Wiki database
  const wikiDsId = '6506df75-ca99-4471-ae08-1aaf146c2bd5';
  // Get the data_source_id for wiki
  const wikiDb = await req('GET', '/v1/databases/6506df75-ca99-4471-ae08-1aaf146c2bd5');
  const wikiDs = wikiDb.body?.data_sources?.[0]?.id;
  if (wikiDs) {
    const wikiPages = await req('POST', `/v1/data_sources/${wikiDs}/query`, { page_size: 100 });
    const wp = wikiPages.body.results || [];
    console.log(`\nWiki: Found ${wp.length} pages`);
    const wikiSeen = new Set();
    const wikiArchive = [];
    for (const p of wp) {
      const title = p.properties?.Name?.title?.[0]?.plain_text || '(untitled)';
      if (wikiSeen.has(title)) {
        wikiArchive.push({ id: p.id, title });
      } else {
        wikiSeen.add(title);
      }
    }
    console.log(`Archiving ${wikiArchive.length} duplicate wiki pages...`);
    for (const p of wikiArchive) {
      const r = await req('PATCH', `/v1/pages/${p.id}`, { archived: true });
      console.log(`  Archived: ${p.title.substring(0, 40)} (${r.status})`);
    }
  }

  console.log('\n=== Cleanup complete ===');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
