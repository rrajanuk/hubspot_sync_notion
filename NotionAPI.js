// NotionAPI.js
// Functions for interacting with Notion API (fetching, updating pages)

function getNotionApiKey_() {
  return PropertiesService.getScriptProperties().getProperty(CONFIG.NOTION_API_KEY_PROP);
}

function getNotionDatabaseId_() {
  return PropertiesService.getScriptProperties().getProperty(CONFIG.NOTION_DB_ID_PROP);
}

function findNotionPageByClientName(clientName) {
  const notionApiKey = getNotionApiKey_();
  const databaseId = getNotionDatabaseId_();
  if (!notionApiKey || !databaseId) throw new Error("Notion API key or Database ID not configured");
  const url = `${CONFIG.NOTION_API_URL}/databases/${databaseId}/query`;
  const payload = {
    filter: {
      property: "Client Name",
      title: { equals: clientName }
    }
  };
  const options = {
    method: "post",
    headers: {
      "Authorization": `Bearer ${notionApiKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) return null;
  const json = JSON.parse(response.getContentText());
  return (json.results && json.results.length > 0) ? json.results[0].id : null;
}

// Helper to get Notion userId(s) by name as a fallback
function getNotionUserIdsByName(names) {
  const notionApiKey = getNotionApiKey_();
  if (!notionApiKey) throw new Error("Notion API key not configured");
  if (!names) return [];
  const nameArr = names.split(',').map(s => s.trim()).filter(Boolean);
  const userIds = [];
  for (var i = 0; i < nameArr.length; i++) {
    const url = `${CONFIG.NOTION_API_URL}/users`;
    const options = {
      method: "get",
      headers: {
        "Authorization": `Bearer ${notionApiKey}`,
        "Notion-Version": "2022-06-28"
      },
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) continue;
    const users = JSON.parse(response.getContentText()).results || [];
    const user = users.find(u => u.name && u.name.trim().toLowerCase() === nameArr[i].toLowerCase());
    if (user && user.id) userIds.push({ id: user.id });
  }
  return userIds;
}

function updateNotionPageFields(pageId, pmUserIds, paName, clientHealth, tier) {
  const notionApiKey = getNotionApiKey_();
  if (!notionApiKey) throw new Error("Notion API key not configured");

  const url = `${CONFIG.NOTION_API_URL}/pages/${pageId}`;
  const properties = {};

  // PM as people property
  if (pmUserIds && pmUserIds.length > 0) {
    properties['PM'] = { people: pmUserIds };
  }

  // PA as multi_select option
  if (paName) {
    properties['PA'] = { multi_select: [{ name: paName }] };
  }

  // Client Health as select option
  if (clientHealth) {
    properties['Health'] = { select: { name: clientHealth } };
  }

  // Tier as select option
  if (tier) {
    properties['Tier'] = { select: { name: tier } };
  }

  if (Object.keys(properties).length === 0) {
    logToSheet(`No fields to update for pageId: ${pageId}`);
    return true; // Nothing to update
  }

  const payload = { properties };
  const options = {
    method: "patch",
    headers: {
      "Authorization": `Bearer ${notionApiKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    logToSheet(`Error updating Notion page ${pageId}. Status: ${responseCode}. Response: ${response.getContentText()}`);
    return false;
  }

  return true;
}
