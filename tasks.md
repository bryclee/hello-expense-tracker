## 1. Project Setup

-   [x] Create the directory structure (`js` folder).
-   [x] Create the initial files:
    -   [x] `index.html`
    -   [x] `js/app.js`
    -   [x] `js/auth.js`
    -   [x] `js/gapi.js`
    -   [x] `js/config.js`
    -   [x] `service-worker.js`
    -   [x] `tasks.md`

## 2. HTML Structure

-   [x] Implement the HTML structure in `index.html` as defined in `design.md`.

## 3. Google API Setup

-   [x] Create a Google Cloud project.
-   [x] Enable the Google Sheets API.
-   [x] Create an OAuth 2.0 Client ID.
-   [x] Configure the `js/config.js` file with the Client ID and a placeholder for the Spreadsheet ID.

## 4. Authentication

-   [x] Implement the `initGoogleAuth` and `signIn` functions in `js/auth.js`.
-   [x] Implement the sign-in and sign-out buttons in `js/app.js`.
-   [x] Handle the display of the logged-in and logged-out views.

## 5. Google Sheets API Interaction

-   [x] Implement the `initGapiClient`, `setGapiToken`, `getExpenses`, and `addExpense` functions in `js/gapi.js`.
-   [x] Create a new Google Sheet and get its ID.
-   [x] Update `js/config.js` with the Spreadsheet ID.

## 6. Application Logic

-   [x] Implement the main application logic in `js/app.js`.
-   [x] Implement the expense form submission.
-   [x] Implement the display of recent transactions.
-   [ ] Implement the "Show More" functionality.
-   [ ] Ensure `gapi` is loaded before `initGapiClient` is called in `main`.

## 7. Offline Capabilities

-   [x] Implement the service worker in `service-worker.js` to cache the application shell.
-   [x] Implement the offline indicator.
-   [x] Implement the `localStorage` logic for offline data storage.
-   [x] Implement the synchronization logic.
-   [ ] Work on the initialization logic when it comes to the service worker and offline flow.

## 8. Testing

-   [ ] Set up a testing environment (e.g., Jest for unit tests, Cypress for integration tests).
-   [ ] Write unit tests for `auth.js`, `gapi.js`, and `app.js`.
-   [ ] Write integration tests for the main application flows (login, expense creation, offline mode).
