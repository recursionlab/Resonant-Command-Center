# Notion Integration Setup

## Databases Created

| Database | ID | URL |
|----------|-----|-----|
| Omnigent Research Queue | `bc1c86cb-1631-4f16-8952-92523a965bc1` | https://app.notion.com/p/bc1c86cb16314f16895292523a965bc1 |
| Omnigent Wiki | `6506df75-ca99-4471-ae08-1aaf146c2bd5` | https://app.notion.com/p/6506df75ca994471ae081aaf146c2bd5 |
| Omnigent Agent Tasks | `ea31f444-a250-4df3-8408-4167847c9ba5` | https://app.notion.com/p/ea31f444a2504df384084167847c9ba5 |

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
