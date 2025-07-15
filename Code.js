// Code.js
// Main orchestrator for syncing HubSpot → Notion
// Uses Config.js, HubSpotAPI.js, NotionAPI.js

function logToSheet(message) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var logSheet = ss.getSheetByName(CONFIG.SHEETS.LOGS);
    if (!logSheet) {
      logSheet = ss.insertSheet(CONFIG.SHEETS.LOGS);
      logSheet.appendRow(["Timestamp", "Message"]);
    }
    logSheet.appendRow([new Date(), message]);
  } catch (e) {
    console.log("Error logging to sheet: " + e.toString());
  }
}

function syncHubSpotToNotion() {
  try {
    logToSheet("syncHubSpotToNotion: Start");
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var hubspotSheet = ss.getSheetByName(CONFIG.SHEETS.HUBSPOT_CONTACTS);
    if (!hubspotSheet) throw new Error("Hubspot Contacts sheet not found");
    var data = hubspotSheet.getDataRange().getValues();
    if (data.length <= 1) throw new Error("No data in Hubspot Contacts sheet");
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var clientName = row[0] ? row[0].toString().trim() : "";
      var contactId = row[1] ? row[1].toString().trim() : "";
      var notionPageId = row[8] ? row[8].toString().trim() : ""; // Column I (index 8)
      if (!clientName || !contactId) continue; // Only sync if Contact ID exists
      try {
        var hubspotFields = fetchHubSpotContactFields(contactId);
        // Map PM and PA using mappings
        var mappedPm = CONFIG.PM_MAPPINGS[hubspotFields.product_manager] || hubspotFields.product_manager || "";
        var mappedPa = CONFIG.PA_MAPPINGS[hubspotFields.pa] || hubspotFields.pa || "";
        var mappedTier = CONFIG.TIER_MAPPINGS[hubspotFields.account_prioritisation] || hubspotFields.account_prioritisation || "";

        // --- Sync HubSpot data back to Google Sheet ---
        var valuesToUpdate = [
          [
            hubspotFields.hubspot_owner_id || "", // Column C: Account Manager
            hubspotFields.product_manager || "",  // Column D: Product Manager
            hubspotFields.client_health || "",    // Column E: Client Health
            mappedTier,                           // Column F: Tier
            mappedPa,                             // Column G: PA
            hubspotFields.hs_content_membership_status || "" // Column H: Thoughtleadr KPI
          ]
        ];
        hubspotSheet.getRange(i + 1, 3, 1, 6).setValues(valuesToUpdate);
        logToSheet(`Updated Google Sheet for ${clientName}`);
        // -----------------------------------------

        var pmUserIds = [];
        if (mappedPm && CONFIG.PM_ID_MAPPINGS[mappedPm]) {
          pmUserIds.push({ id: CONFIG.PM_ID_MAPPINGS[mappedPm] });
          logToSheet(`Using mapped Notion User ID for PM: ${mappedPm}`);
        } else if (mappedPm) {
          logToSheet(`No mapped ID for PM: ${mappedPm}. Looking up via API...`);
          var userIdObjects = getNotionUserIdsByName(mappedPm);
          if (userIdObjects.length > 0) {
            pmUserIds = userIdObjects;
          }
        }

        // If Notion Page ID is not present, search by client name and store it
        if (!notionPageId) {
          notionPageId = findNotionPageByClientName(clientName);
          if (notionPageId) {
            hubspotSheet.getRange(i + 1, 9).setValue(notionPageId);
            logToSheet(`Found and cached Notion Page ID for ${clientName}: ${notionPageId}`);
          } else {
            logToSheet(`No Notion page found for client: ${clientName}`);
            continue;
          }
        }

        if (notionPageId) {
          updateNotionPageFields(notionPageId, pmUserIds, mappedPa, hubspotFields.client_health, mappedTier);
          logToSheet(`Updated Notion page for ${clientName} | PM: ${(pmUserIds && pmUserIds.length > 0) ? pmUserIds.map(u => u.id).join(',') : mappedPm} | PA: ${mappedPa} | Client Health: ${hubspotFields.client_health || ''} | Tier: ${mappedTier} | Notion Page ID: ${notionPageId}`);
        }
      } catch (err) {
        logToSheet(`Error syncing client ${clientName}: ${err}`);
      }
    }
    logToSheet("syncHubSpotToNotion: Complete");
  } catch (e) {
    logToSheet("syncHubSpotToNotion: Fatal error: " + e.toString());
  }
}

/**
 * One-time setup function to store API keys and other secrets in Script Properties.
 * Run this function once from the Apps Script editor.
 */
function _setupScriptProperties() {
  PropertiesService.getScriptProperties().setProperties({
    [CONFIG.HUBSPOT_API_TOKEN_PROP]: 'YOUR_HUBSPOT_API_TOKEN', // Replace with your HubSpot Token
    [CONFIG.NOTION_API_KEY_PROP]: 'YOUR_NOTION_API_KEY',   // Replace with your Notion Key
    [CONFIG.NOTION_DB_ID_PROP]: '1316d5c88b1d8089a319de1867b56c70'      // Replace with your Notion DB ID
  });
  Logger.log('Script properties have been set successfully.');
}

function setupDailySyncTrigger() {
  // Remove existing triggers for this function
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "syncHubSpotToNotion") {
      ScriptApp.deleteTrigger(triggers[i]);
      logToSheet("Removed existing trigger for syncHubSpotToNotion");
    }
  }
  // Create new trigger at 9:00 AM IST
  ScriptApp.newTrigger("syncHubSpotToNotion")
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .inTimezone("Asia/Kolkata")
    .create();
  logToSheet("Created daily trigger for syncHubSpotToNotion at 9:00 AM IST");
}
