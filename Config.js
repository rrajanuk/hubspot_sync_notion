// Config.js
// Central configuration for API endpoints, spreadsheet IDs, and mappings

const CONFIG = {
  SPREADSHEET_ID: "1yNEOzQr7F0P1FmEhgThqpqDXS_JddpIy1feiBniH1ek",
  HUBSPOT_API_URL: "https://api.hubapi.com/crm/v3/objects/contacts",
  NOTION_API_URL: "https://api.notion.com/v1",
  NOTION_DB_ID_PROP: "1316d5c88b1d8089a319de1867b56c70",
  NOTION_API_KEY_PROP: "NOTION_API_KEY",
  HUBSPOT_API_TOKEN_PROP: "HUBSPOT_API_TOKEN",
  SHEETS: {
    CLIENT_MASTER: "Client Master",
    HUBSPOT_CONTACTS: "Hubspot Contacts",
    LOGS: "Logs"
  },
  PM_ID_MAPPINGS: {
    'Phil Saunes': '17bd872b-594c-81dd-96c3-000243db83c4',
    'Nooch Saeedi': '214d872b-594c-817e-a31d-0002252e6781',
    'Hosun Chung': 'e2928d49-d1cd-4996-81f1-c69eaa5712bb',
    'Ben Carden': '19bd872b-594c-8121-824f-000241c4dcc8',
    'Lewis Waldron': '19bd872b-594c-8121-824f-000241c4dcc8'
    // Add other PMs with their Notion User IDs here
  },
  PM_MAPPINGS: {
    'Lewis': 'Lewis Waldron',
    'Phil': 'Phil Saunes',
    'Nooch': 'Nooch Saeedi'
    // Add more as needed
  },
  PA_MAPPINGS: {
    'Robin': 'Robin Rajan',
    'Alex': 'Alex Smith'
    // Extend as needed
  },
  TIER_MAPPINGS: {
    'High Growth': 'Tier 1 → GTM clients',
    'Flat Renewal': 'Tier 2a → GTM trial (On retainer)',
    'Tier 3 → Not yet GTM trial': 'Tier 3 → Not yet GTM trial',
    'Tier 2b → GTM trial (not on retainer)': 'Tier 2b → GTM trial (not on retainer)',
    'Non-ICP': 'Tier 4 → Content only ICP',
    'definitely deprio': 'Tier 5 → Content only not-ICP'
  }
};

function getConfig() {
  return CONFIG;
}
