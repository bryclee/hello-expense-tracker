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

export async function getExpenses(spreadsheetId, sheetName, limit = 5, offset = 0) {
  // First, get the properties of the sheet to find the total number of rows with data.
  const sheetMetadata = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: `${sheetName}!A:A`, // Check column A for total rows
  });

  const totalRowsWithData = sheetMetadata.result.values ? sheetMetadata.result.values.length : 0;

  // Edge Case 1: Empty or header-only sheet
  if (totalRowsWithData <= 1) {
    return { expenses: [], totalExpenses: 0 };
  }

  const totalExpenses = totalRowsWithData - 1; // Subtract header row

  // Calculate the range to fetch
  const endRow = totalRowsWithData - offset;
  const startRow = Math.max(2, endRow - limit + 1);

  // If startRow is greater than endRow, it means we've loaded all data.
  if (startRow > endRow) {
    return { expenses: [], totalExpenses: totalExpenses };
  }

  const range = `${sheetName}!A${startRow}:D${endRow}`;

  const response = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: range,
  });

  // The API returns rows in ascending order, so we reverse to get newest first.
  const expenses = response.result.values || [];
  expenses.reverse();

  return { expenses: expenses, totalExpenses: totalExpenses };
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