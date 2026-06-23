const https = require('https');
const k = process.env['NOTION_API_KEY'];
const rqId = 'bc1c86cb-1631-4f16-8952-92523a965bc1';
const wikiId = '6506df75-ca99-4471-ae08-1aaf146c2bd5';
const kanbanId = 'ea31f444-a250-4df3-8408-4167847c9ba5';

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const r = https.request({
      hostname: 'api.notion.com', path, method,
      headers: { 'Authorization': 'Bearer ' + k, 'Notion-Version': '2025-09-03', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => { let c = ''; res.on('data', d => c += d); res.on('end', () => resolve({status: res.statusCode, body: c})); });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  // First, let's see what properties each database has
  for (const [name, id] of [['RQ', rqId], ['Wiki', wikiId], ['Kanban', kanbanId]]) {
    const db = await req('GET', '/v1/databases/' + id);
    const props = JSON.parse(db.body).properties || {};
    console.log(name + ' properties:', Object.keys(props).join(', '));
  }

  // Add research goals to RQ using 'Name' as the title property
  const goals = [
    { name: 'GRPO Distributed Training', priority: 9 },
    { name: 'DiLoCo vs FetchSGD', priority: 8 },
    { name: 'Softmax tau Attention', priority: 10 },
  ];

  for (const g of goals) {
    const r = await req('POST', '/v1/pages', {
      parent: { database_id: rqId },
      properties: {
        'Name': { title: [{ text: { content: g.name } }] }
      }
    });
    console.log('Goal:', g.name, r.status === 200 ? 'OK' : 'FAIL');
  }
}
main().catch(console.error);
