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

function updateNotionPageFields(pageId, fields) {
  const notionApiKey = getNotionApiKey_();
  if (!notionApiKey) throw new Error("Notion API key not configured");
  const url = `${CONFIG.NOTION_API_URL}/pages/${pageId}`;
  const properties = {};
  if (fields.product_manager) properties["PM"] = { people: [{ name: fields.product_manager }] };
  if (fields.pa) properties["PA"] = { people: [{ name: fields.pa }] };
  if (fields.client_health) properties["Health"] = { select: { name: fields.client_health } };
  if (fields.account_prioritisation) properties["Tier"] = { select: { name: fields.account_prioritisation } };
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
  return response.getResponseCode() === 200;
}
