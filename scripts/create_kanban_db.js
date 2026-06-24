const https = require('https');
const k = process.env['NOTION_API_KEY'];
const parentId = 'b80bc9dc-9867-8255-9fc6-01e64179c843';

const body = JSON.stringify({
  parent: { type: 'page_id', page_id: parentId },
  title: [{ text: { content: 'Omnigent Agent Tasks' } }],
  description: [{ text: { content: 'Multi-agent task tracking for the Omnigent orchestration pipeline.' } }],
  properties: {
    'Task': { title: {} },
    'Status': { status: { options: [
      { name: 'To Do', color: 'default' },
      { name: 'In Progress', color: 'blue' },
      { name: 'Done', color: 'green' },
      { name: 'Blocked', color: 'red' }
    ]}},
    'Agent': { select: { options: [
      { name: 'Research', color: 'purple' },
      { name: 'Synthesis', color: 'pink' },
      { name: 'Curation', color: 'yellow' }
    ]}},
    'Priority': { select: { options: [
      { name: 'High', color: 'red' },
      { name: 'Medium', color: 'yellow' },
      { name: 'Low', color: 'green' }
    ]}},
    'Due Date': { date: {} },
    'Created': { created_time: {} }
  }
});

const r = https.request({
  hostname: 'api.notion.com', path: '/v1/databases', method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + k,
    'Notion-Version': '2025-09-03',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
}, (res) => {
  let c = '';
  res.on('data', d => c += d);
  res.on('end', () => {
    const d = JSON.parse(c);
    console.log('Status:', res.statusCode);
    if (d.id) {
      console.log('DB ID:', d.id);
      console.log('DS ID:', d.data_sources?.[0]?.id);
      console.log('URL:', d.url);
    } else {
      console.log('Error:', d.error?.message || c.substring(0, 200));
    }
  });
});
r.write(body);
r.end();
