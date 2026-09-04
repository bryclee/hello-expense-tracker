import { initGoogleAuth, signIn, getUserInfo } from './auth.js';
import {
  initGapiClient,
  setGapiToken,
  getExpenses,
  addExpense,
  getSpreadsheetDetails,
  deleteExpense,
} from './gapi.js';
import { Expense } from './types.js';

interface TokenWithExpiration extends google.accounts.oauth2.TokenResponse {
  expirationTime: number;
}

interface CustomWindow extends Window {
  gapiLoadPromise?: Promise<void>;
  gisLoadPromise?: Promise<void>;
}

let loggedInView: HTMLElement | null;
let loggedOutView: HTMLElement | null;
let signInButton: HTMLButtonElement;
let signOutButton: HTMLButtonElement;
let offlineIndicator: HTMLElement | null;
let spreadsheetSelection: HTMLElement | null;
let switchButton: HTMLButtonElement;
let saveSpreadsheetButton: HTMLButtonElement;
let spreadsheetIdInput: HTMLInputElement;
let sheetNameInput: HTMLInputElement;
let shareableLinkInput: HTMLInputElement;
let copyLinkButton: HTMLButtonElement;
let fetchMoreButton: HTMLButtonElement;
let editEntriesButton: HTMLButtonElement;
let cancelEditButton: HTMLButtonElement;

let allExpenses: Expense[] = [];
let totalExpenses = 0;
let isLoadingMore = false;
let isGapiReady = false;
let isEditMode = false;

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
  getInputElementById('expense-date').value = getTodayLocalDate();
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
  localStorage.removeItem('user_email');
  if (typeof gapi !== 'undefined' && gapi.client) {
    gapi.client.setToken(null);
  }
  showLoggedOutView();
}

async function handleAuthResponse(tokenResponse: google.accounts.oauth2.TokenResponse) {
  // Case 1: Successful login (either silent or interactive)
  if (tokenResponse && tokenResponse.access_token) {
    const { email } = await getUserInfo(tokenResponse.access_token);
    localStorage.setItem('user_email', email);
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

  if (navigator.onLine && isGapiReady) {
    try {
      const result = await getExpenses(spreadsheetId, sheetName, 5, 0);
      allExpenses = result.expenses;
      totalExpenses = result.totalExpenses;
      // Cache expenses and total count in localStorage
      localStorage.setItem('cached-expenses', JSON.stringify(allExpenses));
      localStorage.setItem('cached-total-expenses', totalExpenses.toString());
    } catch (error: unknown) {
      if (error instanceof Object && 'status' in error && error.status === 401) {
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
    localStorage.setItem('cached-expenses', JSON.stringify(allExpenses));
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

function createDeleteButton(
  onClick: () => Promise<void> | void,
  ariaLabel: string
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'delete-btn';
  btn.setAttribute('aria-label', ariaLabel);
  btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
  btn.style.marginLeft = '8px';
  btn.style.cursor = 'pointer';
  btn.onclick = async (e) => {
    e.preventDefault();
    await onClick();
  };
  return btn;
}

function updateEditControls() {
  if (!editEntriesButton || !cancelEditButton) return;
  const pendingExpenses = getPendingExpenses();
  const hasExpenses = allExpenses.length > 0 || pendingExpenses.length > 0;

  if (isEditMode) {
    editEntriesButton.style.display = 'none';
    cancelEditButton.style.display = 'inline-block';
  } else {
    cancelEditButton.style.display = 'none';
    editEntriesButton.style.display = hasExpenses ? 'inline-block' : 'none';
  }
}

export function setEditMode(enabled: boolean) {
  isEditMode = enabled;
  updateEditControls();
  renderExpenses();
}

export function getIsEditMode(): boolean {
  return isEditMode;
}

function renderExpenses() {
  const transactionList = document.getElementById('transaction-list');
  if (transactionList) transactionList.innerHTML = ''; // Clear the list

  const pendingExpenses = getPendingExpenses();
  const combinedExpenses: Expense[] = [...allExpenses];

  // Visually distinguish pending expenses
  pendingExpenses.forEach((expense: Expense, index: number) => {
    const li = document.createElement('li');
    li.textContent = `${formatDate(expense.date)} - ${expense.name} - ${expense.category} - ${expense.price} (Not Synced)`;
    if (isEditMode) {
      const deleteBtn = createDeleteButton(() => {
        deletePendingExpense(index);
        renderExpenses();
      }, `Delete ${expense.name}`);
      li.appendChild(deleteBtn);
    }
    if (transactionList) transactionList.appendChild(li);
  });

  if (combinedExpenses.length > 0) {
    combinedExpenses.forEach((expense, index) => {
      const li = document.createElement('li');
      li.textContent = `${formatDate(expense.date)} - ${expense.name} - ${expense.category} - ${expense.price}`;
      if (isEditMode) {
        const deleteBtn = createDeleteButton(async () => {
          deleteBtn.disabled = true;
          const rowIndex = expense.rowIndex ?? (totalExpenses - index + 1);
          await handleDeleteExpense({ ...expense, rowIndex });
        }, `Delete ${expense.name}`);
        li.appendChild(deleteBtn);
      }
      if (transactionList) transactionList.appendChild(li);
    });
  } else if (pendingExpenses.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No expenses found.';
    if (transactionList) transactionList.appendChild(li);
  }

  // Show or hide the "Show More" button
  if (fetchMoreButton) {
    if (allExpenses.length >= totalExpenses) {
      fetchMoreButton.style.display = 'none';
    } else {
      fetchMoreButton.style.display = 'block';
    }
  }

  updateEditControls();
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

function loadCachedExpenses() {
  try {
    const cached = localStorage.getItem('cached-expenses');
    const cachedTotal = localStorage.getItem('cached-total-expenses');
    if (cached) {
      allExpenses = JSON.parse(cached);
    }
    if (cachedTotal) {
      totalExpenses = parseInt(cachedTotal, 10);
    }
  } catch (err) {
    console.error('Error loading cached expenses:', err);
  }
}

async function setupGoogleApis(hasValidToken: boolean, token: TokenWithExpiration | null) {
  const customWindow = window as unknown as CustomWindow;
  const gapiPromise = customWindow.gapiLoadPromise || Promise.resolve();
  const gisPromise = customWindow.gisLoadPromise || Promise.resolve();

  await Promise.all([gapiPromise, gisPromise]);

  initGapiClient(async () => {
    isGapiReady = true;
    const userEmail = localStorage.getItem('user_email') || undefined;
    initGoogleAuth(handleAuthResponse, userEmail);

    if (hasValidToken && token) {
      setGapiToken(token);
      await syncPendingExpenses();
      await loadExpenses();
    }
  });
}

export async function main() {
  loggedInView = document.getElementById('logged-in-view');
  loggedOutView = document.getElementById('logged-out-view');
  signInButton = getButtonElementById('sign-in-button');
  signOutButton = getButtonElementById('sign-out-button');
  offlineIndicator = document.getElementById('offline-indicator');
  spreadsheetSelection = document.getElementById('spreadsheet-selection');
  switchButton = getButtonElementById('switch-button');
  saveSpreadsheetButton = getButtonElementById('save-spreadsheet-button');
  spreadsheetIdInput = getInputElementById('spreadsheet-id');
  sheetNameInput = getInputElementById('sheet-name');
  shareableLinkInput = getInputElementById('shareable-link');
  copyLinkButton = getButtonElementById('copy-link-button');
  fetchMoreButton = getButtonElementById('fetch-more-button');
  editEntriesButton = getButtonElementById('edit-entries-button');
  cancelEditButton = getButtonElementById('cancel-edit-button');

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
  editEntriesButton.addEventListener('click', () => {
    setEditMode(true);
  });
  cancelEditButton.addEventListener('click', () => {
    setEditMode(false);
  });

  const expenseForm = document.getElementById('expense-form');
  if (expenseForm) expenseForm.addEventListener('submit', handleAddExpense);

  loadCachedExpenses();
  renderExpenses();

  const tokenString = localStorage.getItem('gapi_token');
  let hasValidToken = false;
  let token: TokenWithExpiration | null = null;

  if (tokenString) {
    token = JSON.parse(tokenString);
    if (token && new Date().getTime() < token.expirationTime) {
      hasValidToken = true;
    }
  }

  // Check for query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const querySpreadsheetId = urlParams.get('spreadsheetId');
  const querySheetName = urlParams.get('sheetName');

  if (querySpreadsheetId && querySheetName) {
    showSpreadsheetSelection(querySpreadsheetId, querySheetName);
  } else if (hasValidToken) {
    const spreadsheetId = localStorage.getItem('selected_spreadsheet_id');
    const sheetName = localStorage.getItem('selected_sheet_name');
    if (spreadsheetId && sheetName) {
      showLoggedInView();
    } else {
      showSpreadsheetSelection();
    }
  } else {
    showLoggedOutView();
  }

  if (navigator.onLine) {
    try {
      await setupGoogleApis(hasValidToken, token);
    } catch (err) {
      console.error('Failed to setup Google APIs:', err);
    }
  }
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

  const date = formatDate(getInputElementById('expense-date').value);
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

  if (navigator.onLine && isGapiReady) {
    try {
      await addExpense(spreadsheetId, sheetName, date, name, category, price);

      // Manually update local state instead of reloading
      allExpenses.unshift(expense);
      totalExpenses++;
      localStorage.setItem('cached-expenses', JSON.stringify(allExpenses));
      localStorage.setItem('cached-total-expenses', totalExpenses.toString());
      renderExpenses();
    } catch (err) {
      console.error('Failed to add expense online, queueing locally:', err);
      savePendingExpense(expense);
      renderExpenses();
    }
  } else {
    savePendingExpense(expense);
    renderExpenses(); // Re-render to show the pending expense
  }

  // Clear the form
  getInputElementById('expense-date').value = getTodayLocalDate();
  getInputElementById('expense-name').value = '';
  getSelectElementById('expense-category').value = '';
  getInputElementById('expense-price').value = '';

  addButton.textContent = originalButtonText;
  addButton.disabled = false;
}

export function getPendingExpenses(): Expense[] {
  return JSON.parse(localStorage.getItem('pending-expenses') || '[]') || [];
}

export function savePendingExpense(expense: Expense) {
  const pendingExpenses = getPendingExpenses();
  pendingExpenses.push(expense);
  localStorage.setItem('pending-expenses', JSON.stringify(pendingExpenses));
}

export async function syncPendingExpenses() {
  if (!isGapiReady) {
    console.log('GAPI client not ready yet. Postponing sync.');
    return;
  }
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

export function getTodayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const month = m < 10 ? `0${m}` : `${m}`;
  const day = d < 10 ? `0${d}` : `${d}`;
  return `${year}-${month}-${day}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${parseInt(month, 10)}/${parseInt(day, 10)}/${year}`;
  }
  return dateStr;
}

export function deletePendingExpense(index: number) {
  const pendingExpenses = getPendingExpenses();
  if (index >= 0 && index < pendingExpenses.length) {
    pendingExpenses.splice(index, 1);
    localStorage.setItem('pending-expenses', JSON.stringify(pendingExpenses));
  }
}

export async function handleDeleteExpense(expense: Expense) {
  const spreadsheetId = localStorage.getItem('selected_spreadsheet_id');
  const sheetName = localStorage.getItem('selected_sheet_name');

  if (!spreadsheetId || !sheetName || expense.rowIndex === undefined) {
    return;
  }

  if (!navigator.onLine || !isGapiReady) {
    alert('Cannot delete synced expenses while offline.');
    return;
  }

  try {
    await deleteExpense(spreadsheetId, sheetName, expense.rowIndex);
    await loadExpenses();
  } catch (error) {
    console.error('Error deleting expense:', error);
    alert('Failed to delete expense. Please try again.');
  }
}
