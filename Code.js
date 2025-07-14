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
      if (!clientName || !contactId) continue;
      try {
        var hubspotFields = fetchHubSpotContactFields(contactId);
        // Map PM and PA using mappings
        var mappedPm = CONFIG.PM_MAPPINGS[hubspotFields.product_manager] || hubspotFields.product_manager || "";
        var mappedPa = CONFIG.PA_MAPPINGS[hubspotFields.pa] || hubspotFields.pa || "";
        var mappedTier = CONFIG.TIER_MAPPINGS[hubspotFields.account_prioritisation] || hubspotFields.account_prioritisation || "";
        var notionPageId = findNotionPageByClientName(clientName);
        if (!notionPageId) {
          logToSheet(`No Notion page for client: ${clientName}`);
          continue;
        }
        var notionFields = {
          product_manager: mappedPm,
          pa: mappedPa,
          client_health: hubspotFields.client_health || "",
          account_prioritisation: mappedTier
        };
        var updated = updateNotionPageFields(notionPageId, notionFields);
        logToSheet(`Updated Notion page for ${clientName}: ${updated}`);
        Utilities.sleep(100); // API rate limit
      } catch (err) {
        logToSheet(`Error syncing client ${clientName}: ${err}`);
      }
    }
    logToSheet("syncHubSpotToNotion: Complete");
  } catch (e) {
    logToSheet("syncHubSpotToNotion: Fatal error: " + e.toString());
  }
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
