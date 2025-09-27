import { initGoogleAuth, signIn } from './auth.js';
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
const fetchMoreButton = document.getElementById('fetch-more-button');

let allExpenses = [];
let totalExpenses = 0;
let isLoadingMore = false;

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
  console.log('Sign-in button clicked');
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
      await loadExpenses();
    } else {
      showSpreadsheetSelection();
    }
  } else {
    // Case 2: Failed silent login. Show the logged-out view.
    showLoggedOutView();
  }
}

async function loadExpenses() {
  const spreadsheetId = localStorage.getItem('selected_spreadsheet_id');
  const sheetName = localStorage.getItem('selected_sheet_name');

  if (!spreadsheetId || !sheetName) {
    showSpreadsheetSelection();
    return;
  }

  if (navigator.onLine) {
    try {
      const result = await getExpenses(spreadsheetId, sheetName, 5, 0);
      allExpenses = result.expenses;
      totalExpenses = result.totalExpenses;
    } catch (error) {
      if (error.status === 401) {
        handleSignOutClick();
      } else {
        console.error('Error loading expenses:', error);
      }
    }
  }
  renderExpenses();
}

async function handleFetchMoreClick() {
  if (isLoadingMore) {
    return;
  }

  isLoadingMore = true;
  const spreadsheetId = localStorage.getItem('selected_spreadsheet_id');
  const sheetName = localStorage.getItem('selected_sheet_name');
  const offset = allExpenses.length;

  try {
    const result = await getExpenses(spreadsheetId, sheetName, 5, offset);
    // Prepend older expenses to the list
    allExpenses.push(...result.expenses);
    renderExpenses();
  } catch (error) {
    console.error('Error fetching more expenses:', error);
    // Optionally, show an error to the user
  } finally {
    isLoadingMore = false;
  }
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

function renderExpenses() {
  const transactionList = document.getElementById('transaction-list');
  transactionList.innerHTML = ''; // Clear the list

  const pendingExpenses = getPendingExpenses();
  const combinedExpenses = [...allExpenses];

  // Visually distinguish pending expenses
  pendingExpenses.forEach(expense => {
    const li = document.createElement('li');
    li.textContent = `${expense.date} - ${expense.name} - ${expense.category} - ${expense.price} (Not Synced)`;
    transactionList.appendChild(li);
  });

  if (combinedExpenses.length > 0) {
    combinedExpenses.forEach((expense) => {
      const li = document.createElement('li');
      li.textContent = `${expense[0]} - ${expense[1]} - ${expense[2]} - ${expense[3]}`;
      transactionList.appendChild(li);
    });
  } else if (pendingExpenses.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No expenses found.';
    transactionList.appendChild(li);
  }

  // Show or hide the "Show More" button
  if (allExpenses.length >= totalExpenses) {
    fetchMoreButton.style.display = 'none';
  } else {
    fetchMoreButton.style.display = 'block';
  }
}

export function main() {
  console.log('main() called');
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  console.log('Attaching click handler to sign-in button');
  signInButton.addEventListener('click', handleAuthClick);
  signOutButton.addEventListener('click', handleSignOutClick);
  switchButton.addEventListener('click', handleSwitchClick);
  saveSpreadsheetButton.addEventListener('click', handleSaveSpreadsheetClick);
  fetchMoreButton.addEventListener('click', handleFetchMoreClick);

  const expenseForm = document.getElementById('expense-form');
  expenseForm.addEventListener('submit', handleAddExpense);

  initGapiClient(async () => {
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
    if (tokenString) {
      const token = JSON.parse(tokenString);
      if (new Date().getTime() < token.expirationTime) {
        // We have a valid token, so we are logged in.
        setGapiToken(token);
        const spreadsheetId = localStorage.getItem('selected_spreadsheet_id');
        const sheetName = localStorage.getItem('selected_sheet_name');
        if (spreadsheetId && sheetName) {
          showLoggedInView();
          await loadExpenses();
        } else {
          showSpreadsheetSelection();
        }
      } else {
        // Token expired, show the logged-out view.
        showLoggedOutView();
      }
    } else {
      // No token, show the logged-out view.
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
    
    // Format the data to match the API response format
    const [year, month, day] = date.split('-');
    const formattedDate = `${parseInt(month, 10)}/${parseInt(day, 10)}/${year}`;
    const formattedPrice = parseFloat(price).toFixed(2);

    // Manually update local state instead of reloading
    allExpenses.unshift([formattedDate, name, category, formattedPrice]);
    totalExpenses++;
    renderExpenses();
  } else {
    savePendingExpense(expense);
    renderExpenses(); // Re-render to show the pending expense
  }

  // Clear the form
  document.getElementById('expense-date').valueAsDate = new Date();
  document.getElementById('expense-name').value = '';
  document.getElementById('expense-category').value = '';
  document.getElementById('expense-price').value = '';
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
    await loadExpenses();
  }
}


