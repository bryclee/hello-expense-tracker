console.log('app.js loaded');
import { initGoogleAuth, signIn } from './auth.js';
import { initGapiClient, setGapiToken, getExpenses, addExpense } from './gapi.js';

const loggedInView = document.getElementById('logged-in-view');
const loggedOutView = document.getElementById('logged-out-view');
const signInButton = document.getElementById('sign-in-button');
const signOutButton = document.getElementById('sign-out-button');
const loadingIndicator = document.getElementById('loading-indicator');
const offlineIndicator = document.getElementById('offline-indicator');

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
  document.getElementById('expense-date').valueAsDate = new Date();
}

function showLoggedOutView() {
  loggedInView.style.display = 'none';
  loggedOutView.style.display = 'block';
  loadingIndicator.style.display = 'none';
}

function handleAuthClick() {
  signIn();
}

function handleSignOutClick() {
  localStorage.removeItem('gapi_token');
  gapi.client.setToken(null);
  showLoggedOutView();
}

async function handleAuthResponse(tokenResponse) {
  console.log('Storing token:', tokenResponse);
  localStorage.setItem('gapi_token', JSON.stringify(tokenResponse));
  setGapiToken(tokenResponse);
  showLoggedInView();
  loadExpenses();
}

async function loadExpenses() {
  let expenses = [];
  if (navigator.onLine) {
    expenses = await getExpenses();
  }
  const pendingExpenses = getPendingExpenses();
  renderExpenses(expenses, pendingExpenses);
}

function renderExpenses(expenses, pendingExpenses) {
  const transactionList = document.getElementById('transaction-list');
  transactionList.innerHTML = ''; // Clear the list

  const allExpenses = [...expenses, ...pendingExpenses];
  const recentExpenses = allExpenses.slice(-5);

  if (recentExpenses.length > 0) {
    recentExpenses.forEach((expense, index) => {
      const li = document.createElement('li');
      let textContent = ''
      if(Array.isArray(expense)){
        textContent = `${expense[0]} - ${expense[1]} - ${expense[2]} - $${expense[3]}`;
      } else {
        textContent = `${expense.date} - ${expense.name} - ${expense.category} - $${expense.price}`;
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

  const expenseForm = document.getElementById('expense-form');
  expenseForm.addEventListener('submit', handleAddExpense);

  initGapiClient(() => {
    initGoogleAuth(handleAuthResponse);
    console.log('Checking for token...');
    const token = JSON.parse(localStorage.getItem('gapi_token'));
    if (token) {
      console.log('Token found:', token);
      setGapiToken(token);
      showLoggedInView();
      loadExpenses();
    } else {
      console.log('Token not found.');
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

  if (navigator.onLine) {
    await addExpense(date, name, category, price);
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
  if (pendingExpenses.length > 0) {
    for (const expense of pendingExpenses) {
      await addExpense(expense.date, expense.name, expense.category, expense.price);
    }
    localStorage.removeItem('pending-expenses');
    loadExpenses();
  }
}

main();