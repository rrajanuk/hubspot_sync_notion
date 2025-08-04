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

function getNotionPageStatus(pageId) {
  const notionApiKey = getNotionApiKey_();
  if (!notionApiKey) throw new Error("Notion API key not configured");

  const url = `${CONFIG.NOTION_API_URL}/pages/${pageId}`;
  const options = {
    method: "get",
    headers: {
      "Authorization": `Bearer ${notionApiKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28"
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    // It's better to throw an error to be caught by the calling function
    throw new Error(`Failed to fetch Notion page ${pageId}. Status: ${responseCode}. Response: ${response.getContentText()}`);
  }

  const json = JSON.parse(response.getContentText());
  const statusProp = json.properties['Status'];

  // Handle 'multi_select' property type
  if (statusProp && statusProp.type === 'multi_select' && statusProp.multi_select && statusProp.multi_select.length > 0) {
    return statusProp.multi_select.map(option => option.name).join(', ');
  }

  // Handle 'status' property type as a fallback, just in case
  if (statusProp && statusProp.type === 'status' && statusProp.status) {
    return statusProp.status.name;
  }

  return null; // Return null if status is not found or the property type is wrong
}

function updateNotionPageFields(pageId, pmUserIds, paName, clientHealth, tier, clientStatus, accountManager, tierReasoning) {
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

  // Client Status as multi-select option
  if (clientStatus) {
    properties['Status'] = { multi_select: [{ name: clientStatus }] };
  }

  // Account Manager as select option
  if (accountManager) {
    properties['Account Manager'] = { select: { name: accountManager } };
  }

  // Tier Reasoning as rich_text
  if (tierReasoning) {
    properties['Tier Reasoning'] = { rich_text: [{ text: { content: tierReasoning } }] };
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
