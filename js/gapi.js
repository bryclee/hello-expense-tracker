const API_DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

export function initGapiClient(callback) {
  gapi.load('client', async () => {
    await gapi.client.init({
      discoveryDocs: [API_DISCOVERY_DOC],
    });
    callback();
  });
}

export function setGapiToken(token) {
  gapi.client.setToken(token);
}

export async function getExpenses(spreadsheetId, sheetName) {
  const response = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: `${sheetName}!A2:D`, // Assumes data in columns A-D, starting at row 2
  });
  return response.result.values || [];
}

export async function addExpense(spreadsheetId, sheetName, date, description, category, amount) {
  const response = await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId,
    range: sheetName, // Appending to the sheet
    valueInputOption: 'USER_ENTERED', // So "1/1/2024" is treated as a date
    resource: {
      values: [
        [date, description, category, amount]
      ],
    },
  });
  return response.result;
}

export async function getSpreadsheetDetails(spreadsheetId) {
  const response = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId,
  });
  return response.result;
}