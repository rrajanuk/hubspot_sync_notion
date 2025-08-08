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
            hubspotFields.account_manager || "", // Column C: Account Manager
            hubspotFields.product_manager || "",  // Column D: Product Manager
            hubspotFields.client_health || "",    // Column E: Client Health
            mappedTier,                           // Column F: Tier
            mappedPa,                             // Column G: PA
            hubspotFields.hs_content_membership_status || "" // Column H: Thoughtleadr KPI
          ]
        ];
        // Update existing fields
        hubspotSheet.getRange(i + 1, 3, 1, 6).setValues(valuesToUpdate);

        // --- Client Status and Churned Timestamp Logic ---
        var oldClientStatus = hubspotSheet.getRange(i + 1, 10).getValue().toString().trim();
        var newClientStatus = hubspotFields.client_status || "";

        hubspotSheet.getRange(i + 1, 10).setValue(newClientStatus); // Update Column J: Client Status

        // Log old and new status for every row
        logToSheet(`Client '${clientName}' old status: '${oldClientStatus}', new status: '${newClientStatus}'`);
        // Rule 1: If status changes to "churned" for the first time, set timestamp.
        if (newClientStatus.toLowerCase() === 'churned' && oldClientStatus.toLowerCase() !== 'churned') {
          hubspotSheet.getRange(i + 1, 12).setValue(new Date()); // Column L: Churned Timestamp
          logToSheet(`Client '${clientName}' status changed to 'churned'. Timestamp added.`);
        } 
        // Rule 2: If status changes from "churned" to something else, clear timestamp.
        else if (newClientStatus.toLowerCase() !== 'churned' && oldClientStatus.toLowerCase() === 'churned') {
          hubspotSheet.getRange(i + 1, 12).clearContent(); // Column L: Clear Timestamp
          logToSheet(`Client '${clientName}' status changed from 'churned'. Timestamp cleared.`);
        } else if (newClientStatus.toLowerCase() !== 'churned' && oldClientStatus.toLowerCase() !== 'churned') {
          // Status unchanged and not churned
          logToSheet(`Client '${clientName}' status unchanged and not churned. No timestamp action.`);
        } else if (newClientStatus.toLowerCase() === 'churned' && oldClientStatus.toLowerCase() === 'churned') {
          // Already churned, no action
          logToSheet(`Client '${clientName}' already churned. No timestamp action.`);
        }

        hubspotSheet.getRange(i + 1, 11).setValue(hubspotFields.reason_for_account_prioritisation || ""); // Column K: Tier Reasoning
        // --- End of Client Status Logic ---

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
          updateNotionPageFields(
            notionPageId, 
            pmUserIds, 
            mappedPa, 
            hubspotFields.client_health, 
            mappedTier, 
            hubspotFields.client_status, 
            hubspotFields.account_manager, 
            hubspotFields.reason_for_account_prioritisation
          );
          logToSheet(`Updated Notion page for ${clientName} | PM: ${(pmUserIds && pmUserIds.length > 0) ? pmUserIds.map(u => u.id).join(',') : mappedPm} | PA: ${mappedPa} | Client Health: ${hubspotFields.client_health || ''} | Tier: ${mappedTier} | Client Status: ${hubspotFields.client_status || ''} | Account Manager: ${hubspotFields.account_manager || ''} | Tier Reasoning: ${hubspotFields.reason_for_account_prioritisation || ''} | Notion Page ID: ${notionPageId}`);
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

// **************************************************************************
// **                       WEBHOOK HANDLER                                **
// **************************************************************************

/**
 * Main webhook handler for Notion payload.
 * This function is triggered when Notion sends a webhook to the deployed script URL.
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    logToSheet("Webhook received.");

    // The actual page data from the webhook is nested inside the 'data' object.
    if (!payload.data) {
      logToSheet("Webhook ignored: Payload did not contain a 'data' object.");
      return ContentService.createTextOutput("Webhook ignored: Invalid payload").setMimeType(ContentService.MimeType.TEXT);
    }

    var clientData = extractNotionData(payload.data);

    // If clientName is empty, the webhook was for a page creation or an irrelevant update. Safely ignore it.
    if (!clientData.clientName) {
      logToSheet("Webhook ignored: No client name found in payload. This is expected for initial page creation or minor updates.");
      return ContentService.createTextOutput("Webhook ignored: No client name").setMimeType(ContentService.MimeType.TEXT);
    }

    logToSheet("Extracted - Client: " + clientData.clientName);

    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var hubspotSheet = ss.getSheetByName(CONFIG.SHEETS.HUBSPOT_CONTACTS);
    if (!hubspotSheet) {
      logToSheet("Error: HubSpot Contacts sheet not found");
      return ContentService.createTextOutput("Sheet error").setMimeType(ContentService.MimeType.TEXT);
    }

    var hubspotData = hubspotSheet.getDataRange().getValues();
    var clientRow = findExactMatch(hubspotData, clientData.clientName, 0); // Column A for client name

    if (clientRow !== -1) {
      logToSheet("Client '" + clientData.clientName + "' already exists in HubSpot Contacts sheet. Skipping.");
      return ContentService.createTextOutput("Client already exists").setMimeType(ContentService.MimeType.TEXT);
    }

    // If client is not found, proceed with adding them
    logToSheet("Client '" + clientData.clientName + "' not found. Appending new row.");

    // 1. Append new row with Client Name and Notion Page ID
    var newRowData = [clientData.clientName];
    // Create an empty row up to column I (index 8)
    for (var i = 1; i < 9; i++) {
        newRowData.push('');
    }
    newRowData[8] = clientData.notionPageId; // Put Notion Page ID in Column I
    hubspotSheet.appendRow(newRowData);
    var newRowIndex = hubspotSheet.getLastRow();
    logToSheet("Appended new row for '" + clientData.clientName + "' at row " + newRowIndex + " with Notion ID: " + clientData.notionPageId);

    // 2. Search HubSpot for a similar contact
    var contactId = searchHubSpotContactByName(clientData.clientName);
    if (contactId) {
      logToSheet("HubSpot search found contact ID: " + contactId);
      // 3. Update the new row's Column B with the found contact ID
      hubspotSheet.getRange(newRowIndex, 2).setValue(contactId); // Column B for Contact ID
      logToSheet("Updated row " + newRowIndex + " with HubSpot Contact ID: " + contactId);
    } else {
      logToSheet("No HubSpot contact found for client: '" + clientData.clientName + "'");
    }

    return ContentService.createTextOutput("Webhook processed successfully").setMimeType(ContentService.MimeType.TEXT);

  } catch (err) {
    logToSheet("Fatal error in doPost: " + err.toString() + "\nStack: " + err.stack);
    return ContentService.createTextOutput("Server error").setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * Extracts relevant data from the Notion webhook payload in a safe manner.
 */
function extractNotionData(payload) {
  var clientName = "";
  var notionPageId = "";

  try {
    // Safely access nested properties
    if (payload && payload.properties && payload.properties['Client Name'] && 
        payload.properties['Client Name'].title && 
        payload.properties['Client Name'].title.length > 0 &&
        payload.properties['Client Name'].title[0].plain_text) {
      
      clientName = payload.properties['Client Name'].title[0].plain_text.trim();
    }
    if (payload && payload.id) {
      notionPageId = payload.id;
    }
  } catch (e) {
    logToSheet("Error during payload extraction: " + e.toString());
    // Return empty strings on error to avoid crashing the main function
    return { clientName: "", notionPageId: "" };
  }

  return { clientName: clientName, notionPageId: notionPageId };
}

/**
 * Finds an exact match in a 2D array (Google Sheet data).
 */
function syncNotionToSheet() {
  try {
    logToSheet("syncNotionToSheet: Start");
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CONFIG.SHEETS.HUBSPOT_CONTACTS);
    if (!sheet) throw new Error("Hubspot Contacts sheet not found");

    var dataRange = sheet.getDataRange();
    var data = dataRange.getValues();

    // Loop through each row of the sheet, starting from the second row
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var notionPageId = row[8]; // Column I (index 8)

      if (notionPageId) {
        try {
          var status = getNotionPageStatus(notionPageId); // New function in NotionAPI.js
          if (status && row[9] !== status) { // Column J (index 9)
            sheet.getRange(i + 1, 10).setValue(status); // Update column J
            logToSheet(`Updated status for Notion page ${notionPageId} to '${status}'`);
          }
        } catch (notionError) {
          logToSheet(`Could not sync status for Notion page ${notionPageId}: ${notionError.toString()}`);
        }
      }
    }
    logToSheet("syncNotionToSheet: Finished");
  } catch (e) {
    logToSheet("Error in syncNotionToSheet: " + e.toString() + "\nStack: " + e.stack);
  }
}

function syncSheetToHubSpot() {
  try {
    logToSheet("syncSheetToHubSpot: Start");
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var hubspotSheet = ss.getSheetByName(CONFIG.SHEETS.HUBSPOT_CONTACTS);
    if (!hubspotSheet) throw new Error("Hubspot Contacts sheet not found");

    var data = hubspotSheet.getDataRange().getValues();
    if (data.length <= 1) {
      logToSheet("syncSheetToHubSpot: No data in Hubspot Contacts sheet to sync.");
      return;
    }

    for (var i = 1; i < data.length; i++) { // Start from 1 to skip header
      var row = data[i];
      var contactId = row[1]; // Column B
      var clientStatus = row[9]; // Column J

      if (contactId && clientStatus) {
        try {
          var hubspotFields = {
            'client_status': clientStatus
          };
          var success = updateHubSpotContactFields(contactId, hubspotFields);
          if (success) {
            logToSheet(`syncSheetToHubSpot: Successfully updated HubSpot contact ${contactId} with status '${clientStatus}'.`);
          } else {
            logToSheet(`syncSheetToHubSpot: Failed to update HubSpot contact ${contactId}.`);
          }
        } catch (hubspotError) {
          logToSheet(`syncSheetToHubSpot: Error updating HubSpot contact ${contactId}: ${hubspotError.toString()}`);
        }
      }
    }

    logToSheet("syncSheetToHubSpot: Finished");
  } catch (e) {
    logToSheet("Error in syncSheetToHubSpot: " + e.toString() + "\nStack: " + e.stack);
  }
}

function findExactMatch(data, value, columnIndex) {
  for (var i = 0; i < data.length; i++) {
    if (data[i][columnIndex] && data[i][columnIndex].toString().trim().toLowerCase() === value.toString().trim().toLowerCase()) {
      return i; // Return the row index (0-based)
    }
  }
  return -1; // Not found
}

// **************************************************************************
// **                     WEEKLY SUMMARY REPORT                          **
// **************************************************************************

/**
 * Generates a weekly summary report of client statuses and logs it.
 * This function is intended to be run by a time-based trigger.
 */
// Helper function to format client names as 'First L.'
function formatClientName(fullName) {
  if (!fullName) return "";
  var nameParts = fullName.trim().split(' ');
  if (nameParts.length < 2) return fullName; // Return full name if it's just one word
  var firstName = nameParts[0];
  var lastNameInitial = nameParts[nameParts.length - 1].charAt(0);
  return `${firstName} ${lastNameInitial}.`;
}

function generateWeeklySummaryReport() {
  try {
    logToSheet("generateWeeklySummaryReport: Start");
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CONFIG.SHEETS.HUBSPOT_CONTACTS);
    if (!sheet) throw new Error("Hubspot Contacts sheet not found");

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      logToSheet("No data to generate a report.");
      return;
    }

    var activeClients = 0;
    var noResponseClients = 0;
    var onboardingClients = 0;
    var pausedClients = 0;
    var churnedPendingClients = 0;
    var churnedLastWeek = 0;
    var onboardingClientNames = [];
    var churnedClientNames = [];

    var today = new Date();
    var sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Start from 1 to skip header row
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var status = row[9] ? row[9].toString().trim().toLowerCase() : ""; // Column J
      var churnedTimestamp = row[11] ? new Date(row[11]) : null; // Column L
      logToSheet(`Summary: Row ${i + 1} status='${status}', churnedTimestamp='${churnedTimestamp}'`);

      if (status === 'active') {
        activeClients++;
      } else if (status === 'no response') {
        noResponseClients++;
      } else if (status === 'onboarding') {
        onboardingClients++;
        onboardingClientNames.push(formatClientName(clientName));
      } else if (status === 'paused') {
        pausedClients++;
      } else if (status === 'churned pending') {
        churnedPendingClients++;
      } else if (status === 'churned') {
        // Check if churned within the last 7 days (inclusive of today)
        if (churnedTimestamp && churnedTimestamp >= sevenDaysAgo && churnedTimestamp <= today) {
          churnedLastWeek++;
          churnedClientNames.push(formatClientName(clientName));
        }
      }
    }

    // --- Send Slack Message ---
    var scriptProperties = PropertiesService.getScriptProperties();
    var slackBotToken = scriptProperties.getProperty('SLACK_BOT_TOKEN');
    if (!slackBotToken) {
        throw new Error('Slack bot token not found in Script Properties. Please run _setupScriptProperties().');
    }

    var slackChannel = 'C08136WGH70'; // As requested

    // --- Build Slack Message Blocks ---
    var blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Weekly Client Summary Report 📊'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Client Status Breakdown:*\n- *Active:* ${activeClients}\n- *No Response:* ${noResponseClients}\n- *Paused:* ${pausedClients}\n- *Churned Pending:* ${churnedPendingClients}`
        }
      },
      { type: 'divider' }
    ];

    // Onboarding Clients Section
    var onboardingText = `*Clients Onboarding (${onboardingClients}):*`;
    if (onboardingClientNames.length > 0) {
      onboardingText += ' ' + onboardingClientNames.join(', ');
    }
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: onboardingText } });
    blocks.push({ type: 'divider' });

    // Churned Clients Section
    var churnedText = `*Churned Last 7 Days (${churnedLastWeek}):*`;
    if (churnedClientNames.length > 0) {
      churnedText += ' ' + churnedClientNames.join(', ');
    }
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: churnedText } });
    blocks.push({ type: 'divider' });

    // Mention and Context Section
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '<@U066YSZFKSB> This is the weekly client summary.'
      }
    });
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Report generated on ${new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })}`
        }
      ]
    });

    var slackMessage = {
      channel: slackChannel,
      blocks: blocks
    };

    var slackResponse = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + slackBotToken,
        'Content-Type': 'application/json; charset=utf-8'
      },
      payload: JSON.stringify(slackMessage),
      muteHttpExceptions: true
    });

    var slackResponseCode = slackResponse.getResponseCode();
    var slackResponseText = slackResponse.getContentText();

    if (slackResponseCode !== 200 || !JSON.parse(slackResponseText).ok) {
      logToSheet(`Failed to send weekly summary to Slack. Status: ${slackResponseCode}, Response: ${slackResponseText}`);
    } else {
      logToSheet('Successfully sent weekly summary to Slack channel ' + slackChannel);
    }

    logToSheet("generateWeeklySummaryReport: Finished");
  } catch (e) {
    logToSheet("Error in generateWeeklySummaryReport: " + e.toString() + "\nStack: " + e.stack);
  }
}

/**
 * Creates a time-driven trigger to run the weekly summary report function.
 * Run this function once to set up the automation.
 */
function setupWeeklySummaryTrigger() {
  // Delete any existing triggers for this function to avoid duplicates
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'generateWeeklySummaryReport') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create a new trigger
  ScriptApp.newTrigger('generateWeeklySummaryReport')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(16)
    .create();

  logToSheet("Successfully created weekly trigger for Friday at 4:00 PM.");
}
