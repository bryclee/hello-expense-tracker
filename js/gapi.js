import { SPREADSHEET_ID } from './config.js';

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

export async function getExpenses() {
  const response = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Expenses!A2:D', // Assumes a sheet named "Expenses" and data in columns A-D, starting at row 2
  });
  return response.result.values || [];
}

export async function addExpense(date, description, category, amount) {
  const response = await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Expenses', // Appending to the "Expenses" sheet
    valueInputOption: 'USER_ENTERED', // So "1/1/2024" is treated as a date
    resource: {
      values: [
        [date, description, category, amount]
      ],
    },
  });
  return response.result;
}
