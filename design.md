
# Expense Tracker Application Design

This document outlines the client-side design for a simple expense tracker that uses Google Sign-In for authentication and Google Sheets for data storage.

## 1. Core Concept & Security

- **Client-Side Only:** The application will run entirely in the user's browser. No backend server is required.
- **Modular Design:** The JavaScript code will be split into modules based on responsibility (auth, API interaction, UI logic) using ES6 `import`/`export` syntax.
- **Security (OAuth 2.0):** The application will use the standard **OAuth 2.0** flow for authorization. An **OAuth Client ID** will be used to identify the application to Google. This is a secure, standard practice for client-side apps. An **API Key is not required** for accessing user-specific data and will not be used. Security is maintained by configuring "Authorized JavaScript origins" in the Google Cloud Console.

## 2. File Structure

```
/home/pygmizeme/Projects/hello-expense-tracker/
├───index.html         # App layout and view
├───design.md          # This design document
├───js/
│   ├───app.js         # Main application logic, UI updates, event handling
│   ├───auth.js        # Google Sign-In and authorization logic
│   ├───gapi.js        # Google Sheets API interaction logic
│   └───config.js      # Configuration (Client ID, Spreadsheet ID)
└───README.md
```

## 3. Google API Interaction Details

This section details the specific API calls and libraries used.

### 3.1. Google API references

- **Google Identity Services (GIS) for Web:**
  - [Sign-In for Web Overview](https://developers.google.com/identity/gsi/web/guides/overview)
  - [JavaScript Client Reference](https://developers.google.com/identity/gsi/web/reference/js-reference)
  - [OAuth 2.0 Token Model Guide](https://developers.google.com/identity/oauth2/web/guides/use-token-model): Explains the user consent flow and how tokens are handled for returning users.
- **Google API Client for JavaScript (GAPI):**
  - [Developer's Guide](https://developers.google.com/api-client-library/javascript/dev-guide)
  - [Quickstart](https://developers.google.com/api-client-library/javascript/start/start-js): Demonstrates the standard setup, including the use of the `onload` callback for script loading.
- **Google Sheets API:**
  - [REST API Reference](https://developers.google.com/sheets/api/reference/rest): Essential for understanding the structure of requests and responses that GAPI uses.

### 3.2. Required Libraries (in `index.html`)

Two Google libraries need to be loaded in the main HTML file.

```html
<!-- For Google Sign-In -->
<script src="https://accounts.google.com/gsi/client" async defer></script>

<!-- For calling Google APIs like Sheets -->
<script src="https://apis.google.com/js/api.js" async defer></script>
```

### 3.3. Authentication Flow (`auth.js`)

Authentication is handled by the **Google Identity Services (GIS)** library. The goal is to get an **access token** that grants permission to the Sheets API.

1.  **Initialize a Token Client:** In `auth.js`, we create a "token client" that is configured with our `CLIENT_ID` and the specific permissions (scopes) our app needs. For Sheets, the scope is `https://www.googleapis.com/auth/spreadsheets`.

    ```javascript
    // Example from auth.js
    import { CLIENT_ID } from './config.js';

    const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
    let tokenClient;

    function initGoogleAuth(callback) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: callback, // A function to call after the token is received
      });
    }
    ```

2.  **Requesting an Access Token:** To sign a user in, we call `requestAccessToken()` on the client. This will trigger the Google pop-up for sign-in and consent. If the user has already granted consent, it may return a token immediately.

    ```javascript
    // Example from auth.js
    function signIn() {
      // Prompt the user to select a Google Account and grant access
      tokenClient.requestAccessToken();
    }
    ```

3.  **Handling the Token:** The `callback` function we defined during initialization will receive the access token. This token must be passed to the GAPI (Google API) client library to authorize subsequent API calls.

### 3.4. Sheets API Interaction (`gapi.js`)

This logic uses the **Google API Client Library for JavaScript (GAPI)**.

1.  **Load the Sheets API Client:** Before we can use the Sheets API, we must load the "sheets" client and initialize it. This is typically done once when the application loads.

    ```javascript
    // Example from gapi.js
    const API_DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

    function initGapiClient(callback) {
      gapi.load('client', async () => {
        await gapi.client.init({
          discoveryDocs: [API_DISCOVERY_DOC],
        });
        callback();
      });
    }
    ```

2.  **Set the Access Token:** The access token received from the authentication flow must be given to the GAPI client.

    ```javascript
    // Example from gapi.js
    function setGapiToken(token) {
      gapi.client.setToken(token);
    }
    ```

3.  **Reading from the Sheet (Get Expenses):** To get data, we use `gapi.client.sheets.spreadsheets.values.get`.

    ```javascript
    // Example from gapi.js
    import { SPREADSHEET_ID } from './config.js';

    async function getExpenses() {
      const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Expenses!A2:D', // Assumes a sheet named "Expenses" and data in columns A-D, starting at row 2
      });
      return response.result.values || [];
    }
    ```

4.  **Writing to the Sheet (Add Expense):** To add a new row, we use `gapi.client.sheets.spreadsheets.values.append`.

    ```javascript
    // Example from gapi.js
    import { SPREADSHEET_ID } from './config.js';

    async function addExpense(date, description, category, amount) {
      const response = await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Expenses!A1', // Appending to the "Expenses" sheet
        valueInputOption: 'USER_ENTERED', // So "1/1/2024" is treated as a date
        resource: {
          values: [
            [date, description, category, amount]
          ],
        },
      });
      return response.result;
    }
    ```

## 4. Application Behavior and UI

Describes the user-facing behavior and the different states of the application.

### 4.1. Initial State

- On page load, a "Loading..." message is displayed while the application initializes the Google clients and checks the user's authentication status.

### 4.2. Logged-Out View

- **Visibility:** This is the default view if the user is not authenticated.
- **Content:**
    - App title and a brief description.
    - A message explaining that logging in will grant the app permission to access their Google Sheets.
    - The official "Sign in with Google" button.

### 4.3. Logged-In View

- **Visibility:** This view is shown once the user has successfully signed in.
- **Content:**
    - A "Sign Out" button.
    - **Expense Entry Form:**
        - `Date` field: Defaults to the current date. Should not be the initially focused field.
        - `Category` field: A dropdown list of expense categories (e.g., Food, Transport, Bills).
        - `Name` field: A text input for the expense description. This should be the initially focused field.
        - `Price` field: A number input for the cost.
        - An "Add Expense" button to submit the form.
    - **Recent Transactions Section:**
        - Displays the last 5 transactions from the Google Sheet.
        - A "Show More" button to fetch and display more transactions (e.g., the next 5).

## 5. Offline Capabilities

To ensure the application is usable without an internet connection, it will implement offline-first capabilities using a **Service Worker**.

### 5.1. Service Worker and Caching

-   A `service-worker.js` file will be created.
-   This service worker will cache the core application assets (the "app shell"): `index.html`, all JavaScript files (`js/*.js`), and any future CSS files.
-   On subsequent visits, the service worker will intercept network requests and serve the cached assets first, allowing the application to load instantly, even when offline.

### 5.2. Offline Behavior

-   **Loading:** The app will load and be fully interactive, regardless of network status.
-   **Data Display:** Previously fetched transactions, stored in `localStorage`, will be displayed.
-   **Offline Indicator:** A clear visual indicator (e.g., a banner or an icon) will appear at the top of the page to inform the user that they are currently offline.
-   **Form Submission:** The expense entry form will remain fully functional.
    -   When a user submits a new expense while offline, the data will be saved to a dedicated `localStorage` queue (e.g., `pending-transactions`).
    -   The UI will be updated immediately to show the new expense in the transaction list.
    -   A message will be displayed next to the newly added item, such as `(Not Synced)`.

### 5.3. Synchronization

-   When the application detects that the network connection has been restored, it will automatically attempt to sync the pending transactions from `localStorage` to the Google Sheet.
-   Once an item is successfully synced, its `(Not Synced)` status will be removed from the UI.

## 6. HTML Structure (`index.html`)

This is the proposed HTML structure with placeholder elements that the JavaScript will interact with.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Expense Tracker</title>
    <!-- Basic styling can be added here -->
    <style>
        body { font-family: sans-serif; padding: 2em; }
        #logged-in-view, #logged-out-view { display: none; }
        form { margin-bottom: 2em; }
        form > div { margin-bottom: 1em; }
        label { display: inline-block; width: 80px; }
    </style>
</head>
<body>

    <h1>Expense Tracker</h1>

    <div id="loading-indicator">Loading...</div>

    <!-- LOGGED-OUT VIEW -->
    <div id="logged-out-view">
        <p>A simple app to track your expenses using Google Sheets.</p>
        <p>To use the app, please sign in with your Google Account. This will grant the application permission to create and manage a Google Sheet in your account.</p>
        <div id="sign-in-button"></div>
    </div>

    <!-- LOGGED-IN VIEW -->
    <div id="logged-in-view">
        <button id="sign-out-button">Sign Out</button>
        
        <hr>

        <h2>Add a New Expense</h2>
        <form id="expense-form">
            <div>
                <label for="expense-date">Date</label>
                <input type="date" id="expense-date" required>
            </div>
            <div>
                <label for="expense-name">Name</label>
                <input type="text" id="expense-name" placeholder="Coffee with friends" required autofocus>
            </div>
            <div>
                <label for="expense-category">Category</label>
                <select id="expense-category" required>
                    <option value="" disabled selected>Select a category</option>
                    <option>Food</option>
                    <option>Transport</option>
                    <option>Bills</option>
                    <option>Entertainment</option>
                    <option>Other</option>
                </select>
            </div>
            <div>
                <label for="expense-price">Price</label>
                <input type="number" id="expense-price" placeholder="15.50" step="0.01" required>
            </div>
            <button type="submit">Add Expense</button>
        </form>

        <hr>

        <h2>Recent Transactions</h2>
        <ul id="transaction-list">
            <!-- Transactions will be rendered here by JavaScript -->
        </ul>
        <button id="fetch-more-button">Show More</button>
    </div>

    <!-- Google Client Libraries -->
    <script src="https://accounts.google.com/gsi/client" async defer></script>
    <script src="https://apis.google.com/js/api.js" async defer></script>
    
    <!-- Main Application Script -->
    <script type="module" src="js/app.js"></script>

    <script>
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered with scope:', registration.scope);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        }
    </script>

</body>
</html>
```

## 7. Testing Strategy

To ensure code quality and application reliability, the following testing strategies will be implemented.

### 7.1. Unit Testing

-   **Framework:** A JavaScript testing framework like **Jest** will be used.
-   **Scope:** Unit tests will focus on individual functions and modules in isolation.
-   **Mocks:** External dependencies, especially the Google API clients (`gapi` and `google.accounts`), will be mocked. This allows for fast, repeatable tests without actual network calls.
-   **Target Files:**
    -   `auth.js`: Test functions like `initGoogleAuth` and `signIn` to ensure they interact with the (mocked) Google Identity Services library correctly.
    -   `gapi.js`: Test functions like `getExpenses` and `addExpense` to verify they construct the correct API requests and handle responses properly.
    -   `app.js`: Test UI logic, data formatting, and event handling logic.

### 7.2. Integration Testing

-   **Framework:** A browser automation tool like **Cypress** or **Puppeteer** will be considered for end-to-end testing.
-   **Scope:** Integration tests will focus on the interactions between different parts of the application, from UI events to API calls.
-   **Test Environment:**
    -   A dedicated Google Account and a separate Google Sheet will be used for testing purposes.
    -   The OAuth Client ID and Spreadsheet ID for the test environment will be stored in a separate configuration file.
-   **Test Scenarios:**
    -   **Login Flow:** Test the entire Google Sign-In flow.
    -   **Expense Creation:** Simulate filling out the form and submitting it. Verify that the new expense appears in the UI and is correctly added to the test Google Sheet.
    -   **Offline Mode:** Test the application's behavior when offline. This includes caching of assets by the service worker and queuing of new expenses in `localStorage`.

## 8. Hosting

The application will be hosted on **GitHub Pages**.

-   **URL:** The application will be available at a URL like `https://<username>.github.io/<repository-name>/`.
-   **OAuth Configuration:** The **Authorized JavaScript origins** in the Google Cloud Console must be updated to include the GitHub Pages URL to ensure that the Google Sign-In flow works correctly.
