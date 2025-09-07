import { initGoogleAuth, signIn, requestTokenSilent } from './auth.js';
import {
  initGapiClient,
  setGapiToken,
  getExpenses,
  addExpense,
  getSpreadsheetDetails,
} from './gapi.js';

const loggedInView = document.getElementById('logged-in-view');
const loggedOutView = document.getElementById('logged-out-view');
const signInButton = document.getElementById('sign-in-button');
const signOutButton = document.getElementById('sign-out-button');
const loadingIndicator = document.getElementById('loading-indicator');
const offlineIndicator = document.getElementById('offline-indicator');
const spreadsheetSelection = document.getElementById('spreadsheet-selection');
const switchButton = document.getElementById('switch-button');
const saveSpreadsheetButton = document.getElementById(
  'save-spreadsheet-button'
);
const spreadsheetIdInput = document.getElementById('spreadsheet-id');
const sheetNameInput = document.getElementById('sheet-name');
const shareableLinkInput = document.getElementById('shareable-link');
const copyLinkButton = document.getElementById('copy-link-button');

function updateOnlineStatus() {
  if (navigator.onLine) {
    offlineIndicator.style.display = 'none';
    syncPendingExpenses();
  } else {
    offlineIndicator.style.display = 'block';
  }
}

function showLoggedInView() {
  loggedInView.style.display = 'block';
  loggedOutView.style.display = 'none';
  loadingIndicator.style.display = 'none';
  spreadsheetSelection.style.display = 'none';
  switchButton.style.display = 'block';
  document.getElementById('expense-date').valueAsDate = new Date();
  loadSpreadsheetDetails();
}

function showLoggedOutView() {
  loggedInView.style.display = 'none';
  loggedOutView.style.display = 'block';
  loadingIndicator.style.display = 'none';
  spreadsheetSelection.style.display = 'none';
  switchButton.style.display = 'none';
}

function showSpreadsheetSelection(querySpreadsheetId = null, querySheetName = null) {
  loggedInView.style.display = 'none';
  loggedOutView.style.display = 'none';
  loadingIndicator.style.display = 'none';
  spreadsheetSelection.style.display = 'block';
  switchButton.style.display = 'none';

  // Prefill current details
  spreadsheetIdInput.value = querySpreadsheetId || localStorage.getItem('selected_spreadsheet_id') || '';
  sheetNameInput.value = querySheetName || localStorage.getItem('selected_sheet_name') || 'Expenses';
}

function handleSwitchClick() {
  showSpreadsheetSelection();
}

function handleSaveSpreadsheetClick() {
  const spreadsheetId = spreadsheetIdInput.value;
  const sheetName = sheetNameInput.value;

  localStorage.setItem('selected_spreadsheet_id', spreadsheetId);
  localStorage.setItem('selected_sheet_name', sheetName);

  // Remove query parameters from URL
  window.history.replaceState({}, document.title, window.location.pathname);

  // Reload the application to use the new spreadsheet
  window.location.reload();
}

function handleAuthClick() {
  signIn();
}

function handleSignOutClick() {
  localStorage.removeItem('gapi_token');
  localStorage.removeItem('user_has_signed_in');
  gapi.client.setToken(null);
  showLoggedOutView();
}

async function handleAuthResponse(tokenResponse) {
  // Case 1: Successful login (either silent or interactive)
  if (tokenResponse && tokenResponse.access_token) {
    localStorage.setItem('user_has_signed_in', 'true');
    const now = new Date();
    const expirationTime = now.getTime() + tokenResponse.expires_in * 1000;
    const tokenWithExpiration = { ...tokenResponse, expirationTime };
    localStorage.setItem('gapi_token', JSON.stringify(tokenWithExpiration));
    setGapiToken(tokenResponse);

    const spreadsheetId = localStorage.getItem('selected_spreadsheet_id');
    const sheetName = localStorage.getItem('selected_sheet_name');

    if (spreadsheetId && sheetName) {
      showLoggedInView();
      loadExpenses();
    } else {
      showSpreadsheetSelection();
    }
  } else {
    // Case 2: Failed silent login. Show the logged-out view.
    showLoggedOutView();
  }
}

async function loadExpenses() {
  let expenses = [];
  const spreadsheetId = localStorage.getItem('selected_spreadsheet_id');
  const sheetName = localStorage.getItem('selected_sheet_name');

  if (!spreadsheetId || !sheetName) {
    showSpreadsheetSelection();
    return;
  }

  if (navigator.onLine) {
    try {
      expenses = await getExpenses(spreadsheetId, sheetName);
    } catch (error) {
      if (error.status === 401) {
        handleSignOutClick();
      } else {
        console.error('Error loading expenses:', error);
      }
    }
  }
  const pendingExpenses = getPendingExpenses();
  renderExpenses(expenses, pendingExpenses);
}

async function loadSpreadsheetDetails() {
  const spreadsheetId = localStorage.getItem('selected_spreadsheet_id');
  const sheetName = localStorage.getItem('selected_sheet_name');

  if (!spreadsheetId || !sheetName) {
    showSpreadsheetSelection();
    return;
  }

  const spreadsheetDetails = await getSpreadsheetDetails(spreadsheetId);
  const spreadsheetTitle = spreadsheetDetails.properties.title;
  const detailsElement = document.getElementById('spreadsheet-details');
  const spreadsheetTitleSpan = document.getElementById('spreadsheet-title');
  const spreadsheetLink = document.getElementById('spreadsheet-link');

  spreadsheetTitleSpan.textContent = `Sheet: ${spreadsheetTitle} / ${sheetName}`;
  spreadsheetLink.href = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Construct shareable link
  const shareableUrl = `${window.location.origin}${window.location.pathname}?spreadsheetId=${spreadsheetId}&sheetName=${sheetName}`;
  shareableLinkInput.value = shareableUrl;

  copyLinkButton.onclick = () => {
    navigator.clipboard
      .writeText(shareableUrl)
      .then(() => {
        alert('Link copied to clipboard!');
      })
      .catch((err) => {
        console.error('Could not copy text: ', err);
      });
  };
}

function renderExpenses(expenses, pendingExpenses) {
  const transactionList = document.getElementById('transaction-list');
  transactionList.innerHTML = ''; // Clear the list

  const allExpenses = [...expenses, ...pendingExpenses];
  const recentExpenses = allExpenses.slice(-5);

  // Reverse the order of recentExpenses to show newest on top
  recentExpenses.reverse();

  if (recentExpenses.length > 0) {
    recentExpenses.forEach((expense, index) => {
      const li = document.createElement('li');
      let textContent = '';
      if (Array.isArray(expense)) {
        textContent = `${expense[0]} - ${expense[1]} - ${expense[2]} - ${expense[3]}`;
      } else {
        textContent = `${expense.date} - ${expense.name} - ${expense.category} - ${expense.price}`;
      }

      if (index >= expenses.length) {
        textContent += ' (Not Synced)';
      }
      li.textContent = textContent;
      transactionList.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = 'No expenses found.';
    transactionList.appendChild(li);
  }
}

function main() {
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  signInButton.addEventListener('click', handleAuthClick);
  signOutButton.addEventListener('click', handleSignOutClick);
  switchButton.addEventListener('click', handleSwitchClick);
  saveSpreadsheetButton.addEventListener('click', handleSaveSpreadsheetClick);

  const expenseForm = document.getElementById('expense-form');
  expenseForm.addEventListener('submit', handleAddExpense);

  initGapiClient(() => {
    initGoogleAuth(handleAuthResponse);

    // Check for query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const querySpreadsheetId = urlParams.get('spreadsheetId');
    const querySheetName = urlParams.get('sheetName');

    if (querySpreadsheetId && querySheetName) {
      showSpreadsheetSelection(querySpreadsheetId, querySheetName);
      return; // Wait for user to save
    }

    const tokenString = localStorage.getItem('gapi_token');
    const userHasSignedIn = localStorage.getItem('user_has_signed_in');

    if (tokenString) {
      const token = JSON.parse(tokenString);
      if (new Date().getTime() < token.expirationTime) {
        // We have a valid token, so we are logged in.
        setGapiToken(token);
        const spreadsheetId = localStorage.getItem('selected_spreadsheet_id');
        const sheetName = localStorage.getItem('selected_sheet_name');
        if (spreadsheetId && sheetName) {
          showLoggedInView();
          loadExpenses();
        } else {
          showSpreadsheetSelection();
        }
      } else {
        // Token expired, try to refresh it silently.
        localStorage.removeItem('gapi_token');
        requestTokenSilent();
      }
    } else if (userHasSignedIn) {
      // No token, but they are a returning user, so try silent auth.
      requestTokenSilent();
    } else {
      // No token and they are a new user. Just show the button.
      showLoggedOutView();
    }
  });
}

async function handleAddExpense(event) {
  event.preventDefault();

  const date = document.getElementById('expense-date').value;
  const name = document.getElementById('expense-name').value;
  const category = document.getElementById('expense-category').value;
  const price = document.getElementById('expense-price').value;

  const expense = { date, name, category, price };

  const spreadsheetId = localStorage.getItem('selected_spreadsheet_id');
  const sheetName = localStorage.getItem('selected_sheet_name');

  if (!spreadsheetId || !sheetName) {
    alert('Please select a spreadsheet first.');
    showSpreadsheetSelection();
    return;
  }

  if (navigator.onLine) {
    await addExpense(spreadsheetId, sheetName, date, name, category, price);
  } else {
    savePendingExpense(expense);
  }

  // Clear the form
  document.getElementById('expense-date').valueAsDate = new Date();
  document.getElementById('expense-name').value = '';
  document.getElementById('expense-category').value = '';
  document.getElementById('expense-price').value = '';

  loadExpenses();
}

function getPendingExpenses() {
  return JSON.parse(localStorage.getItem('pending-expenses')) || [];
}

function savePendingExpense(expense) {
  const pendingExpenses = getPendingExpenses();
  pendingExpenses.push(expense);
  localStorage.setItem('pending-expenses', JSON.stringify(pendingExpenses));
}

async function syncPendingExpenses() {
  const pendingExpenses = getPendingExpenses();
  const spreadsheetId = localStorage.getItem('selected_spreadsheet_id');
  const sheetName = localStorage.getItem('selected_sheet_name');

  if (!spreadsheetId || !sheetName) {
    console.warn('No spreadsheet selected for syncing pending expenses.');
    return;
  }

  if (pendingExpenses.length > 0) {
    for (const expense of pendingExpenses) {
      await addExpense(
        spreadsheetId,
        sheetName,
        expense.date,
        expense.name,
        expense.category,
        expense.price
      );
    }
    localStorage.removeItem('pending-expenses');
    loadExpenses();
  }
}

main();
