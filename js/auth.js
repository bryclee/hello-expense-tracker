import { CLIENT_ID } from './config.js';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
let tokenClient;

export function initGoogleAuth(callback) {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: callback, // A function to call after the token is received
  });
}

export function signIn() {
  // Prompt the user to select a Google Account and grant access
  tokenClient.requestAccessToken();
}

export function requestTokenSilent() {
  tokenClient.requestAccessToken({ prompt: '' });
}
