const DATA_SHEET_NAME = 'Kaelbermanager';
const DATA_CELL = 'A1';

function doGet(e) {
  const sheetId = String(e.parameter.sheetId || '');
  if (!sheetId) return json_({ error: 'sheetId fehlt' });
  try {
    const sheet = getDataSheet_(sheetId);
    const raw = sheet.getRange(DATA_CELL).getValue();
    return json_({ data: raw ? JSON.parse(raw) : null });
  } catch (error) {
    return json_({ error: error.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (!body.sheetId || !body.data) return json_({ error: 'Incomplete payload' });
    
    // Safety check: Don't overwrite with empty data
    if (!body.data.calves) return json_({ error: 'Corrupt data received' });
    
    const sheet = getDataSheet_(String(body.sheetId));
    sheet.getRange(DATA_CELL).setValue(JSON.stringify(body.data));
    sheet.getRange('B1').setValue(new Date().toISOString());
    return json_({ ok: true });
  } catch (error) {
    return json_({ error: error.message });
  }
}

function getDataSheet_(sheetId) {
  const spreadsheet = SpreadsheetApp.openById(sheetId);
  let sheet = spreadsheet.getSheetByName(DATA_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(DATA_SHEET_NAME);
  return sheet;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
