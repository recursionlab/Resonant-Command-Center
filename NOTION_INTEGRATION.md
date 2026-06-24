# Notion Integration Setup

## Databases Created

| Database | ID | URL |
|----------|-----|-----|
| Omnigent Research Queue | `bc1c86cb-1631-4f16-8952-92523a965bc1` | https://app.notion.com/p/bc1c86cb16314f16895292523a965bc1 |
| Omnigent Wiki | `6506df75-ca99-4471-ae08-1aaf146c2bd5` | https://app.notion.com/p/6506df75ca994471ae081aaf146c2bd5 |
| Omnigent Agent Tasks | `d06bf94c-2b46-4855-b88e-801b9dbca20a` | https://app.notion.com/p/d06bf94c2b464855b88e801b9dbca20a |

## ⚠️ Action Required: Re-share Parent Page

**Problem:** The parent page (`b80bc9dc-9867-8255-9fc6-01e64179c843`) lost its integration connection after the Kanban database was archived and recreated. All page creation attempts return 400.

**Fix (manual, one-time):**
1. Go to https://app.notion.com/p/b80bc9dc986782559fc601e64179c843
2. Click `...` menu → **Connections** → find your integration → **Connect**
3. After re-connection, the Kanban database and all child pages will work again

**Why this happens:** When a database is archived/recreated, Notion may reset the parent page's integration connections. This is a Notion API limitation.

## API Key
- Stored in environment as `NOTION_API_KEY`
- API Version: `2025-09-03`
- Workspace: "Agent's Space"

## Usage

### Create a research goal page
```bash
curl -s -X POST "https://api.notion.com/v1/pages" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "parent": {"database_id": "bc1c86cb-1631-4f16-8952-92523a965bc1"},
    "properties": {
      "Name": {"title": [{"text": {"content": "New Research Goal"}}]}
    }
  }'
```

### Query the research queue
```bash
curl -s -X POST "https://api.notion.com/v1/data_sources/2371c3ca-0ac7-4218-8d9d-f9e9f94de227/query" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{"filter": {"property": "Status", "select": {"equals": "Pending"}}}'
```

## Notes
- Databases use `data_source_id` for queries (not `database_id`)
- Parent for page creation uses `database_id`
- The `ntn` CLI is not installed; use curl or the node script at `scripts/setup_notion.js`
- Integration token has access to the workspace but pages/databases must be shared with the integration explicitly
