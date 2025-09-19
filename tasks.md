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

## 9. Future Enhancements

-   [ ] Persist consent (silent consent does not work with token model).

    Our attempts to implement seamless, silent consent (where the user wouldn't need to re-authenticate if they had previously consented) encountered persistent issues with browser popup blockers. Even when using the `prompt: 'none'` option, the Google Identity Services library would attempt to open a hidden popup or iframe, which was then blocked by browser security settings or extensions. This led to a less smooth user experience than desired. The current solution requires an explicit user click to sign in, ensuring reliability but sacrificing some convenience for returning users. Future work should explore more robust methods for persisting consent in a web environment, potentially by investigating alternative Google authentication flows or server-side solutions.

-   [ ] Optimize loading expenses to only load necessary rows, for most recent 5 transactions.

    To display only the most recent 5 transactions, the current implementation makes two API calls to the Google Sheets API: one to determine the total number of rows with data, and a second to fetch the last 5 rows based on that count. While this works, it's not ideal for very large sheets as the initial row-counting call can be inefficient. The goal is to find a more optimized approach that can retrieve the last N rows in a single, more performant API call, or a method that scales better with sheet size.
