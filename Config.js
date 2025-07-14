// Config.js
// Central configuration for API endpoints, spreadsheet IDs, and mappings

const CONFIG = {
  SPREADSHEET_ID: "1yNEOzQr7F0P1FmEhgThqpqDXS_JddpIy1feiBniH1ek",
  HUBSPOT_API_URL: "https://api.hubapi.com/crm/v3/objects/contacts",
  NOTION_API_URL: "https://api.notion.com/v1",
  NOTION_DB_ID_PROP: "NOTION_DATABASE_ID",
  NOTION_API_KEY_PROP: "NOTION_API_KEY",
  HUBSPOT_API_TOKEN_PROP: "HUBSPOT_API_TOKEN",
  SHEETS: {
    CLIENT_MASTER: "Client Master",
    HUBSPOT_CONTACTS: "Hubspot Contacts",
    LOGS: "Logs"
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
    'Tier 1 → GTM clients': "High Growth",
    'Tier 2a → GTM trial (On retainer)': "Flat Renewal",
    'Tier 3 → Not yet GTM trial': "Tier 3 ? Not yet GTM trial",
    'Tier 2b → GTM trial (not on retainer)': "Tier 2b ? GTM trial (not on retainer)",
    'Tier 4 → Content only ICP': "Non-ICP",
    'Tier 5 → Content only not-ICP': "definitely deprio"
  }
};

function getConfig() {
  return CONFIG;
}
