// HubSpotAPI.js
// Functions for interacting with HubSpot API (fetching, updating contacts)

function getHubSpotApiToken_() {
  return PropertiesService.getScriptProperties().getProperty(CONFIG.HUBSPOT_API_TOKEN_PROP);
}

function fetchHubSpotContactFields(contactId) {
  const apiToken = getHubSpotApiToken_();
  if (!apiToken) throw new Error("HubSpot API token not configured");
  const url = `${CONFIG.HUBSPOT_API_URL}/${contactId}?properties=product_manager,pa,client_health,account_prioritisation`;
  const options = {
    method: "get",
    headers: { "Authorization": `Bearer ${apiToken}` },
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) throw new Error(response.getContentText());
  return JSON.parse(response.getContentText()).properties;
}

function updateHubSpotContactFields(contactId, fields) {
  const apiToken = getHubSpotApiToken_();
  if (!apiToken) throw new Error("HubSpot API token not configured");
  const url = `${CONFIG.HUBSPOT_API_URL}/${contactId}`;
  const payload = { properties: fields };
  const options = {
    method: "patch",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(url, options);
  return response.getResponseCode() === 200;
}

function searchHubSpotContactByName(clientName) {
  const apiToken = getHubSpotApiToken_();
  if (!apiToken) throw new Error("HubSpot API token not configured");
  const firstWord = clientName.trim().split(" ")[0] || "";
  if (!firstWord) return "";
  const url = `${CONFIG.HUBSPOT_API_URL}/search`;
  const properties = ["firstname", "lastname", "product_manager", "pa", "client_health", "account_prioritisation", "hs_content_membership_status", "hubspot_owner_id"];
  const payload = {
    filterGroups: [{ filters: [{ propertyName: "firstname", operator: "CONTAINS_TOKEN", value: firstWord }] }],
    properties: properties,
    limit: 10
  };
  const options = {
    method: "post",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) return "";
  const json = JSON.parse(response.getContentText());
  if (json.results && json.results.length > 0) {
    for (const contact of json.results) {
      const fullName = `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim();
      if (clientName.toLowerCase().includes(fullName.toLowerCase())) {
        return contact.id;
      }
    }
  }
  return "";
}
