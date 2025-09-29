import { initGoogleAuth, signIn } from './auth.js';
import {
  initGapiClient,
  setGapiToken,
  getExpenses,
  addExpense,
  getSpreadsheetDetails,
} from './gapi.js';
import { Expense } from './types.js';

const loggedInView = document.getElementById('logged-in-view');
const loggedOutView = document.getElementById('logged-out-view');
const signInButton = getButtonElementById('sign-in-button');
const signOutButton = getButtonElementById('sign-out-button');
const offlineIndicator = document.getElementById('offline-indicator');
const spreadsheetSelection = document.getElementById('spreadsheet-selection');
const switchButton = getButtonElementById('switch-button');
const saveSpreadsheetButton = getButtonElementById('save-spreadsheet-button');
const spreadsheetIdInput = getInputElementById('spreadsheet-id');
const sheetNameInput = getInputElementById('sheet-name');
const shareableLinkInput = getInputElementById('shareable-link');
const copyLinkButton = getButtonElementById('copy-link-button');
const fetchMoreButton = getButtonElementById('fetch-more-button');

let allExpenses: Expense[] = [];
let totalExpenses = 0;
let isLoadingMore = false;

function updateOnlineStatus() {
  if (navigator.onLine) {
    if (offlineIndicator) {
      offlineIndicator.style.display = 'none';
    }
    syncPendingExpenses();
  } else {
    if (offlineIndicator) {
      offlineIndicator.style.display = 'block';
    }
  }
}

function showLoggedInView() {
  if (loggedInView) loggedInView.style.display = 'block';
  if (loggedOutView) loggedOutView.style.display = 'none';
  if (spreadsheetSelection) spreadsheetSelection.style.display = 'none';
  if (switchButton) switchButton.style.display = 'block';
  getInputElementById('expense-date').valueAsDate = new Date();
  loadSpreadsheetDetails();
}

function showLoggedOutView() {
  if (loggedInView) loggedInView.style.display = 'none';
  if (loggedOutView) loggedOutView.style.display = 'block';
  if (spreadsheetSelection) spreadsheetSelection.style.display = 'none';
  if (switchButton) switchButton.style.display = 'none';
}

function showSpreadsheetSelection(
  querySpreadsheetId: string | null = null,
  querySheetName: string | null = null
) {
  if (loggedInView) loggedInView.style.display = 'none';
  if (loggedOutView) loggedOutView.style.display = 'none';
  if (spreadsheetSelection) spreadsheetSelection.style.display = 'block';
  if (switchButton) switchButton.style.display = 'none';

  // Prefill current details
  spreadsheetIdInput.value =
    querySpreadsheetId || localStorage.getItem('selected_spreadsheet_id') || '';
  sheetNameInput.value =
    querySheetName || localStorage.getItem('selected_sheet_name') || 'Expenses';
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

async function handleAuthResponse(tokenResponse: google.accounts.oauth2.TokenResponse) {
  // Case 1: Successful login (either silent or interactive)
  if (tokenResponse && tokenResponse.access_token) {
    localStorage.setItem('user_has_signed_in', 'true');
    const now = new Date();
    const expirationTime = now.getTime() + Number(tokenResponse.expires_in) * 1000;
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
    } catch (error: unknown) {
      if ((error as any).status === 401) {
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
  const originalButtonText = fetchMoreButton.textContent;
  fetchMoreButton.textContent = 'Loading...';
  fetchMoreButton.disabled = true;

  const spreadsheetId = localStorage.getItem('selected_spreadsheet_id');
  const sheetName = localStorage.getItem('selected_sheet_name');
  const offset = allExpenses.length;

  try {
    const result = await getExpenses(spreadsheetId!, sheetName!, 5, offset);
    // Prepend older expenses to the list
    allExpenses.push(...result.expenses);
    renderExpenses();
  } catch (error) {
    console.error('Error fetching more expenses:', error);
    // Optionally, show an error to the user
  } finally {
    isLoadingMore = false;
    fetchMoreButton.textContent = originalButtonText;
    fetchMoreButton.disabled = false;
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
  if (!spreadsheetDetails.properties) {
    return;
  }
  const spreadsheetTitle = spreadsheetDetails.properties.title;
  const detailsElement = document.getElementById('spreadsheet-details');
  const spreadsheetTitleSpan = document.getElementById('spreadsheet-title');
  const spreadsheetLink = getAnchorElementById('spreadsheet-link');

  if (spreadsheetTitleSpan)
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
  if (transactionList) transactionList.innerHTML = ''; // Clear the list

  const pendingExpenses = getPendingExpenses();
  const combinedExpenses: Expense[] = [...allExpenses];

  // Visually distinguish pending expenses
  pendingExpenses.forEach((expense: Expense) => {
    const li = document.createElement('li');
    li.textContent = `${expense.date} - ${expense.name} - ${expense.category} - ${expense.price} (Not Synced)`;
    if (transactionList) transactionList.appendChild(li);
  });

  if (combinedExpenses.length > 0) {
    combinedExpenses.forEach((expense) => {
      const li = document.createElement('li');
      li.textContent = `${expense.date} - ${expense.name} - ${expense.category} - ${expense.price}`;
      if (transactionList) transactionList.appendChild(li);
    });
  } else if (pendingExpenses.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No expenses found.';
    if (transactionList) transactionList.appendChild(li);
  }

  // Show or hide the "Show More" button
  if (allExpenses.length >= totalExpenses) {
    fetchMoreButton.style.display = 'none';
  } else {
    fetchMoreButton.style.display = 'block';
  }
}

function getButtonElementById(id: string): HTMLButtonElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Element with id '${id}' is not an HTMLButtonElement.`);
  }
  return element;
}

function getSelectElementById(id: string): HTMLSelectElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error(`Element with id '${id}' is not an HTMLSelectElement.`);
  }
  return element;
}

function getInputElementById(id: string): HTMLInputElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`Element with id '${id}' is not an HTMLInputElement.`);
  }
  return element;
}

function getAnchorElementById(id: string): HTMLAnchorElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLAnchorElement)) {
    throw new Error(`Element with id '${id}' is not an HTMLAnchorElement.`);
  }
  return element;
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
  if (expenseForm) expenseForm.addEventListener('submit', handleAddExpense);

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

async function handleAddExpense(event: SubmitEvent) {
  event.preventDefault();

  const expenseForm = document.getElementById('expense-form');
  if (!expenseForm) {
    return;
  }
  const addButton = expenseForm.querySelector(
    'button[type="submit"]'
  ) as HTMLButtonElement;
  const originalButtonText = addButton.textContent;
  addButton.textContent = 'Saving...';
  addButton.disabled = true;

  const date = getInputElementById('expense-date').value;
  const name = getInputElementById('expense-name').value;
  const category = getSelectElementById('expense-category').value;
  const price = getInputElementById('expense-price').value;

  const expense: Expense = { date, name, category, price };

  const spreadsheetId = localStorage.getItem('selected_spreadsheet_id');
  const sheetName = localStorage.getItem('selected_sheet_name');

  if (!spreadsheetId || !sheetName) {
    alert('Please select a spreadsheet first.');
    showSpreadsheetSelection();
    return;
  }

  if (navigator.onLine) {
    await addExpense(spreadsheetId, sheetName, date, name, category, price);

    // Manually update local state instead of reloading
    allExpenses.unshift(expense);
    totalExpenses++;
    renderExpenses();
  } else {
    savePendingExpense(expense);
    renderExpenses(); // Re-render to show the pending expense
  }

  // Clear the form
  getInputElementById('expense-date').valueAsDate = new Date();
  getInputElementById('expense-name').value = '';
  getSelectElementById('expense-category').value = '';
  getInputElementById('expense-price').value = '';

  addButton.textContent = originalButtonText;
  addButton.disabled = false;
}

function getPendingExpenses(): Expense[] {
  return JSON.parse(localStorage.getItem('pending-expenses') || '[]') || [];
}

function savePendingExpense(expense: Expense) {
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
